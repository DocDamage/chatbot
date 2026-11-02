import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { AIWritingAction, WritingStudioService } from '../../core/writing';
import { AppError, ValidationError } from '../../utils/errors';
import { discoverLocalRuntimes, OllamaLocalAIBackend } from '../../core/native-runtime';
import { WritingTransformBackend } from '../../core/writing/WritingAIProviderRouter';

const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

function requireBoundedDocument(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('content must be a string');
  if (Buffer.byteLength(value, 'utf8') > MAX_DOCUMENT_BYTES) {
    throw new AppError('content exceeds the 2 MB writing-studio limit', 413, 'PAYLOAD_TOO_LARGE');
  }
  return value;
}

export function createWritingStudioRouter(
  workspaceRoot = process.cwd(),
  integrations: { autoDiscover?: boolean; aiBackend?: WritingTransformBackend | null } = {}
): Router {
  const router = Router();
  const runtimes = discoverLocalRuntimes(workspaceRoot);
  const aiBackend = integrations.aiBackend === null
    ? undefined
    : integrations.aiBackend || (integrations.autoDiscover === false ? undefined : new OllamaLocalAIBackend(runtimes.ollamaEndpoint, process.env.OLLAMA_MODEL || 'qwen3:8b'));
  const studios = new Map<string, WritingStudioService>();
  const getStudio = (userId: string) => {
    let studio = studios.get(userId);
    if (!studio) {
      studio = new WritingStudioService({ allowCloud: false, aiBackend });
      studios.set(userId, studio);
    }
    return studio;
  };
  const requireActiveDocument = (userId: string) => {
    const studio = getStudio(userId);
    if (!studio.getActiveDocument()) throw new AppError('No active Writing Studio document.', 409, 'NO_ACTIVE_DOCUMENT');
    return studio;
  };

  router.get('/api/writing-studio/state', asyncHandler(async (req, res) => {
    res.json(getStudio(req.user?.userId || 'local-operator').getStudioState());
  }));

  router.post('/api/writing-studio/documents/open', asyncHandler(async (req, res) => {
    const studio = getStudio(req.user?.userId || 'local-operator');
    const document = studio.openDocument(
      requireBoundedDocument(req.body.content ?? ''),
      sanitizeInput(String(req.body.title || 'Untitled Document')).slice(0, 200)
    );
    res.status(201).json({ document, state: studio.getStudioState() });
  }));

  router.patch('/api/writing-studio/document', asyncHandler(async (req, res) => {
    const studio = requireActiveDocument(req.user?.userId || 'local-operator');
    const document = studio.updateDocumentText(requireBoundedDocument(req.body.content));
    res.json({ document, autosaveStatus: studio.getStudioState().autosaveStatus });
  }));

  router.post('/api/writing-studio/proofread', asyncHandler(async (req, res) => {
    const studio = requireActiveDocument(req.user?.userId || 'local-operator');
    res.json({ suggestions: studio.runProofreadingScan(), outline: studio.getOutline() });
  }));

  router.post('/api/writing-studio/save', asyncHandler(async (req, res) => {
    const studio = requireActiveDocument(req.user?.userId || 'local-operator');
    const document = studio.saveDocument(sanitizeInput(String(req.body.commitMessage || 'Manual save')).slice(0, 300));
    res.json({ document, state: studio.getStudioState() });
  }));

  router.post('/api/writing-studio/proposals', asyncHandler(async (req, res) => {
    const studio = requireActiveDocument(req.user?.userId || 'local-operator');
    const allowedActions = new Set<AIWritingAction>([
      'rewrite', 'concise', 'expand', 'summarize', 'key_points', 'tone',
      'format_list', 'format_table', 'explain_review', 'custom'
    ]);
    const action = sanitizeInput(String(req.body.action || 'proofread'));
    if (!allowedActions.has(action as AIWritingAction)) return res.status(400).json({ error: `Unsupported writing action '${action}'.` });
    if (req.body.preferCloud === true) {
      return res.status(400).json({ error: 'Cloud writing providers are disabled on this local-only route.' });
    }
    if (!studio.getAIRouter().isAvailable()) {
      return res.status(503).json({ error: 'AI writing proposals require a configured model-backed transformer.' });
    }
    if (aiBackend?.health && !(await aiBackend.health()).available) {
      return res.status(503).json({ error: 'AI writing proposals require a healthy local model backend.' });
    }
    const proposal = await studio.generateAIProposal(
      action as AIWritingAction,
      undefined,
      req.body.instruction ? sanitizeInput(String(req.body.instruction)).slice(0, 1000) : undefined,
      req.body.targetTone ? sanitizeInput(String(req.body.targetTone)).slice(0, 100) : undefined,
      false
    );
    res.status(201).json({ proposal });
  }));

  router.post('/api/writing-studio/proposals/:proposalId/accept', asyncHandler(async (req, res) => {
    const document = requireActiveDocument(req.user?.userId || 'local-operator').acceptAIProposal(req.params.proposalId);
    res.json({ document });
  }));

  router.post('/api/writing-studio/proposals/:proposalId/reject', asyncHandler(async (req, res) => {
    const proposal = requireActiveDocument(req.user?.userId || 'local-operator').rejectAIProposal(req.params.proposalId);
    res.json({ proposal });
  }));

  return router;
}
