import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { ProjectIntelligenceService } from '../../core/project/ProjectIntelligenceService';

export function createProjectIntelligenceRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const service = new ProjectIntelligenceService(workspaceRoot);

  router.get('/api/project-intelligence/overview', asyncHandler(async (req, res) => {
    res.json(await service.overview(Number(req.query.maxFiles || 250)));
  }));

  router.get('/api/project-intelligence/file', asyncHandler(async (req, res) => {
    const file = sanitizeInput(String(req.query.path || ''));
    if (!file.trim()) return res.status(400).json({ error: 'path is required' });
    res.json(service.inspect(file));
  }));

  router.get('/api/project-intelligence/history', asyncHandler(async (req, res) => {
    res.json({ commits: service.history(Number(req.query.limit || 20)) });
  }));

  return router;
}
