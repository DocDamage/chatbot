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

  router.post('/api/sec/ingest/company/cik/:cik', asyncHandler(async (req, res) => {
    const cik = sanitizeInput(String(req.params.cik || ''));
    if (!cik.trim()) return res.status(400).json({ error: 'cik is required' });

    res.json(await getService().ingestCompanyByCik(cik, {
      forms: Array.isArray(req.body.forms) ? req.body.forms.map(String) : undefined,
      limitPerCompany: req.body.limitPerCompany ? Number(req.body.limitPerCompany) : undefined,
      includeFacts: req.body.includeFacts !== false,
      parsePrimaryDocuments: req.body.parsePrimaryDocuments === true
    }));
  }));

  router.post('/api/sec/ingest/company/ticker/:ticker', asyncHandler(async (req, res) => {
    const ticker = sanitizeInput(String(req.params.ticker || ''));
    if (!ticker.trim()) return res.status(400).json({ error: 'ticker is required' });

    res.json(await getService().ingestCompanyByTicker(ticker, {
      forms: Array.isArray(req.body.forms) ? req.body.forms.map(String) : undefined,
      limitPerCompany: req.body.limitPerCompany ? Number(req.body.limitPerCompany) : undefined,
      includeFacts: req.body.includeFacts !== false,
      parsePrimaryDocuments: req.body.parsePrimaryDocuments === true
    }));
  }));

  router.post('/api/sec/ingest/queue', asyncHandler(async (req, res) => {
    res.json(await getService().queueBulkIngestion({
      ciks: Array.isArray(req.body.ciks) ? req.body.ciks.map(String) : undefined,
      tickers: Array.isArray(req.body.tickers) ? req.body.tickers.map(String) : undefined,
      forms: Array.isArray(req.body.forms) ? req.body.forms.map(String) : undefined,
      limitPerCompany: req.body.limitPerCompany ? Number(req.body.limitPerCompany) : undefined,
      includeFacts: req.body.includeFacts !== false,
      parsePrimaryDocuments: req.body.parsePrimaryDocuments === true
    }));
  }));

  router.get('/api/sec/ingest/queue', asyncHandler(async (req, res) => {
    res.json({
      items: await getService().listQueue(req.query.limit ? Number(req.query.limit) : undefined)
    });
  }));

  router.post('/api/sec/ingest/recover-stale', asyncHandler(async (req, res) => {
    res.json({ recovered: await getService().recoverStaleProcessingItems(req.body.maxAgeMinutes ? Number(req.body.maxAgeMinutes) : undefined) });
  }));

  router.post('/api/sec/ingest/process', asyncHandler(async (req, res) => {
    res.json(await getService().processQueue({
      runId: req.body.runId ? String(req.body.runId) : undefined,
      limit: req.body.limit ? Number(req.body.limit) : undefined
    }));
  }));

  router.post('/api/sec/filings/parse', asyncHandler(async (req, res) => {
    const rawContent = String(req.body.rawContent || '');
    if (!rawContent.trim()) return res.status(400).json({ error: 'rawContent is required' });

    res.json(await getService().parseAndStoreFiling({
      filingId: req.body.filingId ? String(req.body.filingId) : undefined,
      accessionNumber: req.body.accessionNumber ? String(req.body.accessionNumber) : undefined,
      rawContent
    }));
  }));

  return router;
}
