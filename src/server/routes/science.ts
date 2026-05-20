import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';

export function createScienceRouter(services: any): Router {
  const router = Router();
  router.post('/api/science/ask', asyncHandler(async (req, res) => res.json(await services.scienceInventionGeniusAgent.ask(req.body.query || ''))));
  router.post('/api/science/invention', asyncHandler(async (req, res) => res.json(await services.scienceInventionGeniusAgent.invention(req.body.query || ''))));
  router.post('/api/science/timeline', asyncHandler(async (req, res) => res.json(await services.scienceInventionGeniusAgent.timeline(req.body.query || ''))));
  router.post('/api/science/papers', asyncHandler(async (req, res) => res.json(await services.scienceInventionGeniusAgent.papers(req.body.query || ''))));
  router.post('/api/science/patents', asyncHandler(async (req, res) => res.json(await services.scienceInventionGeniusAgent.patents(req.body.query || ''))));
  return router;
}
