import { Router } from 'express';
import { z } from 'zod';
import { CreativeWritingAgent } from '../../core/creative/CreativeWritingAgent';
import { creativeRequestSchema } from '../../core/creative/CreativeTypes';
import { asyncHandler } from '../../middleware/errorHandler';
import { ValidationError } from '../../utils/errors';

type CreativeAgent = Pick<CreativeWritingAgent,
  | 'draftScene'
  | 'continueScene'
  | 'revisePassage'
  | 'outlineNovel'
  | 'buildCharacter'
  | 'buildWorld'
  | 'roleplayTurn'
  | 'summarizeContinuity'
  | 'exportDraft'
>;

const routeSchema = creativeRequestSchema.extend({
  prompt: z.string().min(1).max(20000),
});

export function createCreativeWritingRouter(services: any = {}): Router {
  const router = Router();
  const getAgent = (): CreativeAgent => services?.creativeWritingAgent || new CreativeWritingAgent();

  router.post('/api/creative/draft-scene', asyncHandler(async (req, res) => {
    const parsed = parseCreativeRequest(req.body, 'draft_scene');
    res.json(await getAgent().draftScene(parsed));
  }));

  router.post('/api/creative/continue-scene', asyncHandler(async (req, res) => {
    const parsed = parseCreativeRequest(req.body, 'continue_scene');
    res.json(await getAgent().continueScene(parsed));
  }));

  router.post('/api/creative/revise', asyncHandler(async (req, res) => {
    const parsed = parseCreativeRequest(req.body, 'revise_passage');
    res.json(await getAgent().revisePassage(parsed));
  }));

  router.post('/api/creative/outline', asyncHandler(async (req, res) => {
    const parsed = parseCreativeRequest(req.body, 'outline_novel');
    res.json(await getAgent().outlineNovel(parsed));
  }));

  router.post('/api/creative/character', asyncHandler(async (req, res) => {
    const parsed = parseCreativeRequest(req.body, 'build_character');
    res.json(await getAgent().buildCharacter(parsed));
  }));

  router.post('/api/creative/world', asyncHandler(async (req, res) => {
    const parsed = parseCreativeRequest(req.body, 'build_world');
    res.json(await getAgent().buildWorld(parsed));
  }));

  router.post('/api/creative/roleplay-turn', asyncHandler(async (req, res) => {
    const parsed = parseCreativeRequest(req.body, 'roleplay_turn');
    res.json(await getAgent().roleplayTurn(parsed));
  }));

  router.post('/api/creative/continuity-summary', asyncHandler(async (req, res) => {
    const parsed = parseCreativeRequest(req.body, 'summarize_continuity');
    res.json(await getAgent().summarizeContinuity(parsed));
  }));

  router.post('/api/creative/export', asyncHandler(async (req, res) => {
    const parsed = parseCreativeRequest(req.body, 'export_draft');
    res.json(await getAgent().exportDraft(parsed));
  }));

  return router;
}

function parseCreativeRequest(body: unknown, operation: string) {
  const result = routeSchema.safeParse({
    ...(typeof body === 'object' && body ? body : {}),
    operation,
  });

  if (!result.success) {
    throw new ValidationError('Invalid creative request', { errors: result.error.errors });
  }

  return result.data;
}
