import { Request, Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { GameProjectSessions } from '../../../core/gaming/project/GameProjectSessions';
import { ProjectEnrollmentError } from '../../../core/gaming/project/ProjectEnrollmentTypes';
import { EngineExportPreset } from '../../../core/gaming/engine/GameEngineTypes';

export function createProjectSessionRouter(sessions?: GameProjectSessions): Router {
  const router = Router();
  const scoped = (req: Request, needsSession = true) => {
    if (!req.user?.userId) throw new ProjectEnrollmentError('PROJECT_OWNER_REQUIRED', 'Authenticate before using an engine session.', 401);
    if (!sessions) throw new ProjectEnrollmentError('PROJECT_SESSIONS_UNAVAILABLE', 'Engine sessions require persistent project enrollment.', 503);
    const id = req.body?.sessionId ?? req.query.sessionId;
    if (needsSession && (typeof id !== 'string' || !id.trim() || id.length > 128)) throw new ProjectEnrollmentError('PROJECT_SESSION_REQUIRED', 'Use the sessionId returned by connecting an enrolled project.', 400);
    if (needsSession) sessions.validateSelector({ ownerId: req.user.userId, tenantId: 'local' }, id, req.body?.engine ?? req.query.engine, req.body?.projectId ?? req.query.projectId);
    return { service: sessions, owner: { ownerId: req.user.userId, tenantId: 'local' }, id: id as string };
  };
  router.post('/api/game-studio/connect', asyncHandler(async (req, res) => {
    const { service, owner } = scoped(req, false);
    if (typeof req.body.projectId !== 'string' || !req.body.projectId.trim()) throw new ProjectEnrollmentError('PROJECT_ENROLLMENT_REQUIRED', 'Enroll the project and select an exact runtime before connecting; projectRoot cannot select a mutable session.', 400);
    res.json(await service.connect(owner, req.body.projectId, req.body.engine));
  }));
  router.get('/api/game-studio/sessions', asyncHandler(async (req, res) => {
    const { service, owner } = scoped(req, false);
    res.json({ sessions: service.list(owner), freshness: 'not_checked' });
  }));
  router.get('/api/game-studio/sessions/:id', asyncHandler(async (req, res) => {
    const { service, owner } = scoped(req, false);
    res.json(await service.status(owner, req.params.id));
  }));
  router.post('/api/game-studio/disconnect', asyncHandler(async (req, res) => {
    const { service, owner, id } = scoped(req); await service.disconnect(owner, id);
    res.json({ success: true, sessionId: id });
  }));
  for (const kind of ['project', 'scene', 'script'] as const) router.get(`/api/game-studio/${kind}`, asyncHandler(async (req, res) => {
    const { service, owner, id } = scoped(req);
    res.json(await service.inspect(owner, id, kind, typeof req.query.path === 'string' ? req.query.path : undefined));
  }));
  router.post('/api/game-studio/proposals', asyncHandler(async (req, res) => {
    const { service, owner, id } = scoped(req);
    res.json(await service.propose(owner, id, { title: req.body.title || 'Studio Proposal', description: req.body.description || '', risk: req.body.risk || 'medium', actions: req.body.actions || [] }));
  }));
  router.post('/api/game-studio/proposals/:id/approve', asyncHandler(async (req, res) => {
    const { service, owner, id } = scoped(req);
    res.json(await service.approve(owner, id, req.params.id));
  }));
  router.post('/api/game-studio/proposals/:id/apply', asyncHandler(async (req, res) => {
    const { service, owner, id } = scoped(req);
    res.json(await service.apply(owner, id, req.params.id, req.body.approvalDigest || ''));
  }));
  router.post('/api/game-studio/transactions/:id/rollback', asyncHandler(async (req, res) => {
    const { service, owner, id } = scoped(req);
    res.json({ success: await service.rollback(owner, id, req.params.id), transactionId: req.params.id, sessionId: id });
  }));
  router.post('/api/game-studio/runtime/scenario', asyncHandler(async (req, res) => {
    const { service, owner, id } = scoped(req);
    if (req.body.assertions !== undefined && !Array.isArray(req.body.assertions)) throw new ProjectEnrollmentError('INVALID_SESSION_ASSERTIONS', 'Assertions must be an array.', 400);
    if (req.body.headless !== undefined && typeof req.body.headless !== 'boolean') throw new ProjectEnrollmentError('INVALID_RUNTIME_OPTIONS', 'headless must be a boolean.', 400);
    res.json(await service.scenario(owner, id, { scenePath: req.body.scenePath, headless: req.body.headless }, req.body.assertions || []));
  }));
  router.get('/api/game-studio/profiler', asyncHandler(async (req, res) => {
    const { service, owner, id } = scoped(req); res.json(await service.profile(owner, id));
  }));
  router.post('/api/game-studio/export', asyncHandler(async (req, res) => {
    const { service, owner, id } = scoped(req);
    res.json(await service.export(owner, id, { name: req.body.name || 'Default', platform: (req.body.platform || 'windows') as EngineExportPreset['platform'],
      exportPath: req.body.exportPath || 'builds/game', templateVersion: req.body.templateVersion || 'installed', ...(req.body.customOptions ? { customOptions: req.body.customOptions } : {}) }));
  }));
  return router;
}
