import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';

export function createMarketRouter(services: any): Router {
  const router = Router();

  router.post('/api/market/analyze', asyncHandler(async (req, res) => {
    res.json(await services.marketGeniusAgent.analyze(req.body.query || req.body.message || ''));
  }));

  router.post('/api/market/backtest', asyncHandler(async (req, res) => {
    res.json(await services.marketGeniusAgent.backtest(req.body.query || req.body.message || ''));
  }));

  router.post('/api/market/filing', asyncHandler(async (req, res) => {
    res.json(await services.marketGeniusAgent.filing(req.body.query || req.body.message || ''));
  }));

  router.post('/api/market/macro', asyncHandler(async (_req, res) => {
    res.json(await services.marketGeniusAgent.macro());
  }));

  return router;
}
