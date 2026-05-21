import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { SECService } from '../../core/sec/SECService';

export function createSECRouter(services: any): Router {
  const router = Router();

  const getService = () => new SECService(services?.database);

  router.get('/api/sec/status', asyncHandler(async (_req, res) => {
    res.json(await getService().getStatus());
  }));

  router.get('/api/sec/companies/search', asyncHandler(async (req, res) => {
    const q = sanitizeInput(String(req.query.q || ''));
    if (!q.trim()) return res.status(400).json({ error: 'q is required' });
    res.json({ companies: await getService().searchCompanies(q, req.query.limit ? Number(req.query.limit) : undefined) });
  }));

  router.get('/api/sec/live/tickers', asyncHandler(async (_req, res) => {
    res.json(await getService().getLiveCompanyTickers());
  }));

  router.get('/api/sec/live/submissions/:cik', asyncHandler(async (req, res) => {
    const cik = sanitizeInput(String(req.params.cik || ''));
    if (!cik.trim()) return res.status(400).json({ error: 'cik is required' });
    res.json(await getService().getLiveCompanySubmissions(cik));
  }));

  router.get('/api/sec/live/facts/:cik', asyncHandler(async (req, res) => {
    const cik = sanitizeInput(String(req.params.cik || ''));
    if (!cik.trim()) return res.status(400).json({ error: 'cik is required' });
    res.json(await getService().getLiveCompanyFacts(cik));
  }));

  router.post('/api/sec/ingest/plan', asyncHandler(async (req, res) => {
    res.json(await getService().planIngestion({
      runType: req.body.runType ? String(req.body.runType) : undefined,
      scope: req.body.scope ? String(req.body.scope) : undefined,
      forms: Array.isArray(req.body.forms) ? req.body.forms.map(String) : undefined
    }));
  }));

  return router;
}
