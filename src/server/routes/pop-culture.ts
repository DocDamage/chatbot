import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';

export function createPopCultureRouter(services: any): Router {
  const router = Router();
  router.post('/api/pop-culture/ask', asyncHandler(async (req, res) => res.json(await services.popCultureGeniusAgent.ask(req.body.query || ''))));
  router.post('/api/pop-culture/timeline', asyncHandler(async (req, res) => res.json(await services.popCultureGeniusAgent.timeline(req.body.query || ''))));
  router.post('/api/pop-culture/franchise', asyncHandler(async (req, res) => res.json(await services.popCultureGeniusAgent.franchise(req.body.query || ''))));
  router.post('/api/pop-culture/compare', asyncHandler(async (req, res) => res.json(await services.popCultureGeniusAgent.compare(req.body.query || ''))));
  return router;
}
