import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { MusicProductionGeniusAgent } from '../../core/agents/music/MusicProductionGeniusAgent';
import { MixGeniusAgent } from '../../core/agents/music/mix/MixGeniusAgent';

export function createMusicProductionGeniusRouter(services: any = {}): Router {
  const router = Router();
  const getAgent = () => services?.musicProductionGeniusAgent || new MusicProductionGeniusAgent({
    documentStore: services?.ragDocumentStore,
    suno: services?.sunoGeniusAgent,
    flStudio: services?.flStudioGeniusAgent,
    proTools: services?.proToolsGeniusAgent,
    logic: services?.logicProGeniusAgent
  });
  const getMixAgent = () => services?.mixGeniusAgent || new MixGeniusAgent(services?.flStudioControlAgent);

  router.post('/api/music/mix/analyze', asyncHandler(async (req, res) => {
    res.json(getMixAgent().analyze(req.body || {}));
  }));

  router.post('/api/music/mix/plan', asyncHandler(async (req, res) => {
    res.json(getMixAgent().plan(req.body || {}));
  }));

  router.post('/api/music/mix/apply', asyncHandler(async (req, res) => {
    res.json(await getMixAgent().apply(req.body || {}));
  }));

  router.post('/api/music/mix/revise', asyncHandler(async (req, res) => {
    res.json(getMixAgent().revise(req.body || {}));
  }));

  router.post('/api/music/mix/master', asyncHandler(async (req, res) => {
    res.json(getMixAgent().master(req.body || {}));
  }));

  router.post('/api/music/ask', asyncHandler(async (req, res) => {
    res.json(await getAgent().ask(req.body.query || req.body.message || ''));
  }));
  router.post('/api/music/suno', asyncHandler(async (req, res) => {
    res.json(await getAgent().sunoPrompt(req.body.query || req.body.message || ''));
  }));
  router.post('/api/music/fl-studio', asyncHandler(async (req, res) => {
    res.json(await getAgent().flStudioWorkflow(req.body.query || req.body.message || ''));
  }));
  router.post('/api/music/pro-tools', asyncHandler(async (req, res) => {
    res.json(await getAgent().proToolsWorkflow(req.body.query || req.body.message || ''));
  }));
  router.post('/api/music/logic', asyncHandler(async (req, res) => {
    res.json(await getAgent().logicWorkflow(req.body.query || req.body.message || ''));
  }));
  router.post('/api/music/beat', asyncHandler(async (req, res) => {
    res.json(await getAgent().beat(req.body.query || req.body.message || ''));
  }));
  router.post('/api/music/mix', asyncHandler(async (req, res) => {
    res.json(await getAgent().mix(req.body.query || req.body.message || ''));
  }));
  router.post('/api/music/master', asyncHandler(async (req, res) => {
    res.json(await getAgent().master(req.body.query || req.body.message || ''));
  }));
  router.post('/api/music/arrangement', asyncHandler(async (req, res) => {
    res.json(await getAgent().arrangement(req.body.query || req.body.message || ''));
  }));
  router.post('/api/music/daw-translate', asyncHandler(async (req, res) => {
    res.json(await getAgent().dawTranslate(req.body.query || req.body.message || ''));
  }));
  router.post('/api/music/theory', asyncHandler(async (req, res) => {
    res.json(await getAgent().theory(req.body.query || req.body.message || ''));
  }));
  router.post('/api/music/genre-timeline', asyncHandler(async (req, res) => {
    res.json(await getAgent().genreTimeline(req.body.query || req.body.message || ''));
  }));
  router.post('/api/music/arrangement-review', asyncHandler(async (req, res) => {
    res.json(await getAgent().arrangementReview(req.body.query || req.body.message || ''));
  }));
  return router;
}

export const createMusicRouter = createMusicProductionGeniusRouter;
