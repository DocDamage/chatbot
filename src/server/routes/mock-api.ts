import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { MockApiWorkspaceService } from '../../core/local-tools/MockApiWorkspaceService';

export function createMockApiRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const service = new MockApiWorkspaceService(workspaceRoot);

  router.get('/api/mock-api/status', (_req, res) => res.json(service.status()));
  router.get('/api/mock-api/collections', (req, res) => res.json({ collections: service.list(typeof req.query.name === 'string' ? req.query.name : undefined) }));
  router.post('/api/mock-api/import', asyncHandler(async (req, res) => {
    const collection = service.importText({ collection: req.body.collection, format: req.body.format, content: String(req.body.content || '') });
    res.status(201).json({ collection, endpoint: `/api/mock-api/collections/${collection.name}` });
  }));

  return router;
}
