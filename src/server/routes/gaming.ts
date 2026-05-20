import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';

export function createGamingRouter(services: any): Router {
  const router = Router();

  router.post('/api/gaming/ask', asyncHandler(async (req, res) => {
    if (!services?.gamingGeniusAgent) {
      return res.status(503).json({ error: 'Gaming agent not initialized' });
    }
    res.json(await services.gamingGeniusAgent.ask(req.body.query || req.body.message || ''));
  }));

  return router;
}
