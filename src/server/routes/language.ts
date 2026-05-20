import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { LanguageGeniusAgent } from '../../core/agents/language/LanguageGeniusAgent';

export function createLanguageGeniusRouter(services: any = {}): Router {
  const router = Router();
  router.post('/api/language/ask', asyncHandler(async (req, res) => {
    const agent = services?.languageGeniusAgent || new LanguageGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.ask(req.body.query || req.body.message || ''));
  }));
  router.post('/api/language/translate', asyncHandler(async (req, res) => {
    const agent = services?.languageGeniusAgent || new LanguageGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.translate(req.body.query || req.body.message || ''));
  }));
  router.post('/api/language/rewrite', asyncHandler(async (req, res) => {
    const agent = services?.languageGeniusAgent || new LanguageGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.rewrite(req.body.query || req.body.message || ''));
  }));
  router.post('/api/language/rhetoric', asyncHandler(async (req, res) => {
    const agent = services?.languageGeniusAgent || new LanguageGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.rhetoric(req.body.query || req.body.message || ''));
  }));
  router.post('/api/language/speech', asyncHandler(async (req, res) => {
    const agent = services?.languageGeniusAgent || new LanguageGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.speech(req.body.query || req.body.message || ''));
  }));
  return router;
}
