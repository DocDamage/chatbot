import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { GamingPlaybookKind, GamingPlaybookService } from '../../core/agents/gaming/GamingPlaybookService';

const playbookKinds: GamingPlaybookKind[] = [
  'engine_selection',
  'asset_pipeline',
  'design_review',
  'modding_safety',
  'prompt_pack'
];

export function createGamingRouter(services: any): Router {
  const router = Router();
  const playbooks = new GamingPlaybookService();

  router.post('/api/gaming/ask', asyncHandler(async (req, res) => {
    if (!services?.gamingGeniusAgent) {
      return res.status(503).json({ error: 'Gaming agent not initialized' });
    }
    res.json(await services.gamingGeniusAgent.ask(req.body.query || req.body.message || ''));
  }));

  router.get('/api/gaming/playbooks', asyncHandler(async (_req, res) => {
    res.json({
      playbooks: playbookKinds.map(kind => ({ kind }))
    });
  }));

  router.post('/api/gaming/playbook', asyncHandler(async (req, res) => {
    const goal = String(req.body.goal || req.body.message || '').trim();
    const kind = String(req.body.kind || 'design_review') as GamingPlaybookKind;
    if (!goal) return res.status(400).json({ error: 'goal is required' });
    if (!playbookKinds.includes(kind)) return res.status(400).json({ error: 'Unsupported gaming playbook kind' });

    res.json(playbooks.create({
      kind,
      goal,
      engine: req.body.engine ? String(req.body.engine) : undefined,
      genre: req.body.genre ? String(req.body.genre) : undefined,
      targetPlatform: req.body.targetPlatform ? String(req.body.targetPlatform) : undefined,
      constraints: Array.isArray(req.body.constraints) ? req.body.constraints.map(String) : undefined
    }));
  }));

  router.post('/api/gaming/engine', asyncHandler(async (req, res) => {
    const goal = String(req.body.goal || req.body.message || '').trim();
    if (!goal) return res.status(400).json({ error: 'goal is required' });

    res.json(playbooks.create({
      kind: 'engine_selection',
      goal,
      genre: req.body.genre ? String(req.body.genre) : undefined,
      targetPlatform: req.body.targetPlatform ? String(req.body.targetPlatform) : undefined,
      constraints: Array.isArray(req.body.constraints) ? req.body.constraints.map(String) : undefined
    }));
  }));

  router.post('/api/gaming/assets', asyncHandler(async (req, res) => {
    const goal = String(req.body.goal || req.body.message || '').trim();
    if (!goal) return res.status(400).json({ error: 'goal is required' });

    res.json(playbooks.create({
      kind: 'asset_pipeline',
      goal,
      engine: req.body.engine ? String(req.body.engine) : undefined,
      genre: req.body.genre ? String(req.body.genre) : undefined,
      targetPlatform: req.body.targetPlatform ? String(req.body.targetPlatform) : undefined,
      constraints: Array.isArray(req.body.constraints) ? req.body.constraints.map(String) : undefined
    }));
  }));

  router.post('/api/gaming/prompts', asyncHandler(async (req, res) => {
    const goal = String(req.body.goal || req.body.message || '').trim();
    if (!goal) return res.status(400).json({ error: 'goal is required' });

    res.json(playbooks.create({
      kind: 'prompt_pack',
      goal,
      engine: req.body.engine ? String(req.body.engine) : undefined,
      genre: req.body.genre ? String(req.body.genre) : undefined,
      targetPlatform: req.body.targetPlatform ? String(req.body.targetPlatform) : undefined,
      constraints: Array.isArray(req.body.constraints) ? req.body.constraints.map(String) : undefined
    }));
  }));

  return router;
}
