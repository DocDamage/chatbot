import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { PyScrappyService } from '../../core/research/PyScrappyService';

export function createResearchRouter(services: any): Router {
  const router = Router();
  const getService = (): PyScrappyService => services?.pyScrappyService || PyScrappyService.fromEnv();

  router.get('/api/research/status', asyncHandler(async (_req, res) => {
    res.json(await getService().getStatus());
  }));

  router.post('/api/research/scrape', asyncHandler(async (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    const result = await getService().scrapeUrl(url, req.body?.options || {});
    res.status(result.success ? 200 : 400).json(result);
  }));

  return router;
}
