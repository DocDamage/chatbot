import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  DABOOK_EXPORT_FORMATS,
  DABOOK_LICENSE_STATUSES,
  DABOOK_REVIEW_STATUSES,
  DABOOK_TRAINING_MODES,
  DabookError,
  TrainingExportError,
  TrainingExporter,
  getDabookBridge
} from '../../core/dabook';

// A book reference becomes a CLI argument: refuse anything that could be read as an option.
const bookRef = z.string().trim().min(1).max(512).refine(value => !value.startsWith('-'), 'must not start with "-"');
const pairId = z.string().regex(/^[0-9a-f]{16}$/);

const schemas = {
  license: z.object({ book: bookRef, status: z.enum(DABOOK_LICENSE_STATUSES) }),
  decision: z.object({ book: bookRef, pairId, decision: z.enum(['accept', 'reject']), reason: z.string().max(500).optional() }),
  reviewBook: z.object({ book: bookRef, status: z.enum(DABOOK_REVIEW_STATUSES) }),
  recompile: z.object({ book: bookRef }),
  sample: z.object({
    book: bookRef,
    n: z.coerce.number().int().min(1).max(50).default(10),
    seed: z.coerce.number().int().min(0).max(2 ** 31 - 1).default(42)
  }),
  export: z.object({
    books: z.array(bookRef).max(200).optional(),
    modes: z.array(z.enum(DABOOK_TRAINING_MODES)).min(1).default(['sft']),
    formats: z.array(z.enum(DABOOK_EXPORT_FORMATS)).min(1).default(['jsonl']),
    includeHeuristic: z.boolean().optional(),
    splits: z.boolean().optional()
  })
};

const DABOOK_STATUS: Record<string, number> = {
  bad_args: 400,
  export_blocked: 403,
  lock_held: 423,
  disabled: 503,
  interpreter_not_found: 503,
  timeout: 504,
  needs_input: 422,
  failed: 502,
  bad_output: 502,
  spawn_error: 502
};

const EXPORT_STATUS: Record<string, number> = { unknown_book: 404, blocked: 403, no_books: 409, contaminated: 409 };

/** Run a handler body, turning DABOOK/export errors and validation failures into typed responses. */
function guarded(handler: (req: Request, res: Response) => Promise<unknown>) {
  return asyncHandler(async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'invalid_request', details: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
      }
      if (error instanceof TrainingExportError) {
        return res.status(EXPORT_STATUS[error.code] ?? 400).json({ error: error.code === 'contaminated' ? 'contaminated' : 'export_blocked', code: error.code, message: error.message, details: error.details });
      }
      if (error instanceof DabookError) {
        return res.status(DABOOK_STATUS[error.reason] ?? 502).json({ error: error.reason, message: error.message, details: error.details.blocked ? { blocked: error.details.blocked } : undefined });
      }
      throw error;
    }
  });
}

export function createKnowledgeBaseRouter(services: any): Router {
  const router = Router();

  router.get('/api/knowledge-base/stats', asyncHandler(async (_req, res) => {
    if (!services?.ragService) {
      return res.status(503).json({ error: 'RAG service not initialized' });
    }

    const stats = services.documentManager
      ? await services.documentManager.getStats()
      : {};
    res.json(stats);
  }));

  // Environment status of the DABOOK structured-PDF sidecar (developer-only; see server/index.ts).
  // ?deep=true also runs `dabook doctor`; ?refresh=true bypasses the probe cache.
  router.get('/api/knowledge-base/dabook/health', asyncHandler(async (req, res) => {
    const bridge = services?.dabookBridge ?? getDabookBridge();
    const health = await bridge.health({
      deep: parseOptionalBoolean(req.query.deep) === true,
      force: parseOptionalBoolean(req.query.refresh) === true
    });
    res.json(health);
  }));

  // ---- DABOOK governance: licenses, review, governed training export (developer-only; see server/index.ts)
  const bridgeOf = () => services?.dabookBridge ?? getDabookBridge();

  router.get('/api/knowledge-base/dabook/books', guarded(async (_req, res) => {
    res.json(await bridgeOf().listBooks());
  }));

  router.post('/api/knowledge-base/dabook/license', guarded(async (req, res) => {
    const { book, status } = schemas.license.parse(req.body);
    res.json(await bridgeOf().setLicense(book, status));
  }));

  router.get('/api/knowledge-base/dabook/review/sample', guarded(async (req, res) => {
    const { book, n, seed } = schemas.sample.parse(req.query);
    res.json(await bridgeOf().reviewSample(book, { count: n, seed }));
  }));

  router.post('/api/knowledge-base/dabook/review/decision', guarded(async (req, res) => {
    const { book, pairId: pair, decision, reason } = schemas.decision.parse(req.body);
    res.json(await bridgeOf().reviewDecision(book, pair, decision, reason));
  }));

  router.post('/api/knowledge-base/dabook/review/book', guarded(async (req, res) => {
    const { book, status } = schemas.reviewBook.parse(req.body);
    res.json(await bridgeOf().reviewBook(book, status));
  }));

  router.post('/api/knowledge-base/dabook/recompile', guarded(async (req, res) => {
    res.json(await bridgeOf().recompile(schemas.recompile.parse(req.body).book));
  }));

  router.post('/api/knowledge-base/dabook/training-export', guarded(async (req, res) => {
    const request = schemas.export.parse(req.body ?? {});
    const exporter = services?.trainingExporter ?? new TrainingExporter({ bridge: bridgeOf() });
    res.json(await exporter.export(request));
  }));

  router.get('/api/knowledge-base/sources', asyncHandler(async (req, res) => {
    if (!services?.ragDocumentStore) {
      return res.status(503).json({ error: 'RAG document store not initialized' });
    }

    const sources = await services.ragDocumentStore.listSources({
      limit: parsePositiveInt(req.query.limit, 50),
      offset: parseNonNegativeInt(req.query.offset, 0),
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      needsOcr: parseOptionalBoolean(req.query.needsOcr),
      duplicatesOnly: parseOptionalBoolean(req.query.duplicates) === true
    });

    res.json(sources);
  }));

  router.get('/api/knowledge-base/ocr-queue', asyncHandler(async (req, res) => {
    if (!services?.ragDocumentStore) {
      return res.status(503).json({ error: 'RAG document store not initialized' });
    }

    const queue = await services.ragDocumentStore.getOcrQueue({
      limit: parsePositiveInt(req.query.limit, 100),
      offset: parseNonNegativeInt(req.query.offset, 0),
      q: typeof req.query.q === 'string' ? req.query.q : undefined
    });

    res.json(queue);
  }));

  return router;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseNonNegativeInt(value: unknown, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) {
    return undefined;
  }
  if (raw === true || raw === 'true' || raw === '1') {
    return true;
  }
  if (raw === false || raw === 'false' || raw === '0') {
    return false;
  }
  return undefined;
}
