import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/Database';
import { ensureExpansionDatabase, jsonParam } from '../database/ExpansionDatabase';
import { EDGARClient } from './EDGARClient';

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

export class SECService {
  constructor(private readonly database?: Database) {}

  async getStatus(): Promise<{
    companies: number;
    filings: number;
    facts: number;
    ingestionRuns: number;
    supportedForms: string[];
    userAgentConfigured: boolean;
    liveAccessAvailable: boolean;
    maxRequestsPerSecond: number;
  }> {
    const database = await ensureExpansionDatabase(this.database);
    const [companies, filings, facts, ingestionRuns] = await Promise.all([
      database.query('SELECT COUNT(*) AS count FROM sec_companies'),
      database.query('SELECT COUNT(*) AS count FROM sec_filings'),
      database.query('SELECT COUNT(*) AS count FROM sec_xbrl_facts'),
      database.query('SELECT COUNT(*) AS count FROM sec_ingestion_runs'),
    ]);

    const userAgentConfigured = Boolean(process.env.SEC_USER_AGENT);
    const maxRequestsPerSecond = Math.min(Math.max(Number(process.env.SEC_MAX_REQUESTS_PER_SECOND || 8), 1), 10);

    return {
      companies: Number(companies.rows[0]?.count || 0),
      filings: Number(filings.rows[0]?.count || 0),
      facts: Number(facts.rows[0]?.count || 0),
      ingestionRuns: Number(ingestionRuns.rows[0]?.count || 0),
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
    const forms = (input.forms?.length ? input.forms : SEC_SUPPORTED_FORMS).map(String);
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
          note: 'Phase 1 records the full-scale ingestion intent. Live fetch scaffolding exists; parsing/storage phases follow.',
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
        'Next SEC phase stores live response payloads into normalized filing and XBRL tables.'
      ]
    };
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

  private client(): EDGARClient {
    return new EDGARClient({
      userAgent: process.env.SEC_USER_AGENT,
      maxRequestsPerSecond: Number(process.env.SEC_MAX_REQUESTS_PER_SECOND || 8)
    });
  }
}
