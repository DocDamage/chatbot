import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';

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
