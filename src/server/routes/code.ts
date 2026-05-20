import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';

export function createCodeRouter(services: any): Router {
  const router = Router();

  const getAgent = () => {
    if (!services?.codingAgent) {
      throw new Error('Coding agent not initialized');
    }
    return services.codingAgent;
  };

  router.post('/api/code/ask', asyncHandler(async (req, res) => {
    const message = sanitizeInput(String(req.body.message || ''));
    if (!message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    res.json(await getAgent().handle({ message, runVerification: req.body.runVerification === true }));
  }));

  router.post('/api/code/plan', asyncHandler(async (req, res) => {
    const message = sanitizeInput(String(req.body.message || ''));
    if (!message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    res.json(await getAgent().plan(message));
  }));

  router.post('/api/code/patch', asyncHandler(async (req, res) => {
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
    res.json(await getAgent().verify(commands));
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
