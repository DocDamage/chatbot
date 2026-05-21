import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { ToolCatalogService } from '../../core/tools/catalog/ToolCatalogService';

export function createToolCatalogRouter(services: any): Router {
  const router = Router();

  const getService = () => new ToolCatalogService(services?.database);

  router.get('/api/tool-catalog', asyncHandler(async (req, res) => {
    res.json({ tools: await getService().listTools({
      category: req.query.category ? sanitizeInput(String(req.query.category)) : undefined,
      q: req.query.q ? sanitizeInput(String(req.query.q)) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined
    }) });
  }));

  router.get('/api/tool-catalog/stats', asyncHandler(async (_req, res) => {
    res.json(await getService().getStats());
  }));

  return router;
}
