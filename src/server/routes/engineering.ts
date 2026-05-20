import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { EngineeringGeniusAgent } from '../../core/agents/engineering/EngineeringGeniusAgent';

export function createEngineeringGeniusRouter(services: any = {}): Router {
  const router = Router();
  router.post('/api/engineering/ask', asyncHandler(async (req, res) => {
    const agent = services?.engineeringGeniusAgent || new EngineeringGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.ask(req.body.query || req.body.message || ''));
  }));
  router.post('/api/engineering/electronics', asyncHandler(async (req, res) => {
    const agent = services?.engineeringGeniusAgent || new EngineeringGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.electronics(req.body.query || req.body.message || ''));
  }));
  router.post('/api/engineering/robotics', asyncHandler(async (req, res) => {
    const agent = services?.engineeringGeniusAgent || new EngineeringGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.robotics(req.body.query || req.body.message || ''));
  }));
  router.post('/api/engineering/mechanical', asyncHandler(async (req, res) => {
    const agent = services?.engineeringGeniusAgent || new EngineeringGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.mechanical(req.body.query || req.body.message || ''));
  }));
  router.post('/api/engineering/bom', asyncHandler(async (req, res) => {
    const agent = services?.engineeringGeniusAgent || new EngineeringGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.bom(req.body.query || req.body.message || ''));
  }));
  return router;
}
