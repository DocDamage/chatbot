0\. Define “100% finished” clearly



For this repo, “100% finished” should mean:



Every visible feature has a backend route, service, persistence path, UI control, error state, and tests.

Every planned feature in docs/FEATURE\_COMPLETION\_TRACKER.md is either Verified or intentionally removed.

Every release finding in docs/RELEASE\_COMPLETION\_AUDIT.md is Fixed or Verified.

npm run type-check, npm run lint, npm test, npm run build, and the client build all pass.

No “planned only” routes remain for supposedly complete features.

No temp/test files remain in docs.

External local tools cannot run without explicit approval and an auditable run record.



The tracker already says nothing should be marked Verified unless a build, test, typecheck, lint, runtime check, or manual inspection proves it. That rule should stay.



1\. Clean repo junk first

1.1 Remove temporary SEC note file



A temporary file exists:



docs/planning/sec\_queue\_note\_test.md



It should be deleted before release. It was created during a blocked write test and is not product documentation.



Action:



git rm docs/planning/sec\_queue\_note\_test.md

git commit -m "Remove temporary SEC queue note"

2\. Finish SEC 100%



This is the biggest remaining gap.



Current state



The SEC database tables already exist for:



sec\_companies

sec\_filings

sec\_filing\_documents

sec\_filing\_sections

sec\_filing\_chunks

sec\_xbrl\_facts

sec\_ingestion\_runs

sec\_source\_citations



Those migrations are already present.



But SECService.ts currently only does status, local company search, ingestion planning, and live SEC reads. It does not actually store company submissions, filings, documents, parsed sections, chunks, or XBRL facts into the normalized tables yet.



SECFilingParser.ts now exists and can parse filing text, extract <DOCUMENT> blocks, detect 10-K / 10-Q sections, create chunks, and normalize companyfacts XBRL objects.



2.1 Add permanent SEC ingestion queue table



The migrations have sec\_ingestion\_runs, but not a detailed queue item table. Add this to src/core/database/ExpansionMigrations.ts inside secMigrations.



`CREATE TABLE IF NOT EXISTS sec\_ingestion\_queue (

&#x20; id TEXT PRIMARY KEY,

&#x20; run\_id TEXT NOT NULL,

&#x20; cik TEXT,

&#x20; ticker TEXT,

&#x20; forms\_json ${jsonType},

&#x20; limit\_per\_company INTEGER,

&#x20; include\_facts INTEGER DEFAULT 1,

&#x20; parse\_primary\_documents INTEGER DEFAULT 0,

&#x20; status TEXT NOT NULL DEFAULT 'queued',

&#x20; attempts INTEGER DEFAULT 0,

&#x20; last\_error TEXT,

&#x20; started\_at ${timestampType},

&#x20; completed\_at ${timestampType},

&#x20; metadata\_json ${jsonType},

&#x20; created\_at ${timestampType} DEFAULT ${timestampDefault},

&#x20; updated\_at ${timestampType} DEFAULT ${timestampDefault},

&#x20; FOREIGN KEY (run\_id) REFERENCES sec\_ingestion\_runs(id)

)`,

`CREATE INDEX IF NOT EXISTS idx\_sec\_ingestion\_queue\_status\_run

&#x20; ON sec\_ingestion\_queue (status, run\_id, created\_at)`,

`CREATE INDEX IF NOT EXISTS idx\_sec\_ingestion\_queue\_cik

&#x20; ON sec\_ingestion\_queue (cik)`

Edge cases

Same CIK queued twice in same run.

Ticker provided but not found in SEC ticker feed.

Queue item fails halfway after company was stored but before facts were stored.

App is restarted while item status is processing.

User queues 10,000 companies accidentally.

SQLite and PostgreSQL timestamp/JSON differences.



Add a recovery rule:



async recoverStaleProcessingItems(maxAgeMinutes = 60): Promise<number> {

&#x20; const database = await this.readyDatabase();

&#x20; const cutoff = new Date(Date.now() - maxAgeMinutes \* 60\_000).toISOString();



&#x20; const result = await database.query(

&#x20;   `UPDATE sec\_ingestion\_queue

&#x20;    SET status = 'queued',

&#x20;        last\_error = 'Recovered stale processing item',

&#x20;        updated\_at = CURRENT\_TIMESTAMP

&#x20;    WHERE status = 'processing'

&#x20;      AND started\_at < ?`,

&#x20;   \[cutoff]

&#x20; );



&#x20; return result.rowCount;

}

2.2 Add SECStorageService



Create:



src/core/sec/SECStorageService.ts



This service should be responsible for database writes only. Keep it separate from EDGARClient, which should only fetch.



import { v4 as uuidv4 } from 'uuid';

import { Database } from '../database/Database';

import { ensureExpansionDatabase, jsonParam } from '../database/ExpansionDatabase';

import { SECFilingParser, NormalizedXBRLFact } from './SECFilingParser';



export class SECStorageService {

&#x20; constructor(private readonly database?: Database) {}



&#x20; private async db(): Promise<Database> {

&#x20;   return ensureExpansionDatabase(this.database);

&#x20; }



&#x20; async upsertCompanyFromSubmissions(submissions: any): Promise<string> {

&#x20;   const database = await this.db();

&#x20;   const cik = this.normalizeCik(submissions.cik);

&#x20;   const ticker = Array.isArray(submissions.tickers) ? submissions.tickers\[0] : null;

&#x20;   const exchange = Array.isArray(submissions.exchanges) ? submissions.exchanges\[0] : null;



&#x20;   await database.query(

&#x20;     `INSERT INTO sec\_companies (

&#x20;       id, cik, cik\_padded, ticker, name, legal\_name, former\_names\_json,

&#x20;       sic, sic\_description, exchange, fiscal\_year\_end, entity\_type,

&#x20;       metadata\_json, updated\_at

&#x20;     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT\_TIMESTAMP)

&#x20;     ON CONFLICT (cik) DO UPDATE SET

&#x20;       cik\_padded = excluded.cik\_padded,

&#x20;       ticker = excluded.ticker,

&#x20;       name = excluded.name,

&#x20;       legal\_name = excluded.legal\_name,

&#x20;       former\_names\_json = excluded.former\_names\_json,

&#x20;       sic = excluded.sic,

&#x20;       sic\_description = excluded.sic\_description,

&#x20;       exchange = excluded.exchange,

&#x20;       fiscal\_year\_end = excluded.fiscal\_year\_end,

&#x20;       entity\_type = excluded.entity\_type,

&#x20;       metadata\_json = excluded.metadata\_json,

&#x20;       updated\_at = excluded.updated\_at`,

&#x20;     \[

&#x20;       uuidv4(),

&#x20;       cik,

&#x20;       cik.padStart(10, '0'),

&#x20;       ticker,

&#x20;       submissions.name || submissions.entityName || `CIK ${cik}`,

&#x20;       submissions.name || null,

&#x20;       jsonParam(submissions.formerNames || \[]),

&#x20;       submissions.sic || null,

&#x20;       submissions.sicDescription || null,

&#x20;       exchange,

&#x20;       submissions.fiscalYearEnd || null,

&#x20;       submissions.entityType || null,

&#x20;       jsonParam({ source: 'sec\_submissions' })

&#x20;     ]

&#x20;   );



&#x20;   const row = await database.query(

&#x20;     `SELECT id FROM sec\_companies WHERE cik = ? LIMIT 1`,

&#x20;     \[cik]

&#x20;   );



&#x20;   return row.rows\[0].id;

&#x20; }



&#x20; async storeRecentFilings(input: {

&#x20;   companyId: string;

&#x20;   submissions: any;

&#x20;   forms: string\[];

&#x20;   limit: number;

&#x20; }): Promise<number> {

&#x20;   const database = await this.db();

&#x20;   const recent = input.submissions?.filings?.recent || {};

&#x20;   const accessionNumbers: string\[] = recent.accessionNumber || \[];



&#x20;   let stored = 0;



&#x20;   for (let i = 0; i < accessionNumbers.length \&\& stored < input.limit; i++) {

&#x20;     const formType = recent.form?.\[i];

&#x20;     if (!formType || !input.forms.includes(formType)) continue;



&#x20;     const accessionNumber = accessionNumbers\[i];

&#x20;     const cik = this.normalizeCik(input.submissions.cik);

&#x20;     const primaryDocument = recent.primaryDocument?.\[i] || null;



&#x20;     await database.query(

&#x20;       `INSERT INTO sec\_filings (

&#x20;         id, company\_id, cik, accession\_number, form\_type,

&#x20;         filing\_date, report\_date, acceptance\_datetime,

&#x20;         act, file\_number, film\_number, primary\_document,

&#x20;         primary\_document\_url, filing\_detail\_url,

&#x20;         ingest\_status, metadata\_json, updated\_at

&#x20;       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT\_TIMESTAMP)

&#x20;       ON CONFLICT (accession\_number) DO UPDATE SET

&#x20;         company\_id = excluded.company\_id,

&#x20;         cik = excluded.cik,

&#x20;         form\_type = excluded.form\_type,

&#x20;         filing\_date = excluded.filing\_date,

&#x20;         report\_date = excluded.report\_date,

&#x20;         acceptance\_datetime = excluded.acceptance\_datetime,

&#x20;         act = excluded.act,

&#x20;         file\_number = excluded.file\_number,

&#x20;         film\_number = excluded.film\_number,

&#x20;         primary\_document = excluded.primary\_document,

&#x20;         primary\_document\_url = excluded.primary\_document\_url,

&#x20;         filing\_detail\_url = excluded.filing\_detail\_url,

&#x20;         metadata\_json = excluded.metadata\_json,

&#x20;         updated\_at = excluded.updated\_at`,

&#x20;       \[

&#x20;         uuidv4(),

&#x20;         input.companyId,

&#x20;         cik,

&#x20;         accessionNumber,

&#x20;         formType,

&#x20;         recent.filingDate?.\[i] || null,

&#x20;         recent.reportDate?.\[i] || null,

&#x20;         recent.acceptanceDateTime?.\[i] || null,

&#x20;         recent.act?.\[i] || null,

&#x20;         recent.fileNumber?.\[i] || null,

&#x20;         recent.filmNumber?.\[i] || null,

&#x20;         primaryDocument,

&#x20;         primaryDocument ? this.documentUrl(cik, accessionNumber, primaryDocument) : null,

&#x20;         this.filingUrl(cik, accessionNumber),

&#x20;         'metadata\_only',

&#x20;         jsonParam({

&#x20;           primaryDocDescription: recent.primaryDocDescription?.\[i] || null,

&#x20;           source: 'sec\_submissions\_recent'

&#x20;         })

&#x20;       ]

&#x20;     );



&#x20;     stored++;

&#x20;   }



&#x20;   return stored;

&#x20; }



&#x20; async replaceCompanyFacts(companyId: string, normalizedFacts: NormalizedXBRLFact\[]): Promise<number> {

&#x20;   const database = await this.db();



&#x20;   await database.query(`DELETE FROM sec\_xbrl\_facts WHERE company\_id = ?`, \[companyId]);



&#x20;   for (const fact of normalizedFacts) {

&#x20;     const filingId = fact.accessionNumber

&#x20;       ? await this.findFilingIdByAccession(fact.accessionNumber)

&#x20;       : null;



&#x20;     await database.query(

&#x20;       `INSERT INTO sec\_xbrl\_facts (

&#x20;         id, company\_id, filing\_id, accession\_number,

&#x20;         taxonomy, concept, label, description, unit,

&#x20;         value\_numeric, value\_text,

&#x20;         period\_start, period\_end,

&#x20;         fiscal\_year, fiscal\_period, form\_type,

&#x20;         frame, filed\_date, metadata\_json

&#x20;       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

&#x20;       \[

&#x20;         uuidv4(),

&#x20;         companyId,

&#x20;         filingId,

&#x20;         fact.accessionNumber || null,

&#x20;         fact.taxonomy,

&#x20;         fact.concept,

&#x20;         fact.label || null,

&#x20;         fact.description || null,

&#x20;         fact.unit || null,

&#x20;         fact.valueNumeric ?? null,

&#x20;         fact.valueText || null,

&#x20;         fact.periodStart || null,

&#x20;         fact.periodEnd || null,

&#x20;         fact.fiscalYear || null,

&#x20;         fact.fiscalPeriod || null,

&#x20;         fact.formType || null,

&#x20;         fact.frame || null,

&#x20;         fact.filedDate || null,

&#x20;         jsonParam(fact.metadata)

&#x20;       ]

&#x20;     );

&#x20;   }



&#x20;   return normalizedFacts.length;

&#x20; }



&#x20; async parseAndStoreFiling(input: {

&#x20;   filingId?: string;

&#x20;   accessionNumber?: string;

&#x20;   rawContent: string;

&#x20; }): Promise<{ filingId: string; documents: number; sections: number; chunks: number }> {

&#x20;   const database = await this.db();



&#x20;   const filing = await this.findFiling(input);

&#x20;   const parsed = new SECFilingParser().parse(input.rawContent, {

&#x20;     formType: filing.form\_type

&#x20;   });



&#x20;   await database.query(`DELETE FROM sec\_filing\_documents WHERE filing\_id = ?`, \[filing.id]);

&#x20;   await database.query(`DELETE FROM sec\_filing\_sections WHERE filing\_id = ?`, \[filing.id]);

&#x20;   await database.query(`DELETE FROM sec\_filing\_chunks WHERE filing\_id = ?`, \[filing.id]);



&#x20;   const sectionIds = new Map<number, string>();



&#x20;   for (const doc of parsed.documents) {

&#x20;     await database.query(

&#x20;       `INSERT INTO sec\_filing\_documents (

&#x20;         id, filing\_id, sequence, filename, description,

&#x20;         document\_type, content\_hash, size\_bytes

&#x20;       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,

&#x20;       \[

&#x20;         uuidv4(),

&#x20;         filing.id,

&#x20;         doc.sequence,

&#x20;         doc.filename,

&#x20;         doc.description || null,

&#x20;         doc.documentType || null,

&#x20;         doc.content ? this.hash(doc.content) : null,

&#x20;         doc.content ? Buffer.byteLength(doc.content) : null

&#x20;       ]

&#x20;     );

&#x20;   }



&#x20;   for (const section of parsed.sections) {

&#x20;     const id = uuidv4();

&#x20;     sectionIds.set(section.sectionOrder, id);



&#x20;     await database.query(

&#x20;       `INSERT INTO sec\_filing\_sections (

&#x20;         id, filing\_id, item\_code, item\_title,

&#x20;         section\_order, section\_text,

&#x20;         start\_offset, end\_offset, confidence, parser\_version

&#x20;       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

&#x20;       \[

&#x20;         id,

&#x20;         filing.id,

&#x20;         section.itemCode,

&#x20;         section.itemTitle,

&#x20;         section.sectionOrder,

&#x20;         section.sectionText,

&#x20;         section.startOffset,

&#x20;         section.endOffset,

&#x20;         section.confidence,

&#x20;         'sec\_parser\_v1'

&#x20;       ]

&#x20;     );

&#x20;   }



&#x20;   for (const chunk of parsed.chunks) {

&#x20;     await database.query(

&#x20;       `INSERT INTO sec\_filing\_chunks (

&#x20;         id, filing\_id, section\_id, chunk\_index,

&#x20;         content, token\_count, metadata\_json

&#x20;       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,

&#x20;       \[

&#x20;         uuidv4(),

&#x20;         filing.id,

&#x20;         chunk.sectionOrder === undefined

&#x20;           ? null

&#x20;           : sectionIds.get(chunk.sectionOrder) || null,

&#x20;         chunk.chunkIndex,

&#x20;         chunk.content,

&#x20;         chunk.tokenCount,

&#x20;         jsonParam({ parserVersion: 'sec\_parser\_v1' })

&#x20;       ]

&#x20;     );

&#x20;   }



&#x20;   await database.query(

&#x20;     `UPDATE sec\_filings

&#x20;      SET content\_hash = ?,

&#x20;          ingest\_status = ?,

&#x20;          metadata\_json = ?,

&#x20;          updated\_at = CURRENT\_TIMESTAMP

&#x20;      WHERE id = ?`,

&#x20;     \[

&#x20;       parsed.contentHash,

&#x20;       'parsed',

&#x20;       jsonParam({ parserVersion: 'sec\_parser\_v1' }),

&#x20;       filing.id

&#x20;     ]

&#x20;   );



&#x20;   return {

&#x20;     filingId: filing.id,

&#x20;     documents: parsed.documents.length,

&#x20;     sections: parsed.sections.length,

&#x20;     chunks: parsed.chunks.length

&#x20;   };

&#x20; }



&#x20; private async findFiling(input: { filingId?: string; accessionNumber?: string }): Promise<any> {

&#x20;   const database = await this.db();



&#x20;   const result = input.filingId

&#x20;     ? await database.query(`SELECT \* FROM sec\_filings WHERE id = ? LIMIT 1`, \[input.filingId])

&#x20;     : await database.query(`SELECT \* FROM sec\_filings WHERE accession\_number = ? LIMIT 1`, \[input.accessionNumber]);



&#x20;   if (!result.rows\[0]) throw new Error('Stored SEC filing not found');

&#x20;   return result.rows\[0];

&#x20; }



&#x20; private async findFilingIdByAccession(accessionNumber: string): Promise<string | null> {

&#x20;   const database = await this.db();

&#x20;   const result = await database.query(

&#x20;     `SELECT id FROM sec\_filings WHERE accession\_number = ? LIMIT 1`,

&#x20;     \[accessionNumber]

&#x20;   );

&#x20;   return result.rows\[0]?.id || null;

&#x20; }



&#x20; private filingUrl(cik: string, accessionNumber: string): string {

&#x20;   return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNumber.replace(/-/g, '')}/`;

&#x20; }



&#x20; private documentUrl(cik: string, accessionNumber: string, document: string): string {

&#x20;   return `${this.filingUrl(cik, accessionNumber)}${document}`;

&#x20; }



&#x20; private normalizeCik(cik: string): string {

&#x20;   const digits = String(cik || '').replace(/\\D/g, '');

&#x20;   if (!digits) throw new Error('CIK must contain digits');

&#x20;   return String(Number(digits));

&#x20; }



&#x20; private hash(value: string): string {

&#x20;   return require('crypto').createHash('sha256').update(value).digest('hex');

&#x20; }

}

2.3 Expand SECService



SECService should orchestrate:



Fetch SEC submissions

Upsert company

Store filing metadata

Fetch/normalize company facts

Store XBRL facts

Queue/process companies

Parse filing text



Add methods like:



async ingestCompanyByCik(cik: string, input: {

&#x20; forms?: string\[];

&#x20; limitPerCompany?: number;

&#x20; includeFacts?: boolean;

} = {}): Promise<{

&#x20; companyId: string;

&#x20; cik: string;

&#x20; filingsStored: number;

&#x20; factsStored: number;

}> {

&#x20; const normalizedCik = this.normalizeCik(cik);

&#x20; const submissions = await this.getLiveCompanySubmissions(normalizedCik);



&#x20; const storage = new SECStorageService(this.database);

&#x20; const companyId = await storage.upsertCompanyFromSubmissions(submissions);



&#x20; const filingsStored = await storage.storeRecentFilings({

&#x20;   companyId,

&#x20;   submissions,

&#x20;   forms: this.normalizeForms(input.forms),

&#x20;   limit: input.limitPerCompany || 25

&#x20; });



&#x20; let factsStored = 0;

&#x20; if (input.includeFacts !== false) {

&#x20;   const factsPayload = await this.getLiveCompanyFacts(normalizedCik);

&#x20;   const normalizedFacts = new SECFilingParser().normalizeCompanyFacts(factsPayload);

&#x20;   factsStored = await storage.replaceCompanyFacts(companyId, normalizedFacts);

&#x20; }



&#x20; return {

&#x20;   companyId,

&#x20;   cik: normalizedCik,

&#x20;   filingsStored,

&#x20;   factsStored

&#x20; };

}



Ticker ingestion:



async ingestCompanyByTicker(ticker: string, input: {

&#x20; forms?: string\[];

&#x20; limitPerCompany?: number;

} = {}) {

&#x20; const cik = await this.lookupTickerCik(ticker);

&#x20; return this.ingestCompanyByCik(cik, {

&#x20;   ...input,

&#x20;   includeFacts: true

&#x20; });

}



Queue processing:



async processQueue(input: { runId?: string; limit?: number } = {}) {

&#x20; const database = await ensureExpansionDatabase(this.database);

&#x20; const limit = Math.min(Math.max(input.limit || 5, 1), 25);



&#x20; const params: any\[] = \['queued'];

&#x20; const where = \['status = ?'];



&#x20; if (input.runId) {

&#x20;   where.push('run\_id = ?');

&#x20;   params.push(input.runId);

&#x20; }



&#x20; params.push(limit);



&#x20; const result = await database.query(

&#x20;   `SELECT \* FROM sec\_ingestion\_queue

&#x20;    WHERE ${where.join(' AND ')}

&#x20;    ORDER BY created\_at ASC

&#x20;    LIMIT ?`,

&#x20;   params

&#x20; );



&#x20; let processed = 0;

&#x20; let failed = 0;

&#x20; const results: any\[] = \[];



&#x20; for (const item of result.rows) {

&#x20;   await database.query(

&#x20;     `UPDATE sec\_ingestion\_queue

&#x20;      SET status = 'processing',

&#x20;          attempts = attempts + 1,

&#x20;          started\_at = CURRENT\_TIMESTAMP,

&#x20;          updated\_at = CURRENT\_TIMESTAMP

&#x20;      WHERE id = ?`,

&#x20;     \[item.id]

&#x20;   );



&#x20;   try {

&#x20;     const metadata = this.parseJson(item.metadata\_json, {});

&#x20;     const ingestResult = item.ticker

&#x20;       ? await this.ingestCompanyByTicker(item.ticker, metadata)

&#x20;       : await this.ingestCompanyByCik(item.cik, metadata);



&#x20;     await database.query(

&#x20;       `UPDATE sec\_ingestion\_queue

&#x20;        SET status = 'completed',

&#x20;            completed\_at = CURRENT\_TIMESTAMP,

&#x20;            updated\_at = CURRENT\_TIMESTAMP,

&#x20;            last\_error = NULL

&#x20;        WHERE id = ?`,

&#x20;       \[item.id]

&#x20;     );



&#x20;     processed++;

&#x20;     results.push({ queueId: item.id, result: ingestResult });

&#x20;   } catch (err: any) {

&#x20;     failed++;



&#x20;     await database.query(

&#x20;       `UPDATE sec\_ingestion\_queue

&#x20;        SET status = 'failed',

&#x20;            completed\_at = CURRENT\_TIMESTAMP,

&#x20;            updated\_at = CURRENT\_TIMESTAMP,

&#x20;            last\_error = ?

&#x20;        WHERE id = ?`,

&#x20;       \[err.message, item.id]

&#x20;     );



&#x20;     results.push({ queueId: item.id, error: err.message });

&#x20;   }

&#x20; }



&#x20; return { processed, failed, results };

}

Edge cases

Companyfacts payload can be huge.

fact.val can be number, string, null, or weird text.

Same fact concept may appear hundreds of times across periods.

Same accession number can already exist.

filing\_id may be missing because companyfacts references filings not yet stored.

Some companies have no ticker.

Some CIKs in SEC feeds are padded; database should store normalized and padded forms.

8-K sections are different from 10-K sections; parser should not pretend 8-K has 10-K item structure.

2.4 Expand src/server/routes/sec.ts



Current SEC routes only expose status, company search, live tickers, live submissions/facts, and ingestion planning.



Add:



router.post('/api/sec/ingest/company/cik/:cik', asyncHandler(async (req, res) => {

&#x20; const cik = sanitizeInput(String(req.params.cik || ''));

&#x20; if (!cik.trim()) return res.status(400).json({ error: 'cik is required' });



&#x20; res.json(await getService().ingestCompanyByCik(cik, {

&#x20;   forms: Array.isArray(req.body.forms) ? req.body.forms.map(String) : undefined,

&#x20;   limitPerCompany: req.body.limitPerCompany ? Number(req.body.limitPerCompany) : undefined,

&#x20;   includeFacts: req.body.includeFacts !== false

&#x20; }));

}));



router.post('/api/sec/ingest/company/ticker/:ticker', asyncHandler(async (req, res) => {

&#x20; const ticker = sanitizeInput(String(req.params.ticker || ''));

&#x20; if (!ticker.trim()) return res.status(400).json({ error: 'ticker is required' });



&#x20; res.json(await getService().ingestCompanyByTicker(ticker, {

&#x20;   forms: Array.isArray(req.body.forms) ? req.body.forms.map(String) : undefined,

&#x20;   limitPerCompany: req.body.limitPerCompany ? Number(req.body.limitPerCompany) : undefined

&#x20; }));

}));



router.post('/api/sec/ingest/queue', asyncHandler(async (req, res) => {

&#x20; res.json(await getService().queueBulkIngestion({

&#x20;   ciks: Array.isArray(req.body.ciks) ? req.body.ciks.map(String) : undefined,

&#x20;   tickers: Array.isArray(req.body.tickers) ? req.body.tickers.map(String) : undefined,

&#x20;   forms: Array.isArray(req.body.forms) ? req.body.forms.map(String) : undefined,

&#x20;   limitPerCompany: req.body.limitPerCompany ? Number(req.body.limitPerCompany) : undefined

&#x20; }));

}));



router.get('/api/sec/ingest/queue', asyncHandler(async (req, res) => {

&#x20; res.json({

&#x20;   items: await getService().listQueue(req.query.limit ? Number(req.query.limit) : undefined)

&#x20; });

}));



router.post('/api/sec/ingest/process', asyncHandler(async (req, res) => {

&#x20; res.json(await getService().processQueue({

&#x20;   runId: req.body.runId ? String(req.body.runId) : undefined,

&#x20;   limit: req.body.limit ? Number(req.body.limit) : undefined

&#x20; }));

}));



router.post('/api/sec/filings/parse', asyncHandler(async (req, res) => {

&#x20; const rawContent = String(req.body.rawContent || '');

&#x20; if (!rawContent.trim()) return res.status(400).json({ error: 'rawContent is required' });



&#x20; res.json(await getService().parseAndStoreFiling({

&#x20;   filingId: req.body.filingId ? String(req.body.filingId) : undefined,

&#x20;   accessionNumber: req.body.accessionNumber ? String(req.body.accessionNumber) : undefined,

&#x20;   rawContent

&#x20; }));

}));

Edge cases

rawContent too large for JSON body. Add upload/file path route later.

Missing SEC\_USER\_AGENT.

Invalid forms.

Queue run gets kicked off with no companies.

Facts ingestion fails but filings succeeded. Mark partial status, do not rollback everything blindly.

3\. Fix Sprite Lab from “works” to “production-grade”

Current state



The UI now has real Sprite Lab buttons for grid slicing, palette extraction, manifest generation, external CLI planning, and approved external CLI running.



The external adapter exists and supports Aseprite/LibreSprite workflows through LocalToolService. It blocks Pixelorama because its CLI export behavior is not enabled.



3.1 Replace direct “Run Approved External CLI” with plan → approve → start



Right now the UI sends approvedByUser: true directly. That is convenient, but not ideal for a production local-tool runner. The correct final flow is:



Plan external CLI.

Show exact resolved command.

User clicks Approve.

Call /api/local-tools/runs/:runId/approve.

User clicks Start.

Call /api/local-tools/runs/:runId/start.



The local tool routes now support start by run ID.



Safer UI code pattern



In SpriteLabPanel.tsx, replace direct run with:



const \[plannedExternalRun, setPlannedExternalRun] = useState<any>(null);



const planExternal = async () => {

&#x20; const result = await planExternalSpriteRun({

&#x20;   backend: externalBackend,

&#x20;   workflow: externalWorkflow(),

&#x20;   inputPath,

&#x20;   outputTarget: outputTarget.trim() || undefined

&#x20; });



&#x20; setPlannedExternalRun(result);

&#x20; setActionResult(result);

};



const approveExternal = async () => {

&#x20; if (!plannedExternalRun?.runId) throw new Error('No planned external run');



&#x20; const response = await fetch(`/api/local-tools/runs/${plannedExternalRun.runId}/approve`, {

&#x20;   method: 'POST',

&#x20;   headers: { 'Content-Type': 'application/json' },

&#x20;   body: JSON.stringify({

&#x20;     approvalNote: 'Approved from Sprite Lab'

&#x20;   })

&#x20; });



&#x20; if (!response.ok) throw new Error('Unable to approve external run');

&#x20; setActionResult(await response.json());

};



const startExternal = async () => {

&#x20; if (!plannedExternalRun?.runId) throw new Error('No planned external run');



&#x20; const response = await fetch(`/api/local-tools/runs/${plannedExternalRun.runId}/start`, {

&#x20;   method: 'POST',

&#x20;   headers: { 'Content-Type': 'application/json' },

&#x20;   body: JSON.stringify({})

&#x20; });



&#x20; if (!response.ok) throw new Error('Unable to start external run');

&#x20; setActionResult(await response.json());

};



Then UI buttons:



<button type="button" onClick={() => runAction('Plan external CLI', planExternal)}>

&#x20; Plan External CLI

</button>



<button type="button" onClick={() => runAction('Approve external CLI', approveExternal)}>

&#x20; Approve Planned CLI

</button>



<button type="button" onClick={() => runAction('Start external CLI', startExternal)}>

&#x20; Start Approved CLI

</button>

Edge cases

User plans command, changes input path, then starts old command.

Command output directory already exists.

Aseprite not registered/enabled.

Local executable disabled.

Run already completed.

Run status is running.

Output target points outside workspace.

User closes browser while tool is running.

Tool times out.

Tool writes no expected output.

3.2 Add actual output verification after CLI run



After Aseprite/LibreSprite runs, verify the expected output files exist.



Add this inside SpriteExternalToolAdapter.run() after planAndExecute:



const missingOutputs = adapter.outputFiles

&#x20; .filter(file => !file.includes('{frame'))

&#x20; .filter(file => !fs.existsSync(file));



if (result.status === 'completed' \&\& missingOutputs.length) {

&#x20; return {

&#x20;   ...result,

&#x20;   status: 'failed',

&#x20;   error: `Tool completed but expected outputs were missing: ${missingOutputs.join(', ')}`,

&#x20;   adapter

&#x20; };

}



For frame slicing, use directory check:



private hasGeneratedFrames(frameDir: string): boolean {

&#x20; if (!fs.existsSync(frameDir)) return false;

&#x20; return fs.readdirSync(frameDir).some(file => file.toLowerCase().endsWith('.png'));

}

3.3 Add external palette extraction safely



Current external adapter excludes palette\_extract. That is fine for now, because the internal Sharp palette extractor already exists, but to be complete, add an Aseprite script under:



src/core/sprite-lab/scripts/export-palette.lua



Example Lua:



local outputPath = app.params\["outputPath"]

if outputPath == nil or outputPath == "" then

&#x20; error("outputPath is required")

end



local sprite = app.activeSprite

if sprite == nil then

&#x20; error("No active sprite")

end



local colors = {}

local seen = {}



for \_, palette in ipairs(sprite.palettes) do

&#x20; for i = 0, #palette - 1 do

&#x20;   local color = palette:getColor(i)

&#x20;   local key = string.format("#%02X%02X%02X%02X", color.red, color.green, color.blue, color.alpha)

&#x20;   if not seen\[key] then

&#x20;     seen\[key] = true

&#x20;     table.insert(colors, key)

&#x20;   end

&#x20; end

end



local file = io.open(outputPath, "w")

file:write("{\\n  \\"colors\\": \[\\n")

for i, color in ipairs(colors) do

&#x20; file:write(string.format("    \\"%s\\"%s\\n", color, i < #colors and "," or ""))

end

file:write("  ]\\n}\\n")

file:close()



Then adapter workflow:



case 'palette\_extract':

&#x20; args.push(

&#x20;   '--script-param',

&#x20;   `outputPath=${layout.palettePath}`,

&#x20;   '--script',

&#x20;   path.join(this.workspaceRoot, 'src/core/sprite-lab/scripts/export-palette.lua')

&#x20; );

&#x20; outputFiles.push(layout.palettePath);

&#x20; outputDirectories.add(path.dirname(layout.palettePath));

&#x20; break;

Edge cases

.png has no embedded palette.

.aseprite has multiple palettes.

Indexed color vs RGBA.

Transparent color should be included or excluded based on option.

Too many colors.

Palette contains duplicate RGBA values.

3.4 Pixelorama



Do not fake this. Current adapter correctly blocks Pixelorama external execution.



To finish Pixelorama properly:



Add a config setting:

PIXELORAMA\_CLI\_ARGS\_JSON=\["--headless","--script","tools/pixelorama/export.gd","--","{input}","{output}"]

Add strict placeholder expansion:

private expandPixeloramaArg(arg: string, layout: OutputLayout): string {

&#x20; return arg

&#x20;   .replaceAll('{input}', layout.inputPath)

&#x20;   .replaceAll('{output}', layout.outputTarget)

&#x20;   .replaceAll('{sheet}', layout.sheetPath)

&#x20;   .replaceAll('{manifest}', layout.manifestPath);

}

Add a route guard that refuses Pixelorama unless config exists.

if (backend === 'pixelorama' \&\& !process.env.PIXELORAMA\_CLI\_ARGS\_JSON) {

&#x20; throw new Error('Pixelorama CLI template is not configured');

}

Edge cases

Pixelorama build has no CLI export support.

Godot project script needed.

Headless mode unavailable on Windows build.

Pixelorama opens GUI and hangs.

Export script succeeds but output file missing.

4\. Fix local tool security and lifecycle

Current state



Local tool runs are planned, approved, started, and recorded in local\_tool\_runs. The DB schema has status, command JSON, cwd, stdout/stderr paths, output files, approval flag, timing, and metadata.



The HTTP route can now start approved runs.



4.1 Add allowlisted tool capabilities



Right now, the external adapter builds safe Aseprite/LibreSprite args, but generic local-tool routes still accept arbitrary args. That is dangerous for “100% release.”



Add capability-level allowlists:



src/core/local-tools/LocalToolPolicy.ts



export interface LocalToolPolicyResult {

&#x20; allowed: boolean;

&#x20; reason?: string;

}



const allowedFlagsByTool: Record<string, string\[]> = {

&#x20; aseprite: \[

&#x20;   '-b',

&#x20;   '--sheet',

&#x20;   '--data',

&#x20;   '--format',

&#x20;   '--sheet-type',

&#x20;   '--list-tags',

&#x20;   '--list-slices',

&#x20;   '--list-layers',

&#x20;   '--save-as',

&#x20;   '--trim',

&#x20;   '--trim-sprite',

&#x20;   '--ignore-empty',

&#x20;   '--merge-duplicates',

&#x20;   '--split-tags',

&#x20;   '--split-slices',

&#x20;   '--split-grid',

&#x20;   '--all-layers',

&#x20;   '--split-layers',

&#x20;   '--layer',

&#x20;   '--ignore-layer',

&#x20;   '--tag',

&#x20;   '--frame-range',

&#x20;   '--extrude'

&#x20; ],

&#x20; libresprite: \[

&#x20;   '-b',

&#x20;   '--sheet',

&#x20;   '--data',

&#x20;   '--format',

&#x20;   '--sheet-type',

&#x20;   '--save-as'

&#x20; ]

};



export function validateLocalToolArgs(toolSlug: string, args: string\[]): LocalToolPolicyResult {

&#x20; const allowed = allowedFlagsByTool\[toolSlug];

&#x20; if (!allowed) return { allowed: true };



&#x20; for (const arg of args) {

&#x20;   if (arg.startsWith('-') \&\& !allowed.includes(arg)) {

&#x20;     return {

&#x20;       allowed: false,

&#x20;       reason: `Flag is not allowed for ${toolSlug}: ${arg}`

&#x20;     };

&#x20;   }

&#x20; }



&#x20; return { allowed: true };

}



Call it in LocalToolService.planRun() after executable resolution.



4.2 Add run cancellation



Add route:



router.post('/api/local-tools/runs/:runId/cancel', ...)



This needs the runner to track child processes by runId.



In LocalToolRunner.ts:



const activeRuns = new Map<string, ChildProcess>();



export function cancelLocalToolRun(runId: string): boolean {

&#x20; const child = activeRuns.get(runId);

&#x20; if (!child) return false;

&#x20; child.kill('SIGTERM');

&#x20; return true;

}

Edge cases

Run already completed.

Process ignores SIGTERM.

Need SIGKILL after grace period.

Windows process tree remains alive.

stdout/stderr still need final write.

4.3 Add output browser for local tool runs



The app needs to show generated files, not just raw paths. Add route:



router.get('/api/local-tools/runs/:runId/files', ...)

router.get('/api/local-tools/runs/:runId/files/:fileName', ...)



Security rule: only serve files inside that run’s output directory.



function assertInside(parent: string, child: string) {

&#x20; const relative = path.relative(parent, child);

&#x20; if (relative.startsWith('..') || path.isAbsolute(relative)) {

&#x20;   throw new Error('Invalid output file path');

&#x20; }

}

5\. Fix Sprite Lab UX and file browser integration



The user-facing app needs an IDE-like browser and an FL Studio-style preview browser. That means Sprite Lab should not require typing raw file paths.



5.1 File picker integration



Add a reusable file browser:



client/src/components/FileExplorerPanel.tsx



Needed features:



Workspace tree

Search/filter

File type badges

Click to select path

Preview image/audio/text

“Send to chat”

“Send to Sprite Lab”

“Open containing folder”

Collapse/expand folders

Path copy button



Backend routes likely already exist for files, but they need to be checked and finished against this UI.



Sprite Lab should accept selected file:



<FileExplorerPanel

&#x20; mode="select"

&#x20; accept={\['.png', '.ase', '.aseprite']}

&#x20; onSelect={(file) => setInputPath(file.path)}

/>

5.2 Audio preview



For FL Studio-style behavior:



Only stream audio files from workspace.

Do not load full 500 MB files into memory.

Add waveform later, but first version should play/stop.



Route:



router.get('/api/files/preview/audio', asyncHandler(async (req, res) => {

&#x20; const filePath = resolveWorkspacePath(String(req.query.path || ''));

&#x20; res.setHeader('Content-Type', mime.lookup(filePath) || 'audio/wav');

&#x20; fs.createReadStream(filePath).pipe(res);

}));



Edge cases:



MP3/WAV/OGG/FLAC.

Huge files.

Missing codec in browser.

File moved after listing.

Path traversal.

Preview should not mutate file.

6\. Finish plan / implement / debug mode separation



You previously wanted:



Plan mode: only plans and saves .md

Implement mode: only code changes

Debug mode: only debugging



That needs enforcement at backend level, not just UI labels.



6.1 Add mode policy middleware



Create:



src/core/modes/ExecutionModePolicy.ts



export type WorkMode = 'plan' | 'implement' | 'debug' | 'chat';



export function assertActionAllowed(mode: WorkMode, action: string): void {

&#x20; const allowed: Record<WorkMode, string\[]> = {

&#x20;   plan: \['create\_plan', 'update\_plan', 'read\_files', 'search\_files'],

&#x20;   implement: \['read\_files', 'write\_files', 'run\_tests', 'create\_patch'],

&#x20;   debug: \['read\_logs', 'run\_tests', 'inspect\_error', 'write\_debug\_fix'],

&#x20;   chat: \['chat']

&#x20; };



&#x20; if (!allowed\[mode]?.includes(action)) {

&#x20;   throw new Error(`Action ${action} is not allowed in ${mode} mode`);

&#x20; }

}

6.2 Server route guard



In code-changing routes:



const mode = req.headers\['x-work-mode'] || req.body.mode;



assertActionAllowed(mode, 'write\_files');

6.3 UI behavior

Plan button creates .md.

“Switch to Implement” appears only after plan exists.

Debug mode requires error/log/test failure context.

Edge cases

User asks to code while in plan mode.

User asks to debug while in implement mode.

Agent tool tries to write during plan mode.

Plan exists but is stale relative to current repo hash.

User edits plan manually.

7\. Finish gaming module



The tracker says there are many fixed creative-writing items, but the gaming module should be treated as its own product area. routeManifest.ts lists a gaming route as ready, but that does not prove the module is deep enough.



Must-have gaming module features

Game design Q\&A

Engine comparison

Asset pipeline advice

Sprite sheet analysis

RPG Maker MZ/MV plugin knowledge

Godot/Unity/MonoGame basics

Combat design

Level design

Quest design

UI/UX for games

Build/release advice

Save systems

Modding guidance within legal/safe limits

Prompt templates for game agents

Backend shape

export class GamingKnowledgeAgent {

&#x20; async answer(input: {

&#x20;   question: string;

&#x20;   engine?: 'godot' | 'unity' | 'monogame' | 'rpg-maker-mz' | 'unreal' | 'unknown';

&#x20;   projectType?: string;

&#x20;   assetsAvailable?: string\[];

&#x20; }) {

&#x20;   return {

&#x20;     answer: '',

&#x20;     assumptions: \[],

&#x20;     recommendedNextSteps: \[],

&#x20;     filesToCreate: \[],

&#x20;     risks: \[]

&#x20;   };

&#x20; }

}

Edge cases

User asks for illegal cheat tooling.

User asks to clone copyrighted game directly.

User mixes multiple engines.

User has no assets.

User has only images and wants FF7-style prerendered scenes.

User asks for 8-direction sprites from inconsistent sheets.

8\. Finish knowledge-online ingestion loop



Requirement: “If my knowledge database does not have the information, prompt to go online, then ingest it.”



This needs a real flow:



Query local RAG.

If confidence is low, return needsOnlineResearch: true.

UI shows “Search online and ingest?”

Backend fetches online sources.

Store source metadata and chunks.

Re-answer using newly ingested content.

Cite stored sources.

Code pattern

const localAnswer = await rag.answer(question);



if (localAnswer.confidence < 0.55) {

&#x20; return {

&#x20;   answer: 'I do not have enough local knowledge to answer this reliably.',

&#x20;   needsOnlineResearch: true,

&#x20;   suggestedQuery: question

&#x20; };

}



Ingest endpoint:



router.post('/api/knowledge-online/ingest', asyncHandler(async (req, res) => {

&#x20; const query = String(req.body.query || '');

&#x20; if (!query.trim()) return res.status(400).json({ error: 'query is required' });



&#x20; const result = await onlineKnowledgeService.searchAndIngest({

&#x20;   query,

&#x20;   maxSources: Number(req.body.maxSources || 5)

&#x20; });



&#x20; res.json(result);

}));

Edge cases

Bad sources.

Paywalled pages.

Duplicate source already ingested.

Source changed since last ingestion.

Conflicting sources.

User wants permanent memory vs temporary session source.

Legal/medical/financial content requires caution and source quality thresholds.

9\. Testing checklist to make this actually shippable

9.1 Required server tests



Add:



src/server/routes/\_\_tests\_\_/local-tools-routes.test.ts



Test:



it('starts a planned approved local tool run by id', async () => {

&#x20; const response = await request(app)

&#x20;   .post('/api/local-tools/run/start-approved')

&#x20;   .send({ runId: 'test-run', approvedByUser: true });



&#x20; expect(response.status).not.toBe(404);

});



Better: use mocked LocalToolService.



9.2 Sprite Lab tests



Add:



src/core/sprite-lab/SpriteExternalToolAdapter.test.ts



Test cases:



it('builds Aseprite spritesheet export args without shell', () => {

&#x20; const adapter = new SpriteExternalToolAdapter(undefined, '/repo');

&#x20; const command = adapter.buildCommand({

&#x20;   backend: 'aseprite',

&#x20;   workflow: 'spritesheet\_export',

&#x20;   inputPath: 'assets/hero.aseprite'

&#x20; });



&#x20; expect(command.args).toContain('-b');

&#x20; expect(command.args).toContain('--sheet');

&#x20; expect(command.args.join(' ')).not.toContain('\&\&');

});

it('rejects paths outside workspace', () => {

&#x20; const adapter = new SpriteExternalToolAdapter(undefined, '/repo');



&#x20; expect(() => adapter.buildCommand({

&#x20;   backend: 'aseprite',

&#x20;   workflow: 'spritesheet\_export',

&#x20;   inputPath: '../secret.aseprite'

&#x20; })).toThrow(/workspace/);

});

it('blocks Pixelorama until configured', () => {

&#x20; const adapter = new SpriteExternalToolAdapter(undefined, '/repo');



&#x20; expect(() => adapter.buildCommand({

&#x20;   backend: 'pixelorama',

&#x20;   workflow: 'spritesheet\_export',

&#x20;   inputPath: 'assets/hero.png'

&#x20; })).toThrow(/Pixelorama/);

});

9.3 SEC parser tests



Add:



src/core/sec/SECFilingParser.test.ts



it('normalizes companyfacts into flat XBRL facts', () => {

&#x20; const parser = new SECFilingParser();



&#x20; const facts = parser.normalizeCompanyFacts({

&#x20;   facts: {

&#x20;     'us-gaap': {

&#x20;       Revenues: {

&#x20;         label: 'Revenue',

&#x20;         description: 'Revenue description',

&#x20;         units: {

&#x20;           USD: \[

&#x20;             {

&#x20;               val: 1000,

&#x20;               fy: 2024,

&#x20;               fp: 'FY',

&#x20;               form: '10-K',

&#x20;               accn: '0000000000-24-000001',

&#x20;               filed: '2024-02-01',

&#x20;               frame: 'CY2024'

&#x20;             }

&#x20;           ]

&#x20;         }

&#x20;       }

&#x20;     }

&#x20;   }

&#x20; });



&#x20; expect(facts).toHaveLength(1);

&#x20; expect(facts\[0].concept).toBe('Revenues');

&#x20; expect(facts\[0].valueNumeric).toBe(1000);

});

it('falls back to full filing chunk when no 10-K sections are found', () => {

&#x20; const parser = new SECFilingParser();

&#x20; const parsed = parser.parse('Plain filing text with no item headers.');



&#x20; expect(parsed.sections).toHaveLength(0);

&#x20; expect(parsed.chunks.length).toBeGreaterThan(0);

});

9.4 SEC storage tests



Use a test SQLite DB and mock SEC payloads.



Test:



Upsert company.

Store recent filings.

Replace facts.

Parse and store filing.

Queue and process one CIK.

Failed queue item stores error.

Duplicate accession does not duplicate filing.

10\. Release gates



Run these before calling the app done:



npm run type-check:server

npm run type-check:tests

cd client \&\& npm run type-check

cd ..

npm run lint:server

npm run lint:client

npm test -- --runInBand

cd client \&\& npm test

cd ..

npm run build



Then manual runtime checks:



npm run dev



Verify:



App loads.

Mode selector works.

Sprite Lab opens.

Internal slice works on a sample PNG.

Palette extraction writes JSON.

Manifest generation writes JSON.

External Aseprite plan shows resolved command.

External Aseprite approval/start works only after approval.

SEC status loads.

SEC plan creates run.

SEC CIK ingestion stores company rows.

SEC facts ingestion stores sec\_xbrl\_facts.

SEC parser creates sections/chunks.

File explorer can select files into Sprite Lab.

Plan mode cannot code.

Implement mode can code.

Debug mode can run tests/log inspection.

11\. Priority order



Do it in this order:



Remove temp docs file.

Fix SEC storage service and routes.

Add SEC queue table migration.

Add SEC route tests and parser/storage tests.

Replace Sprite Lab direct approved run with plan → approve → start.

Add Sprite Lab adapter tests.

Add output verification for CLI runs.

Add local tool cancellation and output browser.

Finish file explorer and audio preview browser.

Enforce plan/implement/debug mode server-side.

Finish gaming module as a real specialist module.

Finish knowledge-online ingestion loop.

Run release gates.

Update FEATURE\_COMPLETION\_TRACKER.md.

Update RELEASE\_COMPLETION\_AUDIT.md.

Only mark items Verified when test/build/runtime proof exists.
