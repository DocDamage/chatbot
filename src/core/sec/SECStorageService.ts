import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/Database';
import { ensureExpansionDatabase, jsonParam } from '../database/ExpansionDatabase';
import { SECFilingParser, NormalizedXBRLFact } from './SECFilingParser';

export class SECStorageService {
  constructor(private readonly database?: Database) {}

  private async db(): Promise<Database> {
    return ensureExpansionDatabase(this.database);
  }

  async upsertCompanyFromSubmissions(submissions: any): Promise<string> {
    const database = await this.db();
    const cik = this.normalizeCik(submissions.cik);
    const ticker = Array.isArray(submissions.tickers) ? submissions.tickers[0] || null : null;
    const exchange = Array.isArray(submissions.exchanges) ? submissions.exchanges[0] || null : null;

    await database.query(
      `INSERT INTO sec_companies (
        id, cik, cik_padded, ticker, name, legal_name, former_names_json,
        sic, sic_description, exchange, fiscal_year_end, entity_type,
        metadata_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (cik) DO UPDATE SET
        cik_padded = excluded.cik_padded,
        ticker = excluded.ticker,
        name = excluded.name,
        legal_name = excluded.legal_name,
        former_names_json = excluded.former_names_json,
        sic = excluded.sic,
        sic_description = excluded.sic_description,
        exchange = excluded.exchange,
        fiscal_year_end = excluded.fiscal_year_end,
        entity_type = excluded.entity_type,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at`,
      [
        uuidv4(),
        cik,
        cik.padStart(10, '0'),
        ticker,
        submissions.name || submissions.entityName || `CIK ${cik}`,
        submissions.name || null,
        jsonParam(submissions.formerNames || []),
        submissions.sic || null,
        submissions.sicDescription || null,
        exchange,
        submissions.fiscalYearEnd || null,
        submissions.entityType || null,
        jsonParam({ source: 'sec_submissions' })
      ]
    );

    const row = await database.query('SELECT id FROM sec_companies WHERE cik = ? LIMIT 1', [cik]);
    return row.rows[0].id;
  }

  async storeRecentFilings(input: {
    companyId: string;
    submissions: any;
    forms: string[];
    limit: number;
  }): Promise<number> {
    const database = await this.db();
    const recent = input.submissions?.filings?.recent || {};
    const accessionNumbers: string[] = recent.accessionNumber || [];
    const formAllowlist = new Set(input.forms.map(form => form.toUpperCase()));
    const limit = Math.min(Math.max(Number(input.limit || 25), 1), 200);

    let stored = 0;
    for (let i = 0; i < accessionNumbers.length && stored < limit; i += 1) {
      const formType = recent.form?.[i];
      if (!formType || !formAllowlist.has(String(formType).toUpperCase())) continue;

      const accessionNumber = accessionNumbers[i];
      const cik = this.normalizeCik(input.submissions.cik);
      const primaryDocument = recent.primaryDocument?.[i] || null;

      await database.query(
        `INSERT INTO sec_filings (
          id, company_id, cik, accession_number, form_type,
          filing_date, report_date, acceptance_datetime,
          act, file_number, film_number, primary_document,
          primary_document_url, filing_detail_url,
          ingest_status, metadata_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (accession_number) DO UPDATE SET
          company_id = excluded.company_id,
          cik = excluded.cik,
          form_type = excluded.form_type,
          filing_date = excluded.filing_date,
          report_date = excluded.report_date,
          acceptance_datetime = excluded.acceptance_datetime,
          act = excluded.act,
          file_number = excluded.file_number,
          film_number = excluded.film_number,
          primary_document = excluded.primary_document,
          primary_document_url = excluded.primary_document_url,
          filing_detail_url = excluded.filing_detail_url,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at`,
        [
          uuidv4(),
          input.companyId,
          cik,
          accessionNumber,
          formType,
          recent.filingDate?.[i] || null,
          recent.reportDate?.[i] || null,
          recent.acceptanceDateTime?.[i] || null,
          recent.act?.[i] || null,
          recent.fileNumber?.[i] || null,
          recent.filmNumber?.[i] || null,
          primaryDocument,
          primaryDocument ? this.documentUrl(cik, accessionNumber, primaryDocument) : null,
          this.filingUrl(cik, accessionNumber),
          'metadata_only',
          jsonParam({
            primaryDocDescription: recent.primaryDocDescription?.[i] || null,
            source: 'sec_submissions_recent'
          })
        ]
      );

      stored += 1;
    }

    return stored;
  }

  async replaceCompanyFacts(companyId: string, normalizedFacts: NormalizedXBRLFact[]): Promise<number> {
    const database = await this.db();
    await database.query('DELETE FROM sec_xbrl_facts WHERE company_id = ?', [companyId]);

    for (const fact of normalizedFacts) {
      const filingId = fact.accessionNumber ? await this.findFilingIdByAccession(fact.accessionNumber) : null;
      await database.query(
        `INSERT INTO sec_xbrl_facts (
          id, company_id, filing_id, accession_number,
          taxonomy, concept, label, description, unit,
          value_numeric, value_text,
          period_start, period_end,
          fiscal_year, fiscal_period, form_type,
          frame, filed_date, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          companyId,
          filingId,
          fact.accessionNumber || null,
          fact.taxonomy,
          fact.concept,
          fact.label || null,
          fact.description || null,
          fact.unit || null,
          fact.valueNumeric ?? null,
          fact.valueText || null,
          fact.periodStart || null,
          fact.periodEnd || null,
          fact.fiscalYear || null,
          fact.fiscalPeriod || null,
          fact.formType || null,
          fact.frame || null,
          fact.filedDate || null,
          jsonParam(fact.metadata || {})
        ]
      );
    }

    return normalizedFacts.length;
  }

  async parseAndStoreFiling(input: {
    filingId?: string;
    accessionNumber?: string;
    rawContent: string;
  }): Promise<{ filingId: string; documents: number; sections: number; chunks: number }> {
    const database = await this.db();
    const filing = await this.findFiling(input);
    const parsed = new SECFilingParser().parse(input.rawContent, { formType: filing.form_type });

    await database.query('DELETE FROM sec_filing_chunks WHERE filing_id = ?', [filing.id]);
    await database.query('DELETE FROM sec_filing_sections WHERE filing_id = ?', [filing.id]);
    await database.query('DELETE FROM sec_filing_documents WHERE filing_id = ?', [filing.id]);

    const sectionIds = new Map<number, string>();

    for (const doc of parsed.documents) {
      await database.query(
        `INSERT INTO sec_filing_documents (
          id, filing_id, sequence, filename, description,
          document_type, content_hash, size_bytes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          filing.id,
          doc.sequence,
          doc.filename,
          doc.description || null,
          doc.documentType || null,
          doc.content ? this.hash(doc.content) : null,
          doc.content ? Buffer.byteLength(doc.content) : null
        ]
      );
    }

    for (const section of parsed.sections) {
      const id = uuidv4();
      sectionIds.set(section.sectionOrder, id);
      await database.query(
        `INSERT INTO sec_filing_sections (
          id, filing_id, item_code, item_title,
          section_order, section_text,
          start_offset, end_offset, confidence, parser_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          filing.id,
          section.itemCode,
          section.itemTitle,
          section.sectionOrder,
          section.sectionText,
          section.startOffset,
          section.endOffset,
          section.confidence,
          'sec_parser_v1'
        ]
      );
    }

    for (const chunk of parsed.chunks) {
      await database.query(
        `INSERT INTO sec_filing_chunks (
          id, filing_id, section_id, chunk_index,
          content, token_count, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          filing.id,
          chunk.sectionOrder === undefined ? null : sectionIds.get(chunk.sectionOrder) || null,
          chunk.chunkIndex,
          chunk.content,
          chunk.tokenCount,
          jsonParam({ parserVersion: 'sec_parser_v1' })
        ]
      );
    }

    await database.query(
      `UPDATE sec_filings
       SET content_hash = ?, ingest_status = ?, metadata_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [parsed.contentHash, 'parsed', jsonParam({ parserVersion: 'sec_parser_v1' }), filing.id]
    );

    return {
      filingId: filing.id,
      documents: parsed.documents.length,
      sections: parsed.sections.length,
      chunks: parsed.chunks.length
    };
  }

  private async findFiling(input: { filingId?: string; accessionNumber?: string }): Promise<any> {
    const database = await this.db();
    const result = input.filingId
      ? await database.query('SELECT * FROM sec_filings WHERE id = ? LIMIT 1', [input.filingId])
      : await database.query('SELECT * FROM sec_filings WHERE accession_number = ? LIMIT 1', [input.accessionNumber]);

    if (!result.rows[0]) throw new Error('Stored SEC filing not found');
    return result.rows[0];
  }

  private async findFilingIdByAccession(accessionNumber: string): Promise<string | null> {
    const database = await this.db();
    const result = await database.query('SELECT id FROM sec_filings WHERE accession_number = ? LIMIT 1', [accessionNumber]);
    return result.rows[0]?.id || null;
  }

  private filingUrl(cik: string, accessionNumber: string): string {
    return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNumber.replace(/-/g, '')}/`;
  }

  private documentUrl(cik: string, accessionNumber: string, document: string): string {
    return `${this.filingUrl(cik, accessionNumber)}${document}`;
  }

  private normalizeCik(cik: string): string {
    const digits = String(cik || '').replace(/\D/g, '');
    if (!digits) throw new Error('CIK must contain digits');
    return String(Number(digits));
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
