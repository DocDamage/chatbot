import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/Database';
import { ensureExpansionDatabase, jsonParam } from '../database/ExpansionDatabase';
import { EDGARClient } from './EDGARClient';
import { SECFilingParser } from './SECFilingParser';
import { SECStorageService } from './SECStorageService';

export const SEC_SUPPORTED_FORMS = [
  '10-K', '10-K/A', '10-Q', '10-Q/A', '8-K', '8-K/A',
  '20-F', '40-F', '6-K', 'S-1', 'S-1/A', 'DEF 14A',
  '3', '4', '5', '13F-HR', 'SC 13D', 'SC 13G'
];

export interface SECIngestionPlan {
  runId: string;
  status: 'planned';
  runType: string;
  scope: string;
  forms: string[];
  notes: string[];
}

export interface SECCompanyIngestionInput {
  forms?: string[];
  limitPerCompany?: number;
  includeFacts?: boolean;
  parsePrimaryDocuments?: boolean;
}

export interface SECCompanyIngestionResult {
  companyId: string;
  cik: string;
  filingsStored: number;
  factsStored: number;
  warnings: string[];
}

export interface SECQueueBulkInput extends SECCompanyIngestionInput {
  ciks?: string[];
  tickers?: string[];
}

export class SECService {
  constructor(private readonly database?: Database) {}

  async getStatus(): Promise<{
    companies: number;
    filings: number;
    facts: number;
    ingestionRuns: number;
    queuedItems: number;
    processingItems: number;
    failedItems: number;
    supportedForms: string[];
    userAgentConfigured: boolean;
    liveAccessAvailable: boolean;
    maxRequestsPerSecond: number;
  }> {
    const database = await ensureExpansionDatabase(this.database);
    const [companies, filings, facts, ingestionRuns, queuedItems, processingItems, failedItems] = await Promise.all([
      database.query('SELECT COUNT(*) AS count FROM sec_companies'),
      database.query('SELECT COUNT(*) AS count FROM sec_filings'),
      database.query('SELECT COUNT(*) AS count FROM sec_xbrl_facts'),
      database.query('SELECT COUNT(*) AS count FROM sec_ingestion_runs'),
      database.query("SELECT COUNT(*) AS count FROM sec_ingestion_queue WHERE status = 'queued'"),
      database.query("SELECT COUNT(*) AS count FROM sec_ingestion_queue WHERE status = 'processing'"),
      database.query("SELECT COUNT(*) AS count FROM sec_ingestion_queue WHERE status = 'failed'"),
    ]);

    const userAgentConfigured = Boolean(process.env.SEC_USER_AGENT);
    const maxRequestsPerSecond = Math.min(Math.max(Number(process.env.SEC_MAX_REQUESTS_PER_SECOND || 8), 1), 10);

    return {
      companies: Number(companies.rows[0]?.count || 0),
      filings: Number(filings.rows[0]?.count || 0),
      facts: Number(facts.rows[0]?.count || 0),
      ingestionRuns: Number(ingestionRuns.rows[0]?.count || 0),
      queuedItems: Number(queuedItems.rows[0]?.count || 0),
      processingItems: Number(processingItems.rows[0]?.count || 0),
      failedItems: Number(failedItems.rows[0]?.count || 0),
      supportedForms: SEC_SUPPORTED_FORMS,
      userAgentConfigured,
      liveAccessAvailable: userAgentConfigured,
      maxRequestsPerSecond
    };
  }

  async searchCompanies(query: string, limit = 25): Promise<any[]> {
    const database = await ensureExpansionDatabase(this.database);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const like = `%${query.toLowerCase()}%`;
    const result = await database.query(
      `SELECT * FROM sec_companies
       WHERE LOWER(name) LIKE ? OR LOWER(COALESCE(ticker, '')) LIKE ? OR cik LIKE ?
       ORDER BY CASE WHEN LOWER(COALESCE(ticker, '')) = ? THEN 0 ELSE 1 END, name
       LIMIT ?`,
      [like, like, like, query.toLowerCase(), safeLimit]
    );
    return result.rows;
  }

  async planIngestion(input: { runType?: string; scope?: string; forms?: string[] }): Promise<SECIngestionPlan> {
    const database = await ensureExpansionDatabase(this.database);
    const runId = uuidv4();
    const forms = this.normalizeForms(input.forms);
    const runType = input.runType || 'full_sec_foundation';
    const scope = input.scope || 'planned_full_scale';

    await database.query(
      `INSERT INTO sec_ingestion_runs (
        id, run_type, scope, status, errors_json, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        runId,
        runType,
        scope,
        'planned',
        jsonParam([]),
        jsonParam({
          forms,
          note: 'Records ingestion intent. Queue and storage endpoints can now persist SEC companies, filings, and facts.',
          secUserAgentConfigured: Boolean(process.env.SEC_USER_AGENT),
          maxRequestsPerSecond: Math.min(Math.max(Number(process.env.SEC_MAX_REQUESTS_PER_SECOND || 8), 1), 10)
        })
      ]
    );

    return {
      runId,
      status: 'planned',
      runType,
      scope,
      forms,
      notes: [
        'Set SEC_USER_AGENT before live SEC API access.',
        'Live SEC client enforces a configured request pace capped at 10 requests per second.',
        'Use /api/sec/ingest/queue and /api/sec/ingest/process for auditable bulk ingestion.'
      ]
    };
  }

  async ingestCompanyByCik(cik: string, input: SECCompanyIngestionInput = {}): Promise<SECCompanyIngestionResult> {
    const normalizedCik = this.normalizeCik(cik);
    const submissions = await this.getLiveCompanySubmissions(normalizedCik);
    const storage = new SECStorageService(this.database);
    const companyId = await storage.upsertCompanyFromSubmissions(submissions);
    const forms = this.normalizeForms(input.forms);
    const limit = Math.min(Math.max(Number(input.limitPerCompany || 25), 1), 200);
    const filingsStored = await storage.storeRecentFilings({ companyId, submissions, forms, limit });

    const warnings: string[] = [];
    let factsStored = 0;
    if (input.includeFacts !== false) {
      try {
        const factsPayload = await this.getLiveCompanyFacts(normalizedCik);
        const normalizedFacts = new SECFilingParser().normalizeCompanyFacts(factsPayload);
        factsStored = await storage.replaceCompanyFacts(companyId, normalizedFacts);
      } catch (error: any) {
        warnings.push(`Facts ingestion failed after filing metadata was stored: ${error.message}`);
      }
    }

    return { companyId, cik: normalizedCik, filingsStored, factsStored, warnings };
  }

  async ingestCompanyByTicker(ticker: string, input: SECCompanyIngestionInput = {}): Promise<SECCompanyIngestionResult> {
    const cik = await this.lookupTickerCik(ticker);
    return this.ingestCompanyByCik(cik, { ...input, includeFacts: input.includeFacts !== false });
  }

  async queueBulkIngestion(input: SECQueueBulkInput): Promise<{ runId: string; queued: number; capped: boolean; forms: string[] }> {
    const database = await ensureExpansionDatabase(this.database);
    const ciks = Array.from(new Set((input.ciks || []).map(value => this.normalizeCik(value)).filter(Boolean)));
    const tickers = Array.from(new Set((input.tickers || []).map(value => String(value || '').trim().toUpperCase()).filter(Boolean)));
    if (!ciks.length && !tickers.length) {
      throw new Error('At least one CIK or ticker is required to queue SEC ingestion');
    }

    const maxItems = Math.min(Math.max(Number(process.env.SEC_QUEUE_MAX_ITEMS || 1000), 1), 10000);
    const allItems = [
      ...ciks.map(cik => ({ cik, ticker: null as string | null })),
      ...tickers.map(ticker => ({ cik: null as string | null, ticker }))
    ];
    const items = allItems.slice(0, maxItems);
    const forms = this.normalizeForms(input.forms);
    const limitPerCompany = Math.min(Math.max(Number(input.limitPerCompany || 25), 1), 200);
    const includeFacts = input.includeFacts !== false;
    const parsePrimaryDocuments = input.parsePrimaryDocuments === true;
    const runId = uuidv4();

    await database.query(
      `INSERT INTO sec_ingestion_runs (id, run_type, scope, status, errors_json, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        runId,
        'bulk_company_queue',
        `companies:${items.length}`,
        'queued',
        jsonParam([]),
        jsonParam({ forms, limitPerCompany, includeFacts, parsePrimaryDocuments, capped: allItems.length > items.length })
      ]
    );

    for (const item of items) {
      const metadata = { forms, limitPerCompany, includeFacts, parsePrimaryDocuments };
      await database.query(
        `INSERT INTO sec_ingestion_queue (
          id, run_id, cik, ticker, forms_json, limit_per_company,
          include_facts, parse_primary_documents, status, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          runId,
          item.cik,
          item.ticker,
          jsonParam(forms),
          limitPerCompany,
          includeFacts ? 1 : 0,
          parsePrimaryDocuments ? 1 : 0,
          'queued',
          jsonParam(metadata)
        ]
      );
    }

    return { runId, queued: items.length, capped: allItems.length > items.length, forms };
  }

  async listQueue(limit = 50): Promise<any[]> {
    const database = await ensureExpansionDatabase(this.database);
    const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 250);
    const result = await database.query(
      `SELECT * FROM sec_ingestion_queue
       ORDER BY created_at DESC
       LIMIT ?`,
      [safeLimit]
    );
    return result.rows.map(row => ({
      ...row,
      forms: this.parseJson(row.forms_json, []),
      metadata: this.parseJson(row.metadata_json, {})
    }));
  }

  async processQueue(input: { runId?: string; limit?: number } = {}): Promise<{ processed: number; failed: number; recovered: number; results: any[] }> {
    const database = await ensureExpansionDatabase(this.database);
    const recovered = await this.recoverStaleProcessingItems();
    const limit = Math.min(Math.max(Number(input.limit || 5), 1), 25);
    const params: any[] = ['queued'];
    const where = ['status = ?'];

    if (input.runId) {
      where.push('run_id = ?');
      params.push(input.runId);
      await database.query('UPDATE sec_ingestion_runs SET status = ?, started_at = COALESCE(started_at, CURRENT_TIMESTAMP) WHERE id = ?', ['processing', input.runId]);
    }

    params.push(limit);
    const result = await database.query(
      `SELECT * FROM sec_ingestion_queue
       WHERE ${where.join(' AND ')}
       ORDER BY created_at ASC
       LIMIT ?`,
      params
    );

    let processed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const item of result.rows) {
      await database.query(
        `UPDATE sec_ingestion_queue
         SET status = 'processing', attempts = attempts + 1, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [item.id]
      );

      try {
        const metadata = this.parseJson<SECCompanyIngestionInput>(item.metadata_json, {});
        const fallbackForms = Array.isArray(metadata.forms) ? metadata.forms : this.normalizeForms(undefined);
        const forms = this.parseJson<string[]>(item.forms_json, fallbackForms);
        const ingestInput: SECCompanyIngestionInput = {
          ...metadata,
          forms,
          limitPerCompany: item.limit_per_company ? Number(item.limit_per_company) : metadata.limitPerCompany,
          includeFacts: item.include_facts === null || item.include_facts === undefined ? metadata.includeFacts : Boolean(item.include_facts),
          parsePrimaryDocuments: item.parse_primary_documents === null || item.parse_primary_documents === undefined ? metadata.parsePrimaryDocuments : Boolean(item.parse_primary_documents)
        };
        const ingestResult = item.ticker
          ? await this.ingestCompanyByTicker(item.ticker, ingestInput)
          : await this.ingestCompanyByCik(item.cik, ingestInput);

        await database.query(
          `UPDATE sec_ingestion_queue
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, last_error = NULL
           WHERE id = ?`,
          [item.id]
        );
        processed += 1;
        results.push({ queueId: item.id, result: ingestResult });
      } catch (error: any) {
        failed += 1;
        await database.query(
          `UPDATE sec_ingestion_queue
           SET status = 'failed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, last_error = ?
           WHERE id = ?`,
          [error.message, item.id]
        );
        results.push({ queueId: item.id, error: error.message });
      }
    }

    if (input.runId) {
      const remaining = await database.query(
        `SELECT COUNT(*) AS count FROM sec_ingestion_queue WHERE run_id = ? AND status IN ('queued', 'processing')`,
        [input.runId]
      );
      const status = Number(remaining.rows[0]?.count || 0) === 0 ? 'completed' : 'processing';
      await database.query(
        `UPDATE sec_ingestion_runs
         SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
             error_count = error_count + ?, facts_created = facts_created + ?
         WHERE id = ?`,
        [status, status, failed, results.reduce((sum, row) => sum + Number(row.result?.factsStored || 0), 0), input.runId]
      );
    }

    return { processed, failed, recovered, results };
  }

  async recoverStaleProcessingItems(maxAgeMinutes = 60): Promise<number> {
    const database = await ensureExpansionDatabase(this.database);
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();
    const result = await database.query(
      `UPDATE sec_ingestion_queue
       SET status = 'queued', last_error = 'Recovered stale processing item', updated_at = CURRENT_TIMESTAMP
       WHERE status = 'processing' AND started_at < ?`,
      [cutoff]
    );
    return result.rowCount;
  }

  async parseAndStoreFiling(input: { filingId?: string; accessionNumber?: string; rawContent: string }) {
    if (!input.filingId && !input.accessionNumber) {
      throw new Error('filingId or accessionNumber is required');
    }
    return new SECStorageService(this.database).parseAndStoreFiling(input);
  }

  async getLiveCompanySubmissions(cik: string): Promise<any> {
    return this.client().getCompanySubmissions(cik);
  }

  async getLiveCompanyFacts(cik: string): Promise<any> {
    return this.client().getCompanyFacts(cik);
  }

  async getLiveCompanyTickers(): Promise<any> {
    return this.client().getCompanyTickers();
  }

  private async lookupTickerCik(ticker: string): Promise<string> {
    const normalizedTicker = String(ticker || '').trim().toUpperCase();
    if (!normalizedTicker) throw new Error('Ticker is required');
    const payload = await this.getLiveCompanyTickers();
    const entries = Object.values<any>(payload || {});
    const match = entries.find(entry => String(entry.ticker || '').toUpperCase() === normalizedTicker);
    if (!match?.cik_str) throw new Error(`Ticker not found in SEC ticker feed: ${normalizedTicker}`);
    return this.normalizeCik(String(match.cik_str));
  }

  private normalizeForms(forms?: string[]): string[] {
    const requested = (forms?.length ? forms : SEC_SUPPORTED_FORMS)
      .map(form => String(form || '').trim().toUpperCase())
      .filter(Boolean);
    const supported = new Set(SEC_SUPPORTED_FORMS.map(form => form.toUpperCase()));
    const invalid = requested.filter(form => !supported.has(form));
    if (invalid.length) throw new Error(`Unsupported SEC form(s): ${invalid.join(', ')}`);
    return Array.from(new Set(requested));
  }

  private normalizeCik(cik: string): string {
    const digits = String(cik || '').replace(/\D/g, '');
    if (!digits) throw new Error('CIK must contain digits');
    return String(Number(digits));
  }

  private parseJson<T>(value: unknown, fallback: T): T {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value as T;
    try {
      return JSON.parse(String(value)) as T;
    } catch {
      return fallback;
    }
  }

  private client(): EDGARClient {
    return new EDGARClient({
      userAgent: process.env.SEC_USER_AGENT,
      maxRequestsPerSecond: Number(process.env.SEC_MAX_REQUESTS_PER_SECOND || 8)
    });
  }
}
