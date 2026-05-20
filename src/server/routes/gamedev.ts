import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';

export function createGameDevRouter(services: any): Router {
  const router = Router();

  router.post('/api/gamedev/design', asyncHandler(async (req, res) => {
    res.json(await services.gameDevGeniusAgent.answer(req.body.query || req.body.message || ''));
  }));

  router.post('/api/gamedev/prototype', asyncHandler(async (req, res) => {
    res.json(await services.gameDevGeniusAgent.prototype(req.body.query || req.body.message || ''));
  }));

  router.post('/api/gamedev/balance', asyncHandler(async (req, res) => {
    res.json(await services.gameDevGeniusAgent.balance(req.body.query || req.body.message || ''));
  }));

  router.post('/api/gamedev/review', asyncHandler(async (req, res) => {
    res.json(await services.gameDevGeniusAgent.review(req.body.query || req.body.message || ''));
  }));

  return router;
}
