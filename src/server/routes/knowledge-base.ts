import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';

export function createKnowledgeBaseRouter(services: any): Router {
  const router = Router();

  router.get('/api/knowledge-base/stats', asyncHandler(async (_req, res) => {
    if (!services?.ragService) {
      return res.status(503).json({ error: 'RAG service not initialized' });
    }

    const stats = services.documentManager
      ? await services.documentManager.getStats()
      : {};
    res.json(stats);
  }));

  return router;
}
