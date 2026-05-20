import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { HealthGeniusAgent } from '../../core/agents/health/HealthGeniusAgent';

export function createHealthGeniusRouter(services: any = {}): Router {
  const router = Router();
  router.post('/api/health/ask', asyncHandler(async (req, res) => {
    const agent = services?.healthGeniusAgent || new HealthGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.ask(req.body.query || req.body.message || ''));
  }));
  router.post('/api/health/anatomy', asyncHandler(async (req, res) => {
    const agent = services?.healthGeniusAgent || new HealthGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.anatomy(req.body.query || req.body.message || ''));
  }));
  router.post('/api/health/fitness', asyncHandler(async (req, res) => {
    const agent = services?.healthGeniusAgent || new HealthGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.fitness(req.body.query || req.body.message || ''));
  }));
  router.post('/api/health/nutrition', asyncHandler(async (req, res) => {
    const agent = services?.healthGeniusAgent || new HealthGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.nutrition(req.body.query || req.body.message || ''));
  }));
  router.post('/api/health/red-flags', asyncHandler(async (req, res) => {
    const agent = services?.healthGeniusAgent || new HealthGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.redFlags(req.body.query || req.body.message || ''));
  }));
  router.post('/api/health/medication', asyncHandler(async (req, res) => {
    const agent = services?.healthGeniusAgent || new HealthGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.medication(req.body.query || req.body.message || ''));
  }));
  return router;
}
