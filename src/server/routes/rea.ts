import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../middleware/errorHandler';
import { ReaService } from '../../core/rea/ReaService';
import { ReaError } from '../../core/rea/ReaConfig';

export function createReaRouter(services: { reaService?: ReaService }): Router {
  const router = Router();
  const service = () => {
    if (!services.reaService) throw new ReaError('REA service is unavailable.', 503);
    return services.reaService;
  };
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: services.reaService?.config.maxInputBytes || 134217728, files: 1, fields: 2 } });
  router.get('/status', (_req, res) => res.json(service().status()));
  router.get('/jobs', (req, res) => res.json({ jobs: service().list(req.user!.userId) }));
  router.post('/jobs', asyncHandler(async (req, res) => {
    if (typeof req.body?.path !== 'string' || (req.body.operation !== undefined && typeof req.body.operation !== 'string')
      || (req.body.procedure !== undefined && typeof req.body.procedure !== 'string')) throw new ReaError('Invalid analysis request.');
    res.status(202).json(service().start(req.user!.userId, req.body.path, req.body.operation, req.body.procedure));
  }));
  router.post('/upload', (req, res, next) => upload.single('artifact')(req, res, error => {
    next(error ? new ReaError(error.message, error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'REA_UPLOAD_ERROR') : undefined);
  }), asyncHandler(async (req, res) => {
    if (!req.file) throw new ReaError('Select an artifact to upload.');
    res.status(202).json(service().upload(req.user!.userId, req.file.originalname, req.file.buffer, req.body.operation, req.body.procedure));
  }));
  router.get('/jobs/:id', (req, res) => res.json(service().get(req.params.id, req.user!.userId)));
  router.post('/jobs/:id/cancel', (req, res) => res.json(service().cancel(req.params.id, req.user!.userId)));
  router.delete('/jobs/:id', (req, res) => { service().delete(req.params.id, req.user!.userId); res.sendStatus(204); });
  router.get('/jobs/:id/evidence', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.download(service().evidence(req.params.id, req.user!.userId), `rea-${req.params.id}-evidence.json`);
  });
  return router;
}
