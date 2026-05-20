import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { KnowledgeMissHandler } from '../../core/knowledge/KnowledgeMissHandler';
import { OnlineKnowledgeIngestionService } from '../../core/knowledge/OnlineKnowledgeIngestionService';
import { WebSearcher } from '../../core/tools/WebSearcher';

export function createKnowledgeOnlineRouter(services: any): Router {
  const router = Router();
  const missHandler = new KnowledgeMissHandler();

  router.post('/api/knowledge-online/miss', asyncHandler(async (req, res) => {
    res.json(missHandler.createMiss(String(req.body.message || ''), String(req.body.domain || 'ask')));
  }));

  router.post('/api/knowledge-online/search', asyncHandler(async (req, res) => {
    const webSearcher = WebSearcher.fromEnv() as any;
    const service = new OnlineKnowledgeIngestionService(services.documentManager, webSearcher);
    res.json(await service.searchAndSummarize(String(req.body.query || ''), String(req.body.domain || 'ask')));
  }));

  router.post('/api/knowledge-online/ingest', asyncHandler(async (req, res) => {
    if (!services?.documentManager) return res.status(503).json({ error: 'Document manager not available' });
    const service = new OnlineKnowledgeIngestionService(services.documentManager, WebSearcher.fromEnv() as any);
    res.json(await service.ingestApproved(req.body.preview, String(req.body.sessionId || 'unknown-session')));
  }));

  return router;
}
