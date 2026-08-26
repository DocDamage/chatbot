import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { Database } from '../../../core/database/Database';
import { ensureExpansionDatabase } from '../../../core/database/ExpansionDatabase';
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
});
