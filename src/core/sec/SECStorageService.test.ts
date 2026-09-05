import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Database } from '../database/Database';
import { ensureExpansionDatabase } from '../database/ExpansionDatabase';
import { SECStorageService } from './SECStorageService';

function submissions() {
  return {
    cik: '0000320193',
    name: 'Example Corp',
    tickers: ['EXM'],
    exchanges: ['Nasdaq'],
    sic: '3571',
    sicDescription: 'Electronic Computers',
    fiscalYearEnd: '0930',
    entityType: 'operating',
    filings: {
      recent: {
        accessionNumber: ['0000320193-24-000001', '0000320193-24-000002'],
        form: ['10-K', '8-K'],
        filingDate: ['2024-01-01', '2024-01-02'],
        reportDate: ['2023-12-31', '2024-01-01'],
        acceptanceDateTime: ['20240101120000', '20240102120000'],
        primaryDocument: ['example-10k.htm', 'example-8k.htm'],
        primaryDocDescription: ['Annual report', 'Current report']
      }
    }
  };
}

describe('SECStorageService', () => {
  let tempDir: string;
  let db: Database;
  let storage: SECStorageService;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-storage-test-'));
    db = new Database({ type: 'sqlite', filePath: path.join(tempDir, 'chatbot.db') });
    await db.initialize();
    await ensureExpansionDatabase(db);
    storage = new SECStorageService(db);
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('upserts a company and stores allowlisted recent filings', async () => {
    const companyId = await storage.upsertCompanyFromSubmissions(submissions());
    const stored = await storage.storeRecentFilings({
      companyId,
      submissions: submissions(),
      forms: ['10-K'],
      limit: 10
    });

    expect(stored).toBe(1);

    const companies = await db.query('SELECT cik, ticker, name FROM sec_companies');
    const filings = await db.query('SELECT accession_number, form_type, primary_document_url FROM sec_filings');

    expect(companies.rows[0]).toMatchObject({ cik: '320193', ticker: 'EXM', name: 'Example Corp' });
    expect(filings.rows).toHaveLength(1);
    expect(filings.rows[0].form_type).toBe('10-K');
    expect(filings.rows[0].primary_document_url).toContain('example-10k.htm');
  });

  it('replaces company facts and links facts to stored filings by accession number', async () => {
    const companyId = await storage.upsertCompanyFromSubmissions(submissions());
    await storage.storeRecentFilings({ companyId, submissions: submissions(), forms: ['10-K'], limit: 10 });

    const count = await storage.replaceCompanyFacts(companyId, [
      {
        taxonomy: 'us-gaap',
        concept: 'Revenues',
        label: 'Revenue',
        unit: 'USD',
        valueNumeric: 123,
        fiscalYear: 2024,
        fiscalPeriod: 'FY',
        formType: '10-K',
        accessionNumber: '0000320193-24-000001',
        filedDate: '2024-01-01',
        metadata: {}
      }
    ]);

    expect(count).toBe(1);

    const facts = await db.query('SELECT concept, value_numeric, filing_id FROM sec_xbrl_facts');
    expect(facts.rows[0].concept).toBe('Revenues');
    expect(facts.rows[0].value_numeric).toBe(123);
    expect(facts.rows[0].filing_id).toBeTruthy();

    await storage.replaceCompanyFacts(companyId, []);
    const emptyFacts = await db.query('SELECT COUNT(*) AS count FROM sec_xbrl_facts');
    expect(Number(emptyFacts.rows[0].count)).toBe(0);
  });

  it('parses and stores filing documents, sections, and chunks', async () => {
    const companyId = await storage.upsertCompanyFromSubmissions(submissions());
    await storage.storeRecentFilings({ companyId, submissions: submissions(), forms: ['10-K'], limit: 10 });

    const rawContent = [
      '<DOCUMENT>',
      '<TYPE>10-K',
      '<FILENAME>example-10k.htm',
      '<DESCRIPTION>Annual report',
      '<TEXT>',
      'Item 1 - Business',
      'This business section has enough text to be parsed and stored as a section for verification.',
      'Item 1A - Risk Factors',
      'This risk section also has enough text to be parsed and stored as another section.',
      '</TEXT>',
      '</DOCUMENT>'
    ].join('\n');

    const result = await storage.parseAndStoreFiling({
      accessionNumber: '0000320193-24-000001',
      rawContent
    });

    expect(result.documents).toBe(1);
    expect(result.sections).toBeGreaterThanOrEqual(1);
    expect(result.chunks).toBeGreaterThanOrEqual(1);

    const documents = await db.query('SELECT filename, document_type FROM sec_filing_documents');
    const sections = await db.query('SELECT item_code FROM sec_filing_sections ORDER BY section_order');
    const chunks = await db.query('SELECT content FROM sec_filing_chunks');
    const filing = await db.query('SELECT id, ingest_status FROM sec_filings WHERE accession_number = ?', ['0000320193-24-000001']);

    expect(documents.rows[0]).toMatchObject({ filename: 'example-10k.htm', document_type: '10-K' });
    expect(sections.rows.map(row => row.item_code)).toContain('1');
    expect(chunks.rows[0].content).toContain('Business');
    expect(filing.rows[0].ingest_status).toBe('parsed');

    // Finding filing by ID
    const byIdResult = await storage.parseAndStoreFiling({
      filingId: filing.rows[0].id,
      rawContent: '<DOCUMENT><TYPE>10-K</TYPE><FILENAME>test.htm</FILENAME><TEXT>Short text</TEXT></DOCUMENT>'
    });
    expect(byIdResult.documents).toBe(1);

    // Missing filing rejection
    await expect(storage.parseAndStoreFiling({
      accessionNumber: 'non-existent-accession',
      rawContent: 'test'
    })).rejects.toThrow('Stored SEC filing not found');

    // Invalid CIK rejection
    await expect(storage.upsertCompanyFromSubmissions({ cik: 'abc' })).rejects.toThrow('CIK must contain digits');
  });

  it('normalizes sparse SEC payloads and applies bounded filing defaults', async () => {
    const companyId = await storage.upsertCompanyFromSubmissions({
      cik: 'CIK 0000042',
      entityName: 'Fallback Entity',
    });
    await storage.upsertCompanyFromSubmissions({ cik: 7 });

    const companies = await db.query(
      'SELECT cik, cik_padded, ticker, exchange, name, legal_name FROM sec_companies ORDER BY cik',
    );
    expect(companies.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        cik: '42',
        cik_padded: '0000000042',
        ticker: null,
        exchange: null,
        name: 'Fallback Entity',
        legal_name: null,
      }),
      expect.objectContaining({ cik: '7', name: 'CIK 7' }),
    ]));

    await expect(storage.storeRecentFilings({
      companyId,
      submissions: { cik: '42' },
      forms: ['10-k'],
      limit: 0,
    })).resolves.toBe(0);

    const sparseSubmissions = {
      cik: '42',
      filings: {
        recent: {
          accessionNumber: ['skip-no-form', 'skip-form', '0000042-24-000001'],
          form: [undefined, '8-K', '10-k'],
        },
      },
    };
    await expect(storage.storeRecentFilings({
      companyId,
      submissions: sparseSubmissions,
      forms: ['10-K'],
      limit: 999,
    })).resolves.toBe(1);

    const filing = await db.query(
      'SELECT primary_document, primary_document_url, filing_detail_url FROM sec_filings WHERE accession_number = ?',
      ['0000042-24-000001'],
    );
    expect(filing.rows[0]).toMatchObject({
      primary_document: null,
      primary_document_url: null,
    });
    expect(filing.rows[0].filing_detail_url).toContain('/42/000004224000001/');
  });

  it('stores sparse facts with null optionals and tolerates an unknown accession', async () => {
    const companyId = await storage.upsertCompanyFromSubmissions(submissions());
    const count = await storage.replaceCompanyFacts(companyId, [
      {
        taxonomy: 'us-gaap',
        concept: 'Assets',
        valueNumeric: 0,
      },
      {
        taxonomy: 'us-gaap',
        concept: 'Liabilities',
        valueText: 'reported',
        accessionNumber: 'missing-accession',
      },
    ] as any);

    expect(count).toBe(2);
    const facts = await db.query(
      'SELECT concept, filing_id, value_numeric, value_text FROM sec_xbrl_facts ORDER BY concept',
    );
    expect(facts.rows).toEqual([
      expect.objectContaining({ concept: 'Assets', filing_id: null, value_numeric: 0, value_text: null }),
      expect.objectContaining({ concept: 'Liabilities', filing_id: null, value_numeric: null, value_text: 'reported' }),
    ]);
  });
});
