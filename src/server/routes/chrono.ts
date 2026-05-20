import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';

export function createChronoRouter(services: any): Router {
  const router = Router();
  router.post('/api/chrono/ask', asyncHandler(async (req, res) => {
    res.json(await services.chronoKnowledgeEngine.ask({
      query: req.body.query || '',
      domain: req.body.domain || 'history',
      timeRange: req.body.timeRange,
      includeTimeline: req.body.includeTimeline,
      sourceMode: req.body.sourceMode
    }));
  }));
  return router;
}
