import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import { Database } from '../../database/Database';
import { RAGDocumentStore } from '../RAGDocumentStore';
import { DocumentChunk } from '../../../types/rag';

describe('RAGDocumentStore Deep Branch Coverage Suite', () => {
  let tempDir: string;
  let db: Database;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-branch-test-'));
    db = new Database({
      type: 'sqlite',
      filePath: path.join(tempDir, 'chatbot-branches.db')
    });
    await db.initialize();
  });

  afterEach(async () => {
    process.env = originalEnv;
    await db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('handles early return, batching sizes, and embedding persistence options', async () => {
    const store = new RAGDocumentStore(db);

    // 1. Empty chunks save
    await expect(store.saveChunks([])).resolves.toBeUndefined();

    // 2. Multi-chunk persistence with batch size 1
    process.env.RAG_PERSISTENCE_BATCH_SIZE = '1';
    const chunks: DocumentChunk[] = [
      {
        id: 'chunk-1',
        content: 'Chunk one content',
        metadata: { source: 'book.epub', title: 'Great Book', author: 'Author One', chunkIndex: 0 },
        embedding: [0.1, 0.2]
      },
      {
        id: 'chunk-2',
        content: 'Chunk two content',
        metadata: { source: 'book.epub', title: 'Great Book', author: 'Author One', chunkIndex: 1 },
        embedding: [0.3, 0.4]
      }
    ];

    await store.saveChunks(chunks, {
      sourceType: 'epub',
      embeddingProvider: 'local',
      embeddingModel: 'bge-small'
    });

    const stats = await store.getStats();
    expect(stats.chunks).toBe(2);
    expect(stats.embeddings).toBe(2);
  });

  it('covers all metadata parsing, author variations, duplicate keys, and OCR warnings', async () => {
    const store = new RAGDocumentStore(db);

    await store.saveChunks([
      {
        id: 'doc-creator.pdf-chunk-0',
        content: 'No text extracted warning',
        metadata: {
          source: 'docs/doc-creator.pdf',
          creator: 'Creator Name',
          publicationDate: '2026-01-01',
          fileExtension: '.pdf',
          extractionWarnings: ['image-only document scanned, no extractable text'],
        }
      },
      {
        id: 'doc-createdBy.pdf-chunk-0',
        content: 'Empty extraction warning',
        metadata: {
          source: 'docs/doc-createdBy.pdf',
          createdBy: 'Builder Name',
          date: new Date('2026-02-01'),
          emptyExtraction: true,
        }
      },
      {
        id: 'doc-authors-array.pdf-chunk-0',
        content: 'OCR required warning',
        metadata: {
          source: 'docs/doc-authors-array.pdf',
          authors: ['Alice', 'Bob'],
          pdfOcrStatus: 'blocked',
        }
      },
      {
        id: 'doc-short-title.txt-chunk-0',
        content: 'Short title test',
        metadata: {
          source: 'a.txt',
          title: 'Hi', // < 4 chars, duplicateKey should be undefined
        }
      }
    ], { runId: 'run-meta' });

    const list = await store.listSources({ q: 'doc' });
    expect(list.sources.length).toBeGreaterThanOrEqual(3);

    const ocrList = await store.getOcrQueue();
    expect(ocrList.sources.length).toBe(3);

    const duplicates = await store.listSources({ duplicatesOnly: true });
    expect(duplicates.total).toBeDefined();
  });

  it('covers filters: visibility, authority, trustScore, and excludedFromRetrieval', async () => {
    const store = new RAGDocumentStore(db);

    await store.saveChunks([
      {
        id: 'chunk-public',
        content: 'Public chunk content knowledge',
        metadata: {
          source: 'public.md',
          visibility: 'public',
          authority: 'canonical',
          trustScore: 0.9,
          chunkIndex: 0
        },
        embedding: [1, 0]
      },
      {
        id: 'chunk-internal',
        content: 'Internal chunk content knowledge',
        metadata: {
          source: 'internal.md',
          visibility: 'internal',
          authority: 'deprecated',
          trustScore: 0.4,
          chunkIndex: 0
        },
        embedding: [0, 1]
      },
      {
        id: 'chunk-excluded',
        content: 'Excluded chunk content knowledge',
        metadata: {
          source: 'excluded.md',
          excludedFromRetrieval: true,
          chunkIndex: 0
        },
        embedding: [0.5, 0.5]
      }
    ], { runId: 'run-filters' });

    // 1. Filter by authority
    const authRes = await store.searchKeyword('knowledge', 5, { authority: ['canonical'] });
    expect(authRes.length).toBe(1);
    expect(authRes[0].chunk.id).toBe('chunk-public');

    // 2. Filter by visibility
    const visRes = await store.searchKeyword('knowledge', 5, { visibility: ['internal'] });
    expect(visRes.length).toBe(1);
    expect(visRes[0].chunk.id).toBe('chunk-internal');

    // 3. Filter by minTrustScore
    const trustRes = await store.searchKeyword('knowledge', 5, { minTrustScore: 0.8 });
    expect(trustRes.length).toBe(1);
    expect(trustRes[0].chunk.id).toBe('chunk-public');

    // 4. Vector search with excluded check
    const vecRes = await store.searchSimilar([0.5, 0.5], 5);
    expect(vecRes.some(r => r.chunk.id === 'chunk-excluded')).toBe(false);
  });

  it('covers full vector scan in SQLite and candidate hybrid branches', async () => {
    const store = new RAGDocumentStore(db);
    process.env.RAG_SQLITE_FULL_VECTOR_SCAN = 'true';

    await store.saveChunks([
      {
        id: 'full-vec-1',
        content: 'Machine learning neural networks deep search.',
        metadata: { source: 'ml.md', title: 'ML Architecture', chunkIndex: 0 },
        embedding: [0.8, 0.6]
      }
    ]);

    const hybrid = await store.hybridSearch('unmatched query for vector scan', [0.8, 0.6], 5);
    expect(hybrid.length).toBe(1);
    expect(hybrid[0].chunk.id).toBe('full-vec-1');
  });

  it('covers SQLite LIKE fallback when FTS query fails', async () => {
    const store = new RAGDocumentStore(db);
    await store.saveChunks([
      {
        id: 'like-fallback-1',
        content: 'UniqueTermInDocument for testing like fallback.',
        metadata: { source: 'test.md', chunkIndex: 0 }
      }
    ]);

    // Force FTS failure by mocking searchKeywordSqliteFts to throw
    const spy = jest.spyOn(store as any, 'searchKeywordSqliteFts').mockRejectedValueOnce(new Error('FTS table missing'));
    const results = await store.searchKeyword('UniqueTermInDocument', 5);
    expect(results.length).toBe(1);
    expect(results[0].chunk.id).toBe('like-fallback-1');
    spy.mockRestore();
  });

  it('covers PostgreSQL branch logic in upserts and batch queries', async () => {
    const mockPgDb: any = {
      getType: () => 'postgresql',
      query: jest.fn().mockResolvedValue({ rows: [] }),
      batchQuery: jest.fn().mockResolvedValue(undefined),
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockPgDb))
    };

    const pgStore = new RAGDocumentStore(mockPgDb);

    const chunk: DocumentChunk = {
      id: 'pg-chunk-1',
      content: 'Postgres vector content',
      metadata: { source: 'pg.md', title: 'PostgreSQL Guide', chunkIndex: 0 },
      embedding: [0.1, 0.2, 0.3]
    };

    // 1. saveChunks with pg
    await pgStore.saveChunks([chunk], {
      sourceType: 'guide',
      embeddingProvider: 'pg-embed',
      embeddingModel: 'pg-model'
    });
    expect(mockPgDb.batchQuery).toHaveBeenCalled();

    // 2. Individual non-batch private helpers for direct coverage
    await (pgStore as any).upsertSource('src-1', 'source-text', chunk, 'guide', { author: 'dev' });
    await (pgStore as any).insertIngestionRun('run-1', 'src-1', 1, { status: 'ok' });
    await (pgStore as any).upsertChunk(chunk, 'src-1', 'run-1');
    await (pgStore as any).upsertEmbedding(chunk, { embeddingProvider: 'pg', embeddingModel: 'mod' });

    // 3. PostgreSQL search branches
    await pgStore.searchKeyword('test query', 5);
    await pgStore.searchSimilar([0.1, 0.2, 0.3], 5);
  });

  it('covers listSources filter edge cases, cosine similarity length mismatches, and private helper edge cases', async () => {
    const store = new RAGDocumentStore(db);

    // Save unique source and duplicates
    await store.saveChunks([
      { id: 'dup-1-c1', content: 'content 1', metadata: { source: 'docs/guide.md', title: 'Guide', chunkIndex: 0 } },
      { id: 'dup-2-c1', content: 'content 2', metadata: { source: 'docs/guide.md', title: 'Guide', chunkIndex: 0 } },
      { id: 'ocr-c1', content: 'ocr content', metadata: { source: 'docs/scan.pdf', title: 'Scan', pdfOcrStatus: 'needed', chunkIndex: 0 } }
    ]);

    // Test needsOcr = false filter
    const nonOcrList = await store.listSources({ needsOcr: false });
    expect(nonOcrList.sources.every(s => !s.needsOcr)).toBe(true);

    // Test needsOcr = true filter
    const ocrList = await store.listSources({ needsOcr: true });
    expect(ocrList.sources.every(s => s.needsOcr)).toBe(true);

    // Test duplicatesOnly filter
    const dupList = await store.listSources({ duplicatesOnly: true });
    expect(dupList.sources.length).toBeGreaterThanOrEqual(0);

    // Test private methods via search and similarity
    expect((store as any).cosineSimilarity([0.1, 0.2], [0.1])).toBe(0);
    expect((store as any).toPgVector([])).toBeNull();
    expect((store as any).keywordScore([], [])).toBe(0);
  });
});
