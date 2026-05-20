import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { LegalCivicGeniusAgent } from '../../core/agents/legal/LegalCivicGeniusAgent';

export function createLegalCivicGeniusRouter(services: any = {}): Router {
  const router = Router();
  router.post('/api/legal/ask', asyncHandler(async (req, res) => {
    const agent = services?.legalCivicGeniusAgent || new LegalCivicGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.ask(req.body.query || req.body.message || ''));
  }));
  router.post('/api/legal/contract', asyncHandler(async (req, res) => {
    const agent = services?.legalCivicGeniusAgent || new LegalCivicGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.contract(req.body.query || req.body.message || ''));
  }));
  router.post('/api/legal/risk', asyncHandler(async (req, res) => {
    const agent = services?.legalCivicGeniusAgent || new LegalCivicGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.risk(req.body.query || req.body.message || ''));
  }));
  router.post('/api/legal/civic', asyncHandler(async (req, res) => {
    const agent = services?.legalCivicGeniusAgent || new LegalCivicGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.civic(req.body.query || req.body.message || ''));
  }));
  return router;
}
