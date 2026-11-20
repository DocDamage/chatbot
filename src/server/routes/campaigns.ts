import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod/v3';
import { CampaignService } from '../../core/campaign/CampaignService';
import { playerView } from '../../core/campaign/CampaignTypes';
import { requireAuth, requireCsrfForStateChange } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { ServiceUnavailableError, ValidationError } from '../../utils/errors';

export function createCampaignRouter(services: { campaignService?: CampaignService }) {
  const router = Router();
  router.use(requireAuth, requireCsrfForStateChange);
  const service = () => services.campaignService || (() => { throw new ServiceUnavailableError('Campaigns', 'Campaigns require the persistent local database.'); })();
  const id = z.string().uuid();
  const version = z.number().int().min(0);
  const parse = <T>(schema: z.ZodType<T>, input: unknown): T => {
    const value = schema.safeParse(input);
    if (!value.success) throw new ValidationError('Invalid campaign request', { issues: value.error.issues });
    return value.data;
  };
  router.get('/', asyncHandler(async (req, res) => res.json(await service().repository.list(req.user!.userId))));
  router.post('/', asyncHandler(async (req, res) => res.status(201).json(playerView(await service().create(req.user!.userId, req.body)))));
  router.post('/import', multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }).single('file'), asyncHandler(async (req, res) => {
    const format = parse(z.enum(['dmt', 'campfire', 'chatbot']), req.body.format);
    const edition = parse(z.enum(['5e-2014', '5e-2024']).default('5e-2024'), req.body.edition);
    let input: unknown = req.body.data;
    if (req.file) {
      if (format === 'dmt' && req.file.originalname.toLowerCase().endsWith('.dmtz')) input = req.file.buffer;
      else { try { input = JSON.parse(req.file.buffer.toString('utf8')); } catch { throw new ValidationError('Choose a JSON campaign export or a .dmtz world archive.'); } }
    }
    res.status(201).json(playerView(await service().import(req.user!.userId, format, input, edition ?? '5e-2024')));
  }));
  router.get('/:id', asyncHandler(async (req, res) => res.json(await service().view(parse(id, req.params.id), req.user!.userId, req.query.view === 'dm'))));
  router.get('/:id/export', asyncHandler(async (req, res) => res.json(await service().export(parse(id, req.params.id), req.user!.userId, req.query.view === 'dm'))));
  router.post('/:id/actions', asyncHandler(async (req, res) => {
    const body = parse(z.object({ action: z.unknown(), version, view: z.enum(['player', 'dm']).default('player') }).strict(), req.body);
    res.json(await service().act(parse(id, req.params.id), req.user!.userId, body.action, body.version, body.view === 'dm'));
  }));
  router.post('/:id/turn', asyncHandler(async (req, res) => {
    const body = parse(z.object({ message: z.string().trim().min(1).max(4000), version }).strict(), req.body);
    res.json(await service().talk(parse(id, req.params.id), req.user!.userId, body.message, body.version));
  }));
  // Surface deep domain-schema failures as validation errors, without dumping private saves.
  router.use((error: unknown, _req: unknown, _res: unknown, next: (e: unknown) => void) => next(error instanceof z.ZodError ? new ValidationError('Invalid campaign data', { issues: error.issues }) : error));
  return router;
}
