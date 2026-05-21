import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { SpriteLabPlanService } from '../../core/sprite-lab/SpriteLabPlanService';

export function createSpriteLabRouter(services: any, workspaceRoot = process.cwd()): Router {
  const router = Router();

  const getService = () => new SpriteLabPlanService(services?.database, workspaceRoot);

  router.get('/api/sprite-lab/status', asyncHandler(async (_req, res) => {
    res.json(await getService().getStatus());
  }));

  router.post('/api/sprite-lab/plan', asyncHandler(async (req, res) => {
    const workflow = sanitizeInput(String(req.body.workflow || '')) as any;
    const inputPath = sanitizeInput(String(req.body.inputPath || ''));
    const outputTarget = req.body.outputTarget ? sanitizeInput(String(req.body.outputTarget)) : undefined;

    if (!workflow.trim() || !inputPath.trim()) {
      return res.status(400).json({ error: 'workflow and inputPath are required' });
    }

    res.json(await getService().planWorkflow({ workflow, inputPath, outputTarget }));
  }));

  return router;
}
