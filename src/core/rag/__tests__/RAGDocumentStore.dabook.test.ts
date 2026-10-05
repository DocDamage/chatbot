import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import { Database } from '../../database/Database';
import { dabookRagRecordSchema } from '../../dabook/DabookContract';
import { mapRagRecords } from '../../dabook/DabookChunkMapper';
import { RAGDocumentStore } from '../RAGDocumentStore';

const SHA = '9'.repeat(64);

const records = (contents: string[]) => contents.map((content, n) => dabookRagRecordSchema.parse({
  chunk_id: `book_01_00_${String(n).padStart(4, '0')}_hash${n}`,
  book_sha256: SHA,
  book_title: 'Handbook',
  page_start: n + 1,
  page_end: n + 1,
  breadcrumbs: ['Chapter 1', `Section ${n}`],
  node_ids: [`p${n}_b0`],
  node_types: ['paragraph'],
  has_code: n === 1,
  token_count: 10,
  quality: 0.9,
  content
}));

const chunksFor = (contents: string[]) => mapRagRecords(records(contents), {
  sourcePath: 'C:/books/handbook.pdf',
  book: { sha256: SHA, title: 'Handbook', pages: 3, doc_type: 'native', quality_score: 0.9, license_status: 'unknown' },
  dabookVersion: '1.1.0'
});

describe('RAGDocumentStore with DABOOK chunks', () => {
  let dir: string;
  let db: Database;
  let store: RAGDocumentStore;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-store-dabook-'));
    db = new Database({ type: 'sqlite', filePath: path.join(dir, 'chatbot.db') });
    await db.initialize();
    store = new RAGDocumentStore(db);
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('keeps re-ingesting the same PDF idempotent (no duplicate chunks)', async () => {
    const contents = ['alpha chapter text', 'beta command text', 'gamma closing text'];
    await store.saveChunks(chunksFor(contents), { sourceType: 'pdf', runId: 'run-1' });
    await store.saveChunks(chunksFor(contents), { sourceType: 'pdf', runId: 'run-2' });

    const loaded = await store.loadChunks();
    expect(loaded).toHaveLength(3);
    expect(new Set(loaded.map(chunk => chunk.id)).size).toBe(3);
    await expect(store.getStats()).resolves.toMatchObject({ sources: 1, chunks: 3 });
  });

  it('replaces the previous chunks of the source when the book content changes', async () => {
    await store.saveChunks(chunksFor(['alpha', 'beta', 'gamma']), { sourceType: 'pdf' });
    await store.saveChunks(chunksFor(['alpha revised', 'beta']), { sourceType: 'pdf' });

    const loaded = await store.loadChunks();
    expect(loaded.map(chunk => chunk.content).sort()).toEqual(['alpha revised', 'beta']);
    expect(loaded.every(chunk => !chunk.content.includes('gamma'))).toBe(true);
  });

  it('round-trips the citation metadata (page, breadcrumbs, quality, extractor)', async () => {
    await store.saveChunks(chunksFor(['alpha', 'beta command', 'gamma']), { sourceType: 'pdf' });
    const loaded = (await store.loadChunks()).sort((a, b) => (a.metadata.page ?? 0) - (b.metadata.page ?? 0));

    expect(loaded[1]).toMatchObject({
      id: expect.stringMatching(/^dabook:999999999999:book_01_00_0001/),
      metadata: {
        bookKey: 'dabook:999999999999',
        extractor: 'dabook',
        structured: true,
        page: 2,
        section: 'Chapter 1 › Section 1',
        breadcrumbs: ['Chapter 1', 'Section 1'],
        hasCode: true,
        qualityScore: 0.9,
        bookSha256: SHA
      }
    });
  });

  it('lists a structured PDF as one source and records which extractor produced it', async () => {
    await store.saveChunks(chunksFor(['alpha', 'beta', 'gamma']), { sourceType: 'pdf' });
    const { sources, total } = await store.listSources({ limit: 10 });

    expect(total).toBe(1);
    expect(sources[0]).toMatchObject({ source: 'C:/books/handbook.pdf', chunks: 3, needsOcr: false });
    expect(sources[0].metadata).toMatchObject({ extractor: 'dabook', type: 'pdf' });
  });
});
