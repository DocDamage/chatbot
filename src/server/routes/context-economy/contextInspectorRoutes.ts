/**
 * Context Economy & Inspector Express Router (PX-03 / PX03-T08)
 * Endpoints for context inspection, reversible retrieval, benchmark execution,
 * and failure learning review.
 */

import { Router, Request, Response } from 'express';
import { ContextContentRouter } from '../../../core/context-economy/router/ContextContentRouter';
import { ReversibleContextStore } from '../../../core/context-economy/reversible-store/ReversibleContextStore';
import { ContextBenchmarkSuite } from '../../../core/context-economy/evaluation/ContextBenchmarkSuite';
import { ContextFailureLearningService } from '../../../core/context-economy/learning/ContextFailureLearningService';
import { logger } from '../../../core/observability/logger';

export function createContextEconomyRouter(): Router {
  const router = Router();
  const contentRouter = ContextContentRouter.getInstance();
  const store = ReversibleContextStore.getInstance();
  const benchmarkSuite = new ContextBenchmarkSuite();
  const learningService = ContextFailureLearningService.getInstance();

  // POST /api/context-economy/compress - Classify and compress text
  router.post('/compress', (req: Request, res: Response) => {
    try {
      const { text, filename } = req.body || {};
      if (typeof text !== 'string') {
        return res.status(400).json({ error: 'text must be a string' });
      }
      if (Buffer.byteLength(text, 'utf8') > 1024 * 1024) {
        return res.status(413).json({ error: 'text exceeds the 1 MB context compression limit' });
      }

      const userId = req.user?.userId || 'anonymous';
      const result = contentRouter.routeAndCompress({
        text,
        filename,
        ownerId: userId,
        storeOriginal: true
      });

      res.json({ result });
    } catch (error: any) {
      logger.error('Failed to compress context', { error: error.message });
      res.status(500).json({ error: 'Failed to compress context' });
    }
  });

  // GET /api/context-economy/retrieve/:key - Reversible verbatim retrieval
  router.get('/retrieve/:key', (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId || 'anonymous';
      const roles = req.user?.roles || [];
      const isAdmin = roles.includes('admin');

      const retrieved = store.retrieve(req.params.key, { userId, isAdmin });
      if (!retrieved.success) {
        return res.status(404).json({ error: retrieved.reason });
      }

      res.json({
        contextKey: req.params.key,
        content: retrieved.content,
        metadata: retrieved.record
      });
    } catch (error: any) {
      logger.error('Failed to retrieve context', { key: req.params.key, error: error.message });
      res.status(500).json({ error: 'Failed to retrieve context' });
    }
  });

  // POST /api/context-economy/benchmark - Run benchmark suite
  router.post('/benchmark', async (_req: Request, res: Response) => {
    try {
      const result = await benchmarkSuite.runBenchmark();
      res.json({ benchmark: result });
    } catch (error: any) {
      logger.error('Failed to run context benchmark suite', { error: error.message });
      res.status(500).json({ error: 'Failed to run context benchmark suite' });
    }
  });

  // GET /api/context-economy/proposals - List failure learning proposals
  router.get('/proposals', (_req: Request, res: Response) => {
    try {
      const proposals = learningService.listProposals();
      res.json({ proposals });
    } catch (error: any) {
      logger.error('Failed to list failure proposals', { error: error.message });
      res.status(500).json({ error: 'Failed to list failure proposals' });
    }
  });

  // POST /api/context-economy/proposals/:id/review - Review proposal
  router.post('/proposals/:id/review', (req: Request, res: Response) => {
    try {
      const { decision } = req.body || {};
      if (decision !== 'approved' && decision !== 'rejected') {
        return res.status(400).json({ error: 'decision must be approved or rejected' });
      }

      const reviewerId = req.user?.userId || 'Operator';
      const success = learningService.reviewProposal(req.params.id, reviewerId, decision);
      if (!success) {
        return res.status(404).json({ error: `Proposal '${req.params.id}' not found` });
      }

      res.json({ success: true, message: `Proposal '${req.params.id}' ${decision}.` });
    } catch (error: any) {
      logger.error('Failed to review proposal', { id: req.params.id, error: error.message });
      res.status(500).json({ error: 'Failed to review proposal' });
    }
  });

  return router;
}
