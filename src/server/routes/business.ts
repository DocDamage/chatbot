import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { BusinessGeniusAgent } from '../../core/agents/business/BusinessGeniusAgent';

export function createBusinessGeniusRouter(services: any = {}): Router {
  const router = Router();
  router.post('/api/business/ask', asyncHandler(async (req, res) => {
    const agent = services?.businessGeniusAgent || new BusinessGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.ask(req.body.query || req.body.message || ''));
  }));
  router.post('/api/business/plan', asyncHandler(async (req, res) => {
    const agent = services?.businessGeniusAgent || new BusinessGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.plan(req.body.query || req.body.message || ''));
  }));
  router.post('/api/business/pricing', asyncHandler(async (req, res) => {
    const agent = services?.businessGeniusAgent || new BusinessGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.pricing(req.body.query || req.body.message || ''));
  }));
  router.post('/api/business/market', asyncHandler(async (req, res) => {
    const agent = services?.businessGeniusAgent || new BusinessGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.market(req.body.query || req.body.message || ''));
  }));
  router.post('/api/business/unit-economics', asyncHandler(async (req, res) => {
    const agent = services?.businessGeniusAgent || new BusinessGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.unitEconomics(req.body.query || req.body.message || ''));
  }));
  return router;
}
