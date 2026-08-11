import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { isDebugLikeCommand } from '../../core/modes/ModePolicy';
import { assertActionAllowed, modeFromRequest } from '../../core/modes/ExecutionModePolicy';
import { CodingAuthorization } from '../../core/coding/authorization/CodingAuthorization';

export function createCodeRouter(services: any): Router {
  const router = Router();

  const getAgent = () => {
    if (!services?.codingAgent) {
      throw new Error('Coding agent not initialized');
    }
    return services.codingAgent;
  };
  const authorization = new CodingAuthorization();

  const currentMode = (req: any) => modeFromRequest({
    headerMode: req.headers['x-work-mode'],
    bodyMode: req.body?.mode
  });

  const configuredCodingAdapter = () => {
    if (services?.codingModelAdapter) return services.codingModelAdapter;
    const adapter = services?.orchestrator?.llmAdapter;
    const provider = process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'template');
    return adapter && provider !== 'template' ? adapter : undefined;
  };

  router.post('/api/code/ask', asyncHandler(async (req, res) => {
    const mode = currentMode(req);
    try {
      assertActionAllowed(mode, 'read_files');
    } catch (error: any) {
      return res.status(403).json({ error: error.message });
    }
    const message = sanitizeInput(String(req.body.message || ''));
    if (!message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    const modelAdapter = configuredCodingAdapter();
    res.json(await getAgent().handle({ message, runVerification: req.body.runVerification === true, modelAdapter, model: modelAdapter?.getModelName?.(), generatePatch: Boolean(modelAdapter) }));
  }));

  router.post('/api/code/plan', asyncHandler(async (req, res) => {
    const mode = currentMode(req);
    try {
      assertActionAllowed(mode, 'create_plan');
    } catch (error: any) {
      return res.status(403).json({ error: error.message });
    }

    const message = sanitizeInput(String(req.body.message || ''));
    if (!message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    res.json(await getAgent().plan(message));
  }));

  router.post('/api/code/patch', asyncHandler(async (req, res) => {
    const mode = currentMode(req);
    try {
      assertActionAllowed(mode, 'create_patch');
      assertActionAllowed(mode, 'write_files');
    } catch (error: any) {
      return res.status(403).json({ error: error.message });
    }

    const message = sanitizeInput(String(req.body.message || ''));
    if (!message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    res.json(await getAgent().createPatch(message));
  }));

  router.post('/api/code/review', asyncHandler(async (req, res) => {
    const diff = String(req.body.diff || '');
    if (!diff.trim()) {
      return res.status(400).json({ error: 'diff is required' });
    }
    res.json(await getAgent().review(diff, Array.isArray(req.body.focus) ? req.body.focus : []));
  }));

  router.post('/api/code/verify', asyncHandler(async (req, res) => {
    const commands = Array.isArray(req.body.commands) ? req.body.commands.map(String) : ['npm run type-check'];
    const mode = currentMode(req);
    const debugLike = commands.some(isDebugLikeCommand);
    try {
      assertActionAllowed(mode, debugLike ? 'inspect_error' : 'run_tests');
      assertActionAllowed(mode, 'run_tests');
    } catch (error: any) {
      return res.status(403).json({ error: error.message });
    }
    res.json(await getAgent().verify(commands));
  }));

  router.get('/api/code/repository', asyncHandler(async (req, res) => {
    try { assertActionAllowed(currentMode(req), 'read_files'); } catch (error: any) { return res.status(403).json({ error: error.message }); }
    res.json(getAgent().getRepositorySnapshot());
  }));

  router.post('/api/code/retrieve', asyncHandler(async (req, res) => {
    try { assertActionAllowed(currentMode(req), 'search_files'); } catch (error: any) { return res.status(403).json({ error: error.message }); }
    const query = sanitizeInput(String(req.body.query || req.body.message || ''));
    if (!query.trim()) return res.status(400).json({ error: 'query is required' });
    res.json({ evidence: await getAgent().retrieveEvidence({
      query,
      files: Array.isArray(req.body.files) ? req.body.files.map(String) : undefined,
      symbols: Array.isArray(req.body.symbols) ? req.body.symbols.map(String) : undefined,
      diagnostics: Array.isArray(req.body.diagnostics) ? req.body.diagnostics : undefined,
      maxItems: Number.isFinite(req.body.maxItems) ? Number(req.body.maxItems) : undefined
    }) });
  }));

  router.post('/api/code/patch/structured', asyncHandler(async (req, res) => {
    const mode = currentMode(req);
    try {
      assertActionAllowed(mode, 'create_patch');
      authorization.assert(authorization.authorize({ requestId: String(req.headers['x-request-id'] || ''), mode, action: 'create_patch' }));
    } catch (error: any) {
      return res.status(403).json({ error: error.message });
    }
    if (Array.isArray(req.body.operations)) return res.json(getAgent().createStructuredPatch(req.body.operations));
    const message = sanitizeInput(String(req.body.message || ''));
    if (!message.trim()) return res.status(400).json({ error: 'operations or message is required' });
    res.json(getAgent().createStructuredPatchFromInstruction(message, false, true));
  }));

  router.post('/api/code/patch/apply', asyncHandler(async (req, res) => {
    const mode = currentMode(req);
    try {
      assertActionAllowed(mode, 'write_files');
      const record = authorization.authorize({
        requestId: String(req.headers['x-request-id'] || ''),
        mode,
        action: 'apply_patch',
        explicitApproval: req.body.approved === true
      });
      authorization.assert(record);
    } catch (error: any) {
      return res.status(403).json({ error: error.message });
    }
    if (!Array.isArray(req.body.operations)) return res.status(400).json({ error: 'operations are required' });
    if (!req.body.operations.every((operation: any) => operation && operation.authorized === true)) return res.status(403).json({ error: 'each operation requires explicit authorization' });
    res.json(getAgent().applyStructuredPatch(getAgent().createStructuredPatch(req.body.operations), mode));
  }));

  router.post('/api/code/verify/native', asyncHandler(async (req, res) => {
    const mode = currentMode(req);
    try {
      assertActionAllowed(mode, 'run_tests');
      authorization.assert(authorization.authorize({ requestId: String(req.headers['x-request-id'] || ''), mode, action: 'run_verification' }));
    } catch (error: any) {
      return res.status(403).json({ error: error.message });
    }
    res.json(await getAgent().verifyNative({ run: req.body.run !== false, maxCommands: Number.isFinite(req.body.maxCommands) ? Number(req.body.maxCommands) : undefined }));
  }));

  router.post('/api/code/repair', asyncHandler(async (req, res) => {
    const mode = currentMode(req);
    try {
      assertActionAllowed(mode, 'run_tests');
      const record = authorization.authorize({
        requestId: String(req.headers['x-request-id'] || ''),
        mode,
        action: 'repair',
        explicitApproval: req.body.approved === true
      });
      authorization.assert(record);
    } catch (error: any) {
      return res.status(403).json({ error: error.message });
    }
    if (!Array.isArray(req.body.operations)) return res.status(400).json({ error: 'operations are required' });
    if (!req.body.operations.every((operation: any) => operation && operation.authorized === true)) return res.status(403).json({ error: 'each operation requires explicit authorization' });
    res.json(await getAgent().repair({ operations: req.body.operations, mode, maxIterations: Number.isFinite(req.body.maxIterations) ? Number(req.body.maxIterations) : undefined }));
  }));

  router.get('/api/code/files/search', asyncHandler(async (req, res) => {
    const query = sanitizeInput(String(req.query.q || ''));
    if (!query.trim()) {
      return res.status(400).json({ error: 'q is required' });
    }
    res.json({ results: await getAgent().searchFiles(query) });
  }));

  router.get('/api/code/symbols', asyncHandler(async (req, res) => {
    const file = sanitizeInput(String(req.query.file || ''));
    if (!file.trim()) {
      return res.status(400).json({ error: 'file is required' });
    }
    res.json({ symbols: await getAgent().getSymbols(file) });
  }));

  return router;
}
