import { Request, Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { GameProjectRegistry } from '../../../core/gaming/project/GameProjectRegistry';
import { EngineKind } from '../../../core/gaming/project/EngineVersions';
import { ProfileSelection, ProjectEnrollmentError } from '../../../core/gaming/project/ProjectEnrollmentTypes';
import { hasControlCharacters, isWellFormedUnicode } from '../../../core/gaming/project/Unicode';

const kinds = ['godot', 'unity', 'unreal', 'rpg-maker-mz'];

function engine(value: unknown): EngineKind {
  if (typeof value !== 'string' || !kinds.includes(value)) throw new ProjectEnrollmentError('INVALID_PROJECT_ENGINE', 'Select godot, unity, unreal or rpg-maker-mz.', 400);
  return value as EngineKind;
}

function selection(body: Record<string, unknown>): ProfileSelection {
  const result: ProfileSelection = {};
  for (const field of ['selectedRuntimeId', 'expectedVersion', 'expectedBuildDigest'] as const) {
    const value = body[field];
    if (value !== undefined) {
      if (typeof value !== 'string' || !value.trim() || value.length > 256 || value !== value.trim() || hasControlCharacters(value) || !isWellFormedUnicode(value)) throw new ProjectEnrollmentError('INVALID_RUNTIME_SELECTION', `Invalid ${field}.`, 400);
      result[field] = value;
    }
  }
  return result;
}

export function createProjectEnrollmentRouter(registry?: GameProjectRegistry): Router {
  const router = Router();
  const scoped = (req: Request) => {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new ProjectEnrollmentError('PROJECT_OWNER_REQUIRED', 'Authenticate before enrolling or inspecting projects.', 401);
    if (!registry) throw new ProjectEnrollmentError('PROJECT_ENROLLMENT_UNAVAILABLE', 'Persistent project enrollment requires the configured SQLite application database.', 503);
    return { registry, owner: { ownerId, tenantId: 'local' } }; // This API is local-only; the tenant is never a body field.
  };
  router.get('/api/game-studio/runtimes', asyncHandler(async (req, res) => {
    const { registry: service, owner } = scoped(req);
    await service.list(owner); // Apply store/deployment/owner gates before host runtime inspection.
    res.json(await service.resolver.catalog.inventory(engine(req.query.engine || 'godot')));
  }));
  router.get('/api/game-studio/projects', asyncHandler(async (req, res) => {
    const { registry: service, owner } = scoped(req);
    const projects = await service.list(owner);
    res.json({ projects: projects.map(project => ({ projectId: project.projectId, engine: project.profile.facts.engine,
      canonicalRoot: project.canonicalRoot, revision: project.revision, resolution: project.profile.resolution,
      profileDigest: project.profile.profileDigest, updatedAt: project.updatedAt, freshness: 'not_checked' })) });
  }));
  router.post('/api/game-studio/projects', asyncHandler(async (req, res) => {
    const { registry: service, owner } = scoped(req);
    const project = await service.enroll(owner, req.body.projectRoot, engine(req.body.engine), selection(req.body));
    res.status(201).json(project);
  }));
  router.get('/api/game-studio/projects/:id', asyncHandler(async (req, res) => {
    const { registry: service, owner } = scoped(req);
    res.json(await service.get(owner, req.params.id));
  }));
  router.post('/api/game-studio/projects/:id/refresh', asyncHandler(async (req, res) => {
    const { registry: service, owner } = scoped(req);
    const specified = ['selectedRuntimeId', 'expectedVersion', 'expectedBuildDigest'].some(key => Object.hasOwn(req.body, key));
    res.json(await service.refresh(owner, req.params.id, req.body.expectedRevision, specified ? selection(req.body) : undefined));
  }));
  return router;
}
