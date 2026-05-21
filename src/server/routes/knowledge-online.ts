import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { KnowledgeMissHandler } from '../../core/knowledge/KnowledgeMissHandler';
import { KnowledgeOnlineFlowService } from '../../core/knowledge/KnowledgeOnlineFlowService';
import { OnlineKnowledgeIngestionService } from '../../core/knowledge/OnlineKnowledgeIngestionService';
import { WebSearcher } from '../../core/tools/WebSearcher';

export function createKnowledgeOnlineRouter(services: any): Router {
  const router = Router();
  const missHandler = new KnowledgeMissHandler();

  const createOnlineService = () => new OnlineKnowledgeIngestionService(services.documentManager, WebSearcher.fromEnv() as any);

  router.post('/api/knowledge-online/miss', asyncHandler(async (req, res) => {
    res.json(missHandler.createMiss(String(req.body.message || ''), String(req.body.domain || 'ask')));
  }));

  router.post('/api/knowledge-online/check', asyncHandler(async (req, res) => {
    const question = String(req.body.question || req.body.query || '');
    if (!question.trim()) return res.status(400).json({ error: 'question is required' });

    const flow = new KnowledgeOnlineFlowService({
      ragService: services?.ragService,
      missHandler
    }, req.body.confidenceThreshold ? Number(req.body.confidenceThreshold) : undefined);

    res.json(await flow.answerOrRequestResearch({
      question,
      domain: String(req.body.domain || 'ask'),
      confidenceThreshold: req.body.confidenceThreshold ? Number(req.body.confidenceThreshold) : undefined
    }));
  }));

  router.post('/api/knowledge-online/search', asyncHandler(async (req, res) => {
    const webSearcher = WebSearcher.fromEnv() as any;
    const service = new OnlineKnowledgeIngestionService(services.documentManager, webSearcher);
    res.json(await service.searchAndSummarize(String(req.body.query || ''), String(req.body.domain || 'ask')));
  }));

  router.post('/api/knowledge-online/search-and-ingest', asyncHandler(async (req, res) => {
    if (!services?.documentManager) return res.status(503).json({ error: 'Document manager not available' });

    const query = String(req.body.query || '');
    if (!query.trim()) return res.status(400).json({ error: 'query is required' });

    const flow = new KnowledgeOnlineFlowService({
      onlineKnowledgeService: createOnlineService(),
      missHandler
    });

    res.json(await flow.searchAndMaybeIngest({
      query,
      domain: String(req.body.domain || 'ask'),
      approved: req.body.approved === true,
      approvedBy: req.user?.userId || String(req.body.approvedBy || ''),
      notes: String(req.body.notes || '')
    }));
  }));

  router.post('/api/knowledge-online/ingest', asyncHandler(async (req, res) => {
    if (!services?.documentManager) return res.status(503).json({ error: 'Document manager not available' });
    const service = new OnlineKnowledgeIngestionService(services.documentManager, WebSearcher.fromEnv() as any);
    res.json(await service.ingestApproved(req.body.preview, {
      approved: req.body.approved === true,
      approvedBy: req.user?.userId || String(req.body.approvedBy || ''),
      notes: String(req.body.notes || '')
    }));
  }));

  router.delete('/api/knowledge-online/ingest/:ingestionId', asyncHandler(async (req, res) => {
    if (!services?.documentManager) return res.status(503).json({ error: 'Document manager not available' });
    const service = new OnlineKnowledgeIngestionService(services.documentManager, WebSearcher.fromEnv() as any);
    res.json(await service.rollbackIngestion(req.params.ingestionId));
  }));

  return router;
}
