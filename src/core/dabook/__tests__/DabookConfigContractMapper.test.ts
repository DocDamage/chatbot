import path from 'node:path';
import { DabookBridge } from '../DabookBridge';
import { isDabookEnabled, managedVenvPython, resolveDabookConfig } from '../DabookConfig';
import {
  dabookIngestReportSchema,
  dabookRagRecordSchema,
  DABOOK_SCHEMA_ID,
  parseIngestReport
} from '../DabookContract';
import {
  dabookBookKey,
  dabookChunkId,
  formatBreadcrumbs,
  mapRagRecords,
  mapRagRecordToChunk
} from '../DabookChunkMapper';
import { getDabookBridge, resetDabookBridgeForTests } from '../index';

const SHA = 'f'.repeat(64);

describe('resolveDabookConfig', () => {
  const root = path.resolve('/repo');

  it('is disabled by default with sane defaults', () => {
    const config = resolveDabookConfig({}, root, 'linux');
    expect(config).toMatchObject({
      enabled: false,
      profile: 'balanced',
      timeoutMs: 900_000,
      dashboard: false,
      warnings: []
    });
    expect(config.workspace).toBe(path.resolve(root, 'data', 'dabook_workspace'));
    expect(config.interpreterCandidates).toEqual([{ source: 'managed-venv', path: path.join(root, 'services', 'dabook', '.venv', 'bin', 'python') }]);
  });

  it.each(['true', 'TRUE', '1', 'yes', 'on', ' true '])('treats %j as enabled', value => {
    expect(isDabookEnabled({ DABOOK_ENABLED: value })).toBe(true);
  });

  it.each([undefined, '', 'false', '0', 'no', 'off', 'maybe'])('treats %j as disabled', value => {
    expect(isDabookEnabled({ DABOOK_ENABLED: value })).toBe(false);
  });

  it('orders interpreter candidates DABOOK_PYTHON, CHATBOT_NATIVE_PYTHON, managed venv', () => {
    const config = resolveDabookConfig({ DABOOK_PYTHON: ' C:\\py\\a.exe ', CHATBOT_NATIVE_PYTHON: 'C:\\py\\b.exe' }, root, 'win32');
    expect(config.interpreterCandidates.map(candidate => candidate.source)).toEqual(['DABOOK_PYTHON', 'CHATBOT_NATIVE_PYTHON', 'managed-venv']);
    expect(config.interpreterCandidates[0].path).toBe('C:\\py\\a.exe');
    expect(config.interpreterCandidates[2].path).toBe(managedVenvPython(root, 'win32'));
    expect(managedVenvPython(root, 'win32')).toContain(path.join('Scripts', 'python.exe'));
  });

  it('resolves a relative workspace against the working directory', () => {
    expect(resolveDabookConfig({ DABOOK_WORKSPACE: 'library/dabook' }, root).workspace).toBe(path.resolve(root, 'library', 'dabook'));
    expect(resolveDabookConfig({ DABOOK_WORKSPACE: path.resolve('/abs/ws') }, root).workspace).toBe(path.resolve('/abs/ws'));
  });

  it('accepts valid profile, timeout and dashboard settings', () => {
    const config = resolveDabookConfig({ DABOOK_PROFILE: 'LowRam', DABOOK_TIMEOUT_MS: '120000', DABOOK_DASHBOARD: 'true' }, root);
    expect(config).toMatchObject({ profile: 'lowram', timeoutMs: 120_000, dashboard: true, warnings: [] });
  });

  it('falls back with a warning on an invalid profile or timeout', () => {
    const config = resolveDabookConfig({ DABOOK_PROFILE: 'turbo', DABOOK_TIMEOUT_MS: '100' }, root);
    expect(config.profile).toBe('balanced');
    expect(config.timeoutMs).toBe(900_000);
    expect(config.warnings).toHaveLength(2);
    expect(config.warnings.join(' ')).toMatch(/DABOOK_PROFILE=turbo/);
    expect(config.warnings.join(' ')).toMatch(/DABOOK_TIMEOUT_MS=100/);
    expect(resolveDabookConfig({ DABOOK_TIMEOUT_MS: 'abc' }, root).warnings).toHaveLength(1);
  });
});

describe('dabook.ingest.v1 contract', () => {
  const book = {
    book_id: 1, sha256: SHA, source_path: 'C:/b.pdf', title: null, pages: null, doc_type: null, state: 'done',
    quality_score: null, warnings: [], datasets: { rag: 'books/x/rag.jsonl' }, counts: { rag: 3 }
  };
  const report = { schema: DABOOK_SCHEMA_ID, dabook_version: '1.1.0', books: [book] };

  it('accepts a minimal valid report and tolerates unknown extra fields', () => {
    expect(parseIngestReport(JSON.stringify(report)).books[0].counts.rag).toBe(3);
    const extended = { ...report, future_field: 1, books: [{ ...book, brand_new: true }] };
    expect(dabookIngestReportSchema.parse(extended)).toMatchObject({ future_field: 1 });
  });

  it('rejects out-of-range or unknown values', () => {
    const bad = (patch: object) => dabookIngestReportSchema.safeParse({ ...report, books: [{ ...book, ...patch }] }).success;
    expect(bad({})).toBe(true);
    expect(bad({ sha256: 'xyz' })).toBe(false);
    expect(bad({ state: 'exploded' })).toBe(false);
    expect(bad({ quality_score: 1.5 })).toBe(false);
    expect(bad({ datasets: { bogus: 'x' } })).toBe(false);
    expect(bad({ counts: { rag: -1 } })).toBe(false);
  });

  it('parseIngestReport explains what is wrong', () => {
    expect(() => parseIngestReport('   ')).toThrow(/no output/);
    expect(() => parseIngestReport('{nope')).toThrow(/single JSON document/);
    expect(() => parseIngestReport(JSON.stringify({ schema: 'x', dabook_version: '1', books: [] }))).toThrow(/does not match dabook.ingest.v1/);
  });

  it('validates rag records strictly', () => {
    const record = {
      chunk_id: 'c', book_sha256: SHA, page_start: 1, page_end: 1, breadcrumbs: [], node_ids: [], node_types: [],
      has_code: false, token_count: 1, content: 'x'
    };
    expect(dabookRagRecordSchema.safeParse(record).success).toBe(true);
    expect(dabookRagRecordSchema.safeParse({ ...record, page_start: 0 }).success).toBe(false);
    expect(dabookRagRecordSchema.safeParse({ ...record, chunk_id: '' }).success).toBe(false);
  });
});

describe('DabookChunkMapper', () => {
  const record = dabookRagRecordSchema.parse({
    chunk_id: 'disk_recovery_handbook_52f293_01_01_0001_5f200c',
    book_sha256: SHA,
    book_title: 'Disk Recovery Handbook',
    page_start: 3,
    page_end: 4,
    breadcrumbs: ['Chapter 1 Partition Basics 1', ' Using the Command Line 1 '],
    node_ids: ['p2_b3', 'p2_b4'],
    node_types: ['code', 'paragraph'],
    has_code: true,
    token_count: 473,
    quality: 0.97,
    content: 'Run the tool from a shell.'
  });
  const context = {
    sourcePath: 'C:/books/handbook.pdf',
    book: { sha256: SHA, title: 'Handbook (metadata)', pages: 8, doc_type: 'native' as const, quality_score: 0.9, license_status: 'owned' as const },
    dabookVersion: '1.1.0'
  };

  it('builds stable, source-scoped ids', () => {
    expect(dabookBookKey(SHA)).toBe('dabook:ffffffffffff');
    expect(dabookChunkId(SHA, 'c1')).toBe('dabook:ffffffffffff:c1');
    const chunk = mapRagRecordToChunk(record, context, 0);
    expect(chunk.id).toBe('dabook:ffffffffffff:disk_recovery_handbook_52f293_01_01_0001_5f200c');
    // parent_id is a foreign key to another chunk; a book is not a chunk, so it must stay unset
    expect(chunk.parentId).toBeUndefined();
    expect(chunk.metadata.bookKey).toBe('dabook:ffffffffffff');
    expect(mapRagRecordToChunk(record, context, 7).id).toBe(chunk.id); // independent of position
  });

  it('maps citation metadata the Chatbot relies on', () => {
    const { metadata, content } = mapRagRecordToChunk(record, context, 5);
    expect(content).toBe('Run the tool from a shell.');
    expect(metadata).toMatchObject({
      source: 'C:/books/handbook.pdf',
      title: 'Handbook (metadata)',
      type: 'pdf',
      originalExtension: '.pdf',
      extractor: 'dabook',
      structured: true,
      page: 3,
      pageEnd: 4,
      section: 'Chapter 1 Partition Basics 1 › Using the Command Line 1',
      breadcrumbs: record.breadcrumbs,
      nodeTypes: ['code', 'paragraph'],
      hasCode: true,
      tokenCount: 473,
      qualityScore: 0.97, // the chunk's own score wins over the book's
      bookSha256: SHA,
      dabookVersion: '1.1.0',
      docType: 'native',
      pages: 8,
      licenseStatus: 'owned',
      chunkIndex: 5
    });
  });

  it('falls back to the record title and book quality, and omits an empty section', () => {
    const bare = dabookRagRecordSchema.parse({ ...record, book_title: 'From record', breadcrumbs: [], quality: null });
    const chunk = mapRagRecordToChunk(bare, { ...context, book: { ...context.book, title: null } }, 0);
    expect(chunk.metadata.title).toBe('From record');
    expect(chunk.metadata.section).toBeUndefined();
    expect(chunk.metadata.qualityScore).toBe(0.9);
  });

  it('numbers chunks in order', () => {
    const chunks = mapRagRecords([record, { ...record, chunk_id: 'b' }], context);
    expect(chunks.map(c => c.metadata.chunkIndex)).toEqual([0, 1]);
    expect(formatBreadcrumbs(['A', '', ' B '])).toBe('A › B');
  });
});

describe('getDabookBridge', () => {
  afterEach(() => resetDabookBridgeForTests());

  it('shares one bridge (and therefore one call queue) per process', () => {
    const first = getDabookBridge();
    expect(first).toBeInstanceOf(DabookBridge);
    expect(getDabookBridge()).toBe(first);
    resetDabookBridgeForTests();
    expect(getDabookBridge()).not.toBe(first);
  });
});
