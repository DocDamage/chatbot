import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';

export function createHistoryRouter(services: any): Router {
  const router = Router();
  router.post('/api/history/ask', asyncHandler(async (req, res) => res.json(await services.historyGeniusAgent.ask(req.body.query || ''))));
  router.post('/api/history/timeline', asyncHandler(async (req, res) => res.json(await services.historyGeniusAgent.timeline(req.body.query || ''))));
  router.post('/api/history/compare', asyncHandler(async (req, res) => res.json(await services.historyGeniusAgent.compare(req.body.query || ''))));
  router.post('/api/history/primary-sources', asyncHandler(async (req, res) => res.json(await services.historyGeniusAgent.primarySources(req.body.query || ''))));
  return router;
}
