import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { ProjectMemoryService } from '../../core/project/ProjectMemoryService';

export function createProjectMemoryRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const service = new ProjectMemoryService(workspaceRoot);

  router.get('/api/project-memory/status', asyncHandler(async (_req, res) => res.json(service.status())));

  router.get('/api/project-memory/entries', asyncHandler(async (req, res) => {
    res.json({ entries: service.list(req.query.q ? sanitizeInput(String(req.query.q)) : undefined, req.query.category ? sanitizeInput(String(req.query.category)) : undefined, Number(req.query.limit || 100)) });
  }));

  router.post('/api/project-memory/entries', asyncHandler(async (req, res) => {
    const content = sanitizeInput(String(req.body.content || ''));
    if (!content.trim()) return res.status(400).json({ error: 'content is required' });
    const entry = service.remember({
      content,
      category: sanitizeInput(String(req.body.category || 'note')),
      tags: Array.isArray(req.body.tags) ? req.body.tags.map((tag: unknown) => sanitizeInput(String(tag))) : []
    });
    res.status(201).json({ entry, status: service.status() });
  }));

  router.post('/api/project-memory/resume', asyncHandler(async (_req, res) => res.json(service.resume())));
  return router;
}
