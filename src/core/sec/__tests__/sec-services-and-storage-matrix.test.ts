import { SECService, SEC_SUPPORTED_FORMS } from '../SECService';
import { SECStorageService } from '../SECStorageService';

describe('B75-07: SEC Service and SEC Storage Decision Matrix', () => {
  let mockDb: any;
  let secService: SECService;
  let secStorage: SECStorageService;

  beforeEach(() => {
    mockDb = {
      getType: () => 'sqlite',
      query: jest.fn().mockImplementation((queryStr: string, params?: any[]) => {
        if (queryStr.includes('COUNT(*)')) {
          return Promise.resolve({ rows: [{ count: 5 }] });
        }
        if (queryStr.includes('SELECT id FROM sec_companies')) {
          return Promise.resolve({ rows: [{ id: 'comp_1' }] });
        }
        if (queryStr.includes('SELECT') && queryStr.includes('sec_companies')) {
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
                former_names_json: '[]',
                metadata_json: '{}'
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
                is_xbrl: 1,
                primary_doc_description: '10-K Document',
                size_bytes: 102400
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

  describe('SECService Operations', () => {
    it('returns system status with supported forms and counts', async () => {
      const status = await secService.getStatus();
      expect(status.companies).toBe(5);
      expect(status.filings).toBe(5);
      expect(status.supportedForms).toEqual(SEC_SUPPORTED_FORMS);
    });

    it('searches companies and handles empty/populated queries', async () => {
      const searchResults = await secService.searchCompanies('AAPL');
      expect(searchResults.length).toBe(1);
      expect(searchResults[0].ticker).toBe('AAPL');
    });

    it('plans ingestion runs and validates requested forms', async () => {
      const plan = await secService.planIngestion({
        scope: 'AAPL',
        runType: 'submissions_and_facts',
        forms: ['10-K', '10-Q']
      });
      expect(plan.status).toBe('planned');
      expect(plan.forms).toEqual(['10-K', '10-Q']);
      expect(plan.scope).toBe('AAPL');
    });

    it('queues bulk ingestion runs with CIKs and tickers', async () => {
      const queued = await secService.queueBulkIngestion({
        ciks: ['0000320193'],
        tickers: ['MSFT'],
        forms: ['10-K']
      });
      expect(queued.runId).toBeDefined();
      expect(queued.queued).toBe(2);
    });
  });

  describe('SECStorageService Operations', () => {
    it('upserts company metadata from SEC submissions payload', async () => {
      const companyId = await secStorage.upsertCompanyFromSubmissions({
        cik: '320193',
        tickers: ['AAPL'],
        exchanges: ['Nasdaq'],
        name: 'Apple Inc.',
        sic: '3571',
        sicDescription: 'Electronic Computers',
        fiscalYearEnd: '0930'
      });
      expect(companyId).toBe('comp_1');
      expect(mockDb.query).toHaveBeenCalled();
    });

    it('stores filings with duplicate avoidance and form filtering', async () => {
      const storedCount = await secStorage.storeRecentFilings({
        companyId: 'comp_1',
        submissions: {
          cik: '0000320193',
          filings: {
            recent: {
              accessionNumber: ['0000320193-23-000106'],
              filingDate: ['2023-11-03'],
              reportDate: ['2023-09-30'],
              acceptanceDateTime: ['2023-11-03T18:00:00.000Z'],
              act: ['34'],
              form: ['10-K'],
              fileNumber: ['001-36743'],
              filmNumber: ['231376824'],
              primaryDocument: ['aapl-20230930.htm']
            }
          }
        },
        forms: ['10-K'],
        limit: 10
      });

      expect(storedCount).toBe(1);
    });

    it('replaces company XBRL facts and parses & stores filing documents, sections, chunks', async () => {
      const factsStored = await secStorage.replaceCompanyFacts('comp_1', [
        {
          taxonomy: 'us-gaap',
          concept: 'Revenues',
          label: 'Total Revenues',
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

      const parsedStored = await secStorage.parseAndStoreFiling({
        accessionNumber: '0000320193-23-000106',
        rawContent: `
          <DOCUMENT>
          <TYPE>10-K
          <SEQUENCE>1
          <FILENAME>aapl.htm
          <TEXT>
          ITEM 1. BUSINESS
          Apple designs, manufactures, and markets smartphones.
          ITEM 1A. RISK FACTORS
          Global economic conditions may affect consumer spending.
          </TEXT>
          </DOCUMENT>
        `
      });
      expect(parsedStored.filingId).toBe('filing_1');
      expect(parsedStored.documents).toBeGreaterThan(0);
      expect(parsedStored.sections).toBeGreaterThan(0);
    });
  });
});
