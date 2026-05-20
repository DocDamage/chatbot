import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { GeoCultureGeniusAgent } from '../../core/agents/geography/GeoCultureGeniusAgent';

export function createGeoCultureGeniusRouter(services: any = {}): Router {
  const router = Router();
  router.post('/api/geography/ask', asyncHandler(async (req, res) => {
    const agent = services?.geoCultureGeniusAgent || new GeoCultureGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.ask(req.body.query || req.body.message || ''));
  }));
  router.post('/api/geography/country', asyncHandler(async (req, res) => {
    const agent = services?.geoCultureGeniusAgent || new GeoCultureGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.country(req.body.query || req.body.message || ''));
  }));
  router.post('/api/geography/culture', asyncHandler(async (req, res) => {
    const agent = services?.geoCultureGeniusAgent || new GeoCultureGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.culture(req.body.query || req.body.message || ''));
  }));
  router.post('/api/geography/map-context', asyncHandler(async (req, res) => {
    const agent = services?.geoCultureGeniusAgent || new GeoCultureGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.mapContext(req.body.query || req.body.message || ''));
  }));
  return router;
}
