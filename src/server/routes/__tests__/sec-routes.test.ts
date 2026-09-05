import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { Database } from '../../../core/database/Database';
import { ensureExpansionDatabase } from '../../../core/database/ExpansionDatabase';
import { SECService } from '../../../core/sec/SECService';
import { createSECRouter } from '../sec';

describe('RT-SEC-001: SEC Router Suite', () => {
  let app: express.Application;
  let tempDir: string;
  let db: Database;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-routes-test-'));
    db = new Database({ type: 'sqlite', filePath: path.join(tempDir, 'sec.db') });
    await db.initialize();
    await ensureExpansionDatabase(db);

    app = express();
    app.use(express.json());
    app.use(createSECRouter({ database: db }));
  });

  afterEach(async () => {
    try {
      await db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('provides SEC status endpoint', async () => {
    const res = await request(app).get('/api/sec/status');
    expect(res.status).toBe(200);
    expect(res.body.supportedForms.length).toBeGreaterThan(0);
  });

  it('searches companies with validation', async () => {
    const badRes = await request(app).get('/api/sec/companies/search?q=');
    expect(badRes.status).toBe(400);

    const goodRes = await request(app).get('/api/sec/companies/search?q=Apple&limit=5');
    expect(goodRes.status).toBe(200);
    expect(Array.isArray(goodRes.body.companies)).toBe(true);
  });

  it('validates live submissions and facts parameters', async () => {
    const badSub = await request(app).get('/api/sec/live/submissions/%20');
    expect(badSub.status).toBe(400);

    const badFacts = await request(app).get('/api/sec/live/facts/%20');
    expect(badFacts.status).toBe(400);
  });

  it('plans ingestion and manages queue endpoints', async () => {
    const planRes = await request(app)
      .post('/api/sec/ingest/plan')
      .send({ runType: 'incremental', scope: 'sp500', forms: ['10-K'] });
    expect(planRes.status).toBe(200);

    const queueListRes = await request(app).get('/api/sec/ingest/queue?limit=10');
    expect(queueListRes.status).toBe(200);
    expect(Array.isArray(queueListRes.body.items)).toBe(true);

    const recoverRes = await request(app)
      .post('/api/sec/ingest/recover-stale')
      .send({ maxAgeMinutes: 30 });
    expect(recoverRes.status).toBe(200);

    const badParse = await request(app)
      .post('/api/sec/filings/parse')
      .send({ rawContent: '' });
    expect(badParse.status).toBe(400);

    const missingIdParse = await request(app)
      .post('/api/sec/filings/parse')
      .send({ rawContent: 'Some content' });
    expect(missingIdParse.status).toBe(500);
  });

  it('covers live tickers, company ingest, bulk queue, and process endpoints', async () => {
    const tickersSpy = jest.spyOn(SECService.prototype, 'getLiveCompanyTickers').mockResolvedValue([{ cik: '0000320193', ticker: 'AAPL', title: 'Apple Inc.' }] as any);
    const ingestCikSpy = jest.spyOn(SECService.prototype, 'ingestCompanyByCik').mockResolvedValue({ cik: '0000320193', companyId: 'c1', filingsStored: 1, factsStored: 1, warnings: [] });
    const ingestTickerSpy = jest.spyOn(SECService.prototype, 'ingestCompanyByTicker').mockResolvedValue({ cik: '0000320193', companyId: 'c1', filingsStored: 1, factsStored: 1, warnings: [] });
    const queueSpy = jest.spyOn(SECService.prototype, 'queueBulkIngestion').mockResolvedValue({ queued: 1, runId: 'run-1', capped: false, forms: ['10-K'] });
    const processSpy = jest.spyOn(SECService.prototype, 'processQueue').mockResolvedValue({ processed: 1, failed: 0, recovered: 0, results: [] });
    const submissionsSpy = jest.spyOn(SECService.prototype, 'getLiveCompanySubmissions').mockResolvedValue({ cik: '0000320193', entityType: 'operating' } as any);
    const factsSpy = jest.spyOn(SECService.prototype, 'getLiveCompanyFacts').mockResolvedValue({ cik: '0000320193', facts: {} } as any);

    // Live tickers
    const tickersRes = await request(app).get('/api/sec/live/tickers');
    expect(tickersRes.status).toBe(200);

    // Live submissions and facts
    const subRes = await request(app).get('/api/sec/live/submissions/0000320193');
    expect(subRes.status).toBe(200);
    const factRes = await request(app).get('/api/sec/live/facts/0000320193');
    expect(factRes.status).toBe(200);

    // Ingest company by CIK
    const badCik = await request(app).post('/api/sec/ingest/company/cik/%20').send({});
    expect(badCik.status).toBe(400);
    const goodCik = await request(app).post('/api/sec/ingest/company/cik/0000320193').send({ includeFacts: true });
    expect(goodCik.status).toBe(200);

    // Ingest company by Ticker
    const badTicker = await request(app).post('/api/sec/ingest/company/ticker/%20').send({});
    expect(badTicker.status).toBe(400);
    const goodTicker = await request(app).post('/api/sec/ingest/company/ticker/AAPL').send({ includeFacts: true });
    expect(goodTicker.status).toBe(200);

    // Bulk queue ingestion
    const queueRes = await request(app).post('/api/sec/ingest/queue').send({
      ciks: ['0000320193'],
      tickers: ['AAPL'],
      forms: ['10-K'],
      limitPerCompany: 1,
      includeFacts: true,
      parsePrimaryDocuments: false
    });
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.queued).toBe(1);

    // Process queue
    const processRes = await request(app).post('/api/sec/ingest/process').send({
      runId: 'test-run',
      limit: 5
    });
    expect(processRes.status).toBe(200);
    expect(processRes.body.processed).toBe(1);

    tickersSpy.mockRestore();
    ingestCikSpy.mockRestore();
    ingestTickerSpy.mockRestore();
    queueSpy.mockRestore();
    processSpy.mockRestore();
    submissionsSpy.mockRestore();
    factsSpy.mockRestore();
  });
});
