import { SECService, SEC_SUPPORTED_FORMS } from '../SECService';
import { SECStorageService } from '../SECStorageService';
import { EDGARClient } from '../EDGARClient';
import { SECFilingParser } from '../SECFilingParser';

describe('B75-08: SEC Service, Storage, EDGAR Client, and Parser Deep Coverage Matrix', () => {
  let mockDb: any;
  let secService: SECService;
  let secStorage: SECStorageService;

  beforeEach(() => {
    mockDb = {
      getType: () => 'sqlite',
      query: jest.fn().mockImplementation((queryStr: string, params?: any[]) => {
        if (queryStr.includes('COUNT(*)')) {
          return Promise.resolve({ rows: [{ count: 12 }] });
        }
        if (queryStr.includes('SELECT id FROM sec_companies')) {
          return Promise.resolve({ rows: [{ id: 'comp_1' }] });
        }
        if (queryStr.includes('SELECT * FROM sec_companies') || queryStr.includes('FROM sec_companies WHERE')) {
          return Promise.resolve({
            rows: [
              {
                id: 'comp_1',
                cik: '0000320193',
                cik_padded: '0000320193',
                ticker: 'AAPL',
                name: 'Apple Inc.',
                legal_name: 'Apple Inc.',
                sic: '3571',
                sic_description: 'Electronic Computers',
                exchange: 'Nasdaq',
                fiscal_year_end: '0930',
                entity_type: 'operating',
                former_names_json: JSON.stringify([{ name: 'Apple Computer Inc', from: '1977', to: '2007' }]),
                metadata_json: JSON.stringify({ stateOfInc: 'CA' }),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ]
          });
        }
        if (queryStr.includes('SELECT') && queryStr.includes('sec_filings')) {
          return Promise.resolve({
            rows: [
              {
                id: 'filing_1',
                company_id: 'comp_1',
                accession_number: '0000320193-23-000106',
                form_type: '10-K',
                filing_date: '2023-11-03',
                report_date: '2023-09-30',
                acceptance_datetime: '2023-11-03T18:00:00.000Z',
                act: '34',
                file_number: '001-36743',
                film_number: '231376824',
                items: '[]',
                size_bytes: 102400,
                is_xbrl: 1,
                is_inline_xbrl: 1,
                primary_doc_name: 'aapl-20230930.htm',
                primary_doc_description: '10-K Document'
              }
            ]
          });
        }
        if (queryStr.includes('SELECT') && queryStr.includes('sec_ingestion_queue')) {
          return Promise.resolve({
            rows: [
              {
                id: 'queue_1',
                run_id: 'run_123',
                cik: '0000320193',
                ticker: 'AAPL',
                form_type: '10-K',
                forms_json: '["10-K"]',
                status: 'queued',
                attempts: 0,
                max_attempts: 3,
                metadata_json: '{}'
              }
            ]
          });
        }
        return Promise.resolve({ rows: [] });
      })
    };

    secService = new SECService(mockDb);
    secStorage = new SECStorageService(mockDb);
  });

  describe('SECService Decision Flow', () => {
    it('computes status with default and environment overrides', async () => {
      const origEnv = process.env.SEC_USER_AGENT;
      const origRate = process.env.SEC_MAX_REQUESTS_PER_SECOND;
      try {
        delete process.env.SEC_USER_AGENT;
        process.env.SEC_MAX_REQUESTS_PER_SECOND = '15'; // clamped to 10
        let status = await secService.getStatus();
        expect(status.userAgentConfigured).toBe(false);
        expect(status.maxRequestsPerSecond).toBe(10);

        process.env.SEC_USER_AGENT = 'App test@example.com';
        process.env.SEC_MAX_REQUESTS_PER_SECOND = '0'; // clamped to 1
        status = await secService.getStatus();
        expect(status.userAgentConfigured).toBe(true);
        expect(status.maxRequestsPerSecond).toBe(1);
      } finally {
        if (origEnv) process.env.SEC_USER_AGENT = origEnv; else delete process.env.SEC_USER_AGENT;
        if (origRate) process.env.SEC_MAX_REQUESTS_PER_SECOND = origRate; else delete process.env.SEC_MAX_REQUESTS_PER_SECOND;
      }
    });

    it('plans SEC ingestion and normalizes forms', async () => {
      const plan = await secService.planIngestion({
        forms: ['10-K', '10-Q'],
        runType: 'targeted_test'
      });

      expect(plan.runId).toBeDefined();
      expect(plan.status).toBe('planned');
      expect(plan.forms).toContain('10-K');
    });

    it('searches companies in local database by name or ticker', async () => {
      const results = await secService.searchCompanies('Apple', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Apple Inc.');
    });

    it('queues bulk SEC ingestion for CIKs and tickers', async () => {
      const queueRes = await secService.queueBulkIngestion({
        ciks: ['0000320193'],
        tickers: ['MSFT'],
        forms: ['10-K']
      });

      expect(queueRes.runId).toBeDefined();
      expect(queueRes.queued).toBe(2);
      expect(queueRes.capped).toBe(false);
    });

    it('throws when bulk queueing without any CIKs or tickers', async () => {
      await expect(secService.queueBulkIngestion({})).rejects.toThrow('At least one CIK or ticker is required');
    });

    it('searches companies with bounding limits and exact matches', async () => {
      const empty = await secService.searchCompanies('AAPL', 0);
      expect(mockDb.query).toHaveBeenCalled();
      const large = await secService.searchCompanies('AAPL', 500);
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('lists ingestion queue and plans ingestion', async () => {
      const plan = await secService.planIngestion({ scope: 'AAPL', forms: ['10-K', '10-Q'] });
      expect(plan.status).toBe('planned');

      const queue = await secService.listQueue(10);
      expect(queue.length).toBeGreaterThan(0);
    });
  });

  describe('SECStorageService Decision Flow', () => {
    it('replaces company facts with normalized XBRL fact entries', async () => {
      const factsStored = await secStorage.replaceCompanyFacts('comp_1', [
        {
          taxonomy: 'us-gaap',
          concept: 'Revenues',
          label: 'Revenue',
          unit: 'USD',
          valueNumeric: 383285000000,
          fiscalYear: 2023,
          fiscalPeriod: 'FY',
          formType: '10-K',
          accessionNumber: '0000320193-23-000106',
          metadata: {}
        }
      ]);

      expect(factsStored).toBe(1);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('EDGARClient and SECFilingParser Decision Flow', () => {
    it('parses primary documents and extracts sections and chunks', () => {
      const sampleHtml = `
        <html>
          <head><title>10-K</title></head>
          <body>
            <div>Item 1. Business</div>
            <p>Apple designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories.</p>
            <div>Item 1A. Risk Factors</div>
            <p>Global economic conditions could materially adversely affect the Company.</p>
          </body>
        </html>
      `;

      const parser = new SECFilingParser();
      const parsed = parser.parse(sampleHtml, { formType: '10-K' });
      expect(parsed.text).toBeDefined();
      expect(parsed.contentHash).toBeDefined();
      expect(parsed.sections.length).toBeGreaterThan(0);
      expect(parsed.chunks.length).toBeGreaterThan(0);
    });

    it('normalizes company facts payload with XBRL concepts', () => {
      const parser = new SECFilingParser();
      const facts = parser.normalizeCompanyFacts({
        cik: 320193,
        entityName: 'Apple Inc.',
        facts: {
          'us-gaap': {
            Revenues: {
              label: 'Revenues',
              units: {
                USD: [
                  {
                    end: '2023-09-30',
                    val: 383285000000,
                    fy: 2023,
                    fp: 'FY',
                    form: '10-K',
                    filed: '2023-11-03',
                    accn: '0000320193-23-000106'
                  }
                ]
              }
            }
          }
        }
      });

      expect(facts.length).toBe(1);
      expect(facts[0].valueNumeric).toBe(383285000000);
    });

    it('handles EDGAR client initialization and requires user agent', () => {
      expect(() => new EDGARClient({ userAgent: '' })).toThrow('SEC_USER_AGENT is required');
      const client = new EDGARClient({ userAgent: 'SampleApp test@example.com' });
      expect(client).toBeDefined();
    });

    it('queries companies and stores in SECStorageService', async () => {
      const companies = await secService.searchCompanies('AAPL');
      expect(companies.length).toBeGreaterThan(0);
      expect(companies[0].ticker).toBe('AAPL');

      // Replace company facts in storage
      const factCount = await secStorage.replaceCompanyFacts('comp_1', [
        {
          taxonomy: 'us-gaap',
          concept: 'Revenues',
          label: 'Revenues',
          unit: 'USD',
          valueNumeric: 383285000000,
          periodStart: '2022-10-01',
          periodEnd: '2023-09-30',
          fiscalYear: 2023,
          fiscalPeriod: 'FY',
          formType: '10-K',
          filedDate: '2023-11-03',
          accessionNumber: '0000320193-23-000106',
          metadata: {}
        }
      ]);
      expect(factCount).toBe(1);

      // Parse and store filing content
      const storedFiling = await secStorage.parseAndStoreFiling({
        accessionNumber: '0000320193-23-000106',
        rawContent: '<DOCUMENT><TYPE>10-K</TYPE><TEXT>Item 1. Business Apple designs consumer electronics.</TEXT></DOCUMENT>'
      });
      expect(storedFiling.filingId).toBeDefined();
    });
  });
});
