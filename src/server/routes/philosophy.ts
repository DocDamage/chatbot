import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { PhilosophyGeniusAgent } from '../../core/agents/philosophy/PhilosophyGeniusAgent';

export function createPhilosophyGeniusRouter(services: any = {}): Router {
  const router = Router();
  router.post('/api/philosophy/ask', asyncHandler(async (req, res) => {
    const agent = services?.philosophyGeniusAgent || new PhilosophyGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.ask(req.body.query || req.body.message || ''));
  }));
  router.post('/api/philosophy/argument', asyncHandler(async (req, res) => {
    const agent = services?.philosophyGeniusAgent || new PhilosophyGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.argument(req.body.query || req.body.message || ''));
  }));
  router.post('/api/philosophy/debate', asyncHandler(async (req, res) => {
    const agent = services?.philosophyGeniusAgent || new PhilosophyGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.debate(req.body.query || req.body.message || ''));
  }));
  router.post('/api/philosophy/ethics', asyncHandler(async (req, res) => {
    const agent = services?.philosophyGeniusAgent || new PhilosophyGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.ethics(req.body.query || req.body.message || ''));
  }));
  return router;
}
