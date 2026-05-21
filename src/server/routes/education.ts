import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { EducationService } from '../../core/education/EducationService';

export function createEducationRouter(services: any): Router {
  const router = Router();

  const getService = () => new EducationService(services?.database);

  router.get('/api/education/sources', asyncHandler(async (_req, res) => {
    res.json({ sources: await getService().listSources() });
  }));

  router.get('/api/education/stats', asyncHandler(async (_req, res) => {
    res.json(await getService().getStats());
  }));

  router.post('/api/education/plans', asyncHandler(async (req, res) => {
    const title = sanitizeInput(String(req.body.title || ''));
    const goal = sanitizeInput(String(req.body.goal || ''));
    if (!title.trim() || !goal.trim()) {
      return res.status(400).json({ error: 'title and goal are required' });
    }

    res.json(await getService().createPlan({
      title,
      goal,
      level: req.body.level ? sanitizeInput(String(req.body.level)) : undefined,
      sources: Array.isArray(req.body.sources) ? req.body.sources.map(String) : undefined,
      milestones: Array.isArray(req.body.milestones) ? req.body.milestones.map(String) : undefined
    }));
  }));

  return router;
}
