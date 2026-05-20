import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { StoryGeniusAgent } from '../../core/agents/story/StoryGeniusAgent';

export function createStoryGeniusRouter(services: any = {}): Router {
  const router = Router();
  router.post('/api/story/ask', asyncHandler(async (req, res) => {
    const agent = services?.storyGeniusAgent || new StoryGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.ask(req.body.query || req.body.message || ''));
  }));
  router.post('/api/story/plot', asyncHandler(async (req, res) => {
    const agent = services?.storyGeniusAgent || new StoryGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.plot(req.body.query || req.body.message || ''));
  }));
  router.post('/api/story/character', asyncHandler(async (req, res) => {
    const agent = services?.storyGeniusAgent || new StoryGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.character(req.body.query || req.body.message || ''));
  }));
  router.post('/api/story/worldbuild', asyncHandler(async (req, res) => {
    const agent = services?.storyGeniusAgent || new StoryGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.worldbuild(req.body.query || req.body.message || ''));
  }));
  router.post('/api/story/dialogue', asyncHandler(async (req, res) => {
    const agent = services?.storyGeniusAgent || new StoryGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.dialogue(req.body.query || req.body.message || ''));
  }));
  router.post('/api/story/continuity', asyncHandler(async (req, res) => {
    const agent = services?.storyGeniusAgent || new StoryGeniusAgent(services?.ragDocumentStore);
    res.json(await agent.continuity(req.body.query || req.body.message || ''));
  }));
  return router;
}
