import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Database } from '../database/Database';
import { ensureExpansionDatabase } from '../database/ExpansionDatabase';
import { SECCompanyIngestionInput, SECCompanyIngestionResult, SECService } from './SECService';

class TestSECService extends SECService {
  public ingested: Array<{ type: 'cik' | 'ticker'; value: string; input: SECCompanyIngestionInput }> = [];
  public failNext = false;

  async ingestCompanyByCik(cik: string, input: SECCompanyIngestionInput = {}): Promise<SECCompanyIngestionResult> {
    if (this.failNext) throw new Error('planned failure');
    this.ingested.push({ type: 'cik', value: cik, input });
    return { companyId: `company-${cik}`, cik, filingsStored: 2, factsStored: 3, warnings: [] };
  }

  async ingestCompanyByTicker(ticker: string, input: SECCompanyIngestionInput = {}): Promise<SECCompanyIngestionResult> {
    if (this.failNext) throw new Error('planned failure');
    this.ingested.push({ type: 'ticker', value: ticker, input });
    return { companyId: `company-${ticker}`, cik: '1', filingsStored: 1, factsStored: 4, warnings: [] };
  }
}

describe('SECService queue', () => {
  let tempDir: string;
  let db: Database;
  let service: TestSECService;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-queue-test-'));
    db = new Database({ type: 'sqlite', filePath: path.join(tempDir, 'chatbot.db') });
    await db.initialize();
    await ensureExpansionDatabase(db);
    service = new TestSECService(db);
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('queues CIK and ticker items with normalized options', async () => {
    const result = await service.queueBulkIngestion({
      ciks: ['0000320193'],
      tickers: ['msft'],
      forms: ['10-K'],
      limitPerCompany: 2,
      includeFacts: true
    });

    expect(result.queued).toBe(2);
    expect(result.forms).toEqual(['10-K']);

    const queue = await service.listQueue();
    expect(queue).toHaveLength(2);
    expect(queue.map(item => item.status)).toEqual(['queued', 'queued']);
    expect(queue[0].metadata.limitPerCompany).toBe(2);
  });

  it('processes queued items and marks the run complete', async () => {
    const queued = await service.queueBulkIngestion({ ciks: ['0000320193'], forms: ['10-K'], includeFacts: false });

    const processed = await service.processQueue({ runId: queued.runId, limit: 5 });

    expect(processed.processed).toBe(1);
    expect(processed.failed).toBe(0);
    expect(service.ingested[0]).toMatchObject({ type: 'cik', value: '320193' });
    expect(service.ingested[0].input.includeFacts).toBe(false);

    const queueRows = await db.query('SELECT status FROM sec_ingestion_queue');
    const runRows = await db.query('SELECT status, facts_created FROM sec_ingestion_runs WHERE id = ?', [queued.runId]);
    expect(queueRows.rows[0].status).toBe('completed');
    expect(runRows.rows[0].status).toBe('completed');
    expect(Number(runRows.rows[0].facts_created)).toBe(3);
  });

  it('marks failed queue items with an error', async () => {
    const queued = await service.queueBulkIngestion({ ciks: ['0000320193'], forms: ['10-K'] });
    service.failNext = true;

    const processed = await service.processQueue({ runId: queued.runId, limit: 5 });

    expect(processed.processed).toBe(0);
    expect(processed.failed).toBe(1);

    const row = await db.query('SELECT status, last_error FROM sec_ingestion_queue');
    expect(row.rows[0].status).toBe('failed');
    expect(row.rows[0].last_error).toContain('planned failure');
  });

  it('recovers stale processing items', async () => {
    const queued = await service.queueBulkIngestion({ ciks: ['0000320193'], forms: ['10-K'] });
    await db.query(
      `UPDATE sec_ingestion_queue SET status = ?, started_at = ? WHERE run_id = ?`,
      ['processing', '2000-01-01T00:00:00.000Z', queued.runId]
    );

    const recovered = await service.recoverStaleProcessingItems(1);

    expect(recovered).toBe(1);
    const row = await db.query('SELECT status, last_error FROM sec_ingestion_queue');
    expect(row.rows[0].status).toBe('queued');
    expect(row.rows[0].last_error).toContain('Recovered');
  });

  it('covers getStatus, searchCompanies, planIngestion, parseAndStoreFiling, and validations', async () => {
    // 1. getStatus
    const status = await service.getStatus();
    expect(status.supportedForms.length).toBeGreaterThan(0);
    expect(status.companies).toBe(0);

    // 2. planIngestion
    const plan = await service.planIngestion({ runType: 'test', scope: 'sp500', forms: ['10-K'] });
    expect(plan.status).toBe('planned');
    expect(plan.forms).toEqual(['10-K']);

    // 3. searchCompanies
    await db.query(
      `INSERT INTO sec_companies (id, cik, cik_padded, ticker, name, created_at, updated_at)
       VALUES ('c-1', '320193', '0000320193', 'AAPL', 'Apple Inc.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    );
    const searchRes = await service.searchCompanies('Apple');
    expect(searchRes).toHaveLength(1);
    expect(searchRes[0].ticker).toBe('AAPL');

    // 4. parseAndStoreFiling validation
    await expect(service.parseAndStoreFiling({ rawContent: 'test' })).rejects.toThrow('filingId or accessionNumber is required');

    // 5. Validation errors on invalid forms, non-digit CIK, and empty queue request
    await expect(service.queueBulkIngestion({ ciks: [], tickers: [] })).rejects.toThrow('At least one CIK or ticker is required');
    await expect(service.queueBulkIngestion({ ciks: ['invalid-no-digits'] })).rejects.toThrow('CIK must contain digits');
    await expect(service.planIngestion({ forms: ['INVALID_FORM_XYZ'] })).rejects.toThrow('Unsupported SEC form');
  });
});
