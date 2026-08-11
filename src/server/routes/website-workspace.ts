import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { WebsiteWorkspaceService } from '../../core/website/WebsiteWorkspaceService';

export function createWebsiteWorkspaceRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const service = new WebsiteWorkspaceService(workspaceRoot);

  router.get('/api/website-workspace/project', (_req, res) => res.json({ project: service.load() }));
  router.post('/api/website-workspace/project', asyncHandler(async (req, res) => res.status(201).json(service.save(req.body))));
  router.post('/api/website-workspace/preview', asyncHandler(async (req, res) => res.json({ html: service.render(req.body, req.body.slug) })));
  return router;
}
