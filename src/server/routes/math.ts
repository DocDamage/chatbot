import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';

export function createMathRouter(services: any): Router {
  const router = Router();

  router.post('/api/math/ask', asyncHandler(async (req, res) => {
    res.json(await services.mathGeniusAgent.solve(req.body.query || req.body.message || ''));
  }));

  router.post('/api/math/solve', asyncHandler(async (req, res) => {
    res.json(await services.mathGeniusAgent.solve(req.body.query || req.body.message || ''));
  }));

  router.post('/api/math/verify', asyncHandler(async (req, res) => {
    if (services.mathGeniusAgent.verifyQuery) {
      return res.json(await services.mathGeniusAgent.verifyQuery(req.body.query || req.body.message || ''));
    }
    res.json(await services.mathGeniusAgent.verify(req.body.answer || { content: '' }));
  }));

  return router;
}
