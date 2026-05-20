import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { SecurityGeniusAgent } from '../../core/agents/security/SecurityGeniusAgent';

export function createSecurityGeniusRouter(services: any = {}): Router {
  const router = Router();
  router.post('/api/security/ask', asyncHandler(async (req, res) => {
    const agent = services?.securityGeniusAgent || new SecurityGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.ask(req.body.query || req.body.message || ''));
  }));
  router.post('/api/security/review-code', asyncHandler(async (req, res) => {
    const agent = services?.securityGeniusAgent || new SecurityGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.reviewCode(req.body.query || req.body.message || ''));
  }));
  router.post('/api/security/threat-model', asyncHandler(async (req, res) => {
    const agent = services?.securityGeniusAgent || new SecurityGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.threatModel(req.body.query || req.body.message || ''));
  }));
  router.post('/api/security/privacy', asyncHandler(async (req, res) => {
    const agent = services?.securityGeniusAgent || new SecurityGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.privacy(req.body.query || req.body.message || ''));
  }));
  router.post('/api/security/dependencies', asyncHandler(async (req, res) => {
    const agent = services?.securityGeniusAgent || new SecurityGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.dependencies(req.body.query || req.body.message || ''));
  }));
  return router;
}
