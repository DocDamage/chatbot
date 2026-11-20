import { Request, Router } from 'express';
import { z } from 'zod/v3';
import { asyncHandler } from '../../../middleware/errorHandler';
import { GameProjectContext } from '../../../core/gaming/project/GameProjectContext';
import { GameProjectRegistry } from '../../../core/gaming/project/GameProjectRegistry';
import { ProjectEnrollmentError } from '../../../core/gaming/project/ProjectEnrollmentTypes';
import { projectRelativePath } from '../../../core/gaming/project/ProjectFilePolicy';

export function createProjectContextRouter(registry?: GameProjectRegistry): Router {
  const router = Router(), context = registry ? new GameProjectContext(registry) : undefined;
  const scoped = (req: Request) => {
    if (!req.user?.userId) throw new ProjectEnrollmentError('PROJECT_OWNER_REQUIRED', 'Authenticate before reading project context.', 401);
    if (!context) throw new ProjectEnrollmentError('PROJECT_CONTEXT_UNAVAILABLE', 'Project context requires persistent enrollment.', 503);
    return { service: context, owner: { ownerId: req.user.userId, tenantId: 'local' } };
  };
  router.get('/api/game-studio/projects/:id/files', asyncHandler(async (req, res) => {
    const { service, owner } = scoped(req); res.set('Cache-Control', 'no-store').json(await service.files(owner, req.params.id));
  }));
  router.get('/api/game-studio/projects/:id/files/search', asyncHandler(async (req, res) => {
    const { service, owner } = scoped(req);
    if (typeof req.query.q !== 'string' || !req.query.q.trim() || req.query.q.length > 512) throw new ProjectEnrollmentError('INVALID_CONTEXT_QUERY', 'Provide a bounded text query.', 400);
    res.set('Cache-Control', 'no-store').json(await service.search(owner, req.params.id, req.query.q));
  }));
  router.post('/api/game-studio/projects/:id/context', asyncHandler(async (req, res) => {
    const { service, owner } = scoped(req);
    const file = z.string().min(1).max(2048).refine(value => { try { projectRelativePath(value); return true; } catch { return false; } });
    const input = z.object({ files: z.array(file).min(1).max(12), message: z.string().max(8000).default(''), automaticContext: z.boolean().default(true) }).safeParse(req.body);
    if (!input.success) throw new ProjectEnrollmentError('INVALID_CONTEXT_INPUT', 'Select one to twelve files and valid context options.', 400);
    res.set('Cache-Control', 'no-store').json(await service.select(owner, req.params.id, input.data.files, input.data.message, input.data.automaticContext));
  }));
  return router;
}
