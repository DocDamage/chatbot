import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Database } from '../../database/Database';
import { RAGDocumentStore } from '../RAGDocumentStore';
import { DocumentChunk } from '../../../types/rag';

describe('B75-08: RAGDocumentStore Full Dialect and Filter Coverage Matrix', () => {
  let tempDir: string;
  let db: Database;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-deep-matrix-'));
    db = new Database({
      type: 'sqlite',
      filePath: path.join(tempDir, 'test-rag.db')
    });
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('handles full lifecycle: saving chunks, listing knowledge sources, filtering, and stats', async () => {
    const store = new RAGDocumentStore(db);

    const chunk1: DocumentChunk = {
      id: 'chunk_1',
      content: 'Deep learning transformers revolutionized natural language processing and computer vision.',
      metadata: {
        source: 'papers/transformers.pdf',
        sourceType: 'pdf',
        title: 'Attention Is All You Need',
        author: 'Vaswani et al.',
        publishedDate: '2017-06-12',
        domain: 'ai',
        trustScore: 0.95,
        chunkIndex: 0
      },
      embedding: [0.1, 0.2, 0.3, 0.4]
    };

    const chunk2: DocumentChunk = {
      id: 'chunk_2',
      content: 'Retrieval Augmented Generation combines vector similarity with large language models.',
      metadata: {
        source: 'books/rag-handbook.epub',
        sourceType: 'epub',
        title: 'RAG Handbook',
        author: 'Lewis et al.',
        publishedDate: '2020-05-22',
        domain: 'ai',
        trustScore: 0.88,
        chunkIndex: 0
      },
      embedding: [0.5, 0.6, 0.7, 0.8]
    };

    await store.saveChunks([chunk1, chunk2], {
      sourceType: 'multimodal',
      embeddingProvider: 'local-onnx',
      embeddingModel: 'all-minilm'
    });

    // Stats
    const stats = await store.getStats();
    expect(stats.chunks).toBe(2);
    expect(stats.embeddings).toBe(2);

    // List knowledge sources
    const sources = await store.listSources({ limit: 10 });
    expect(sources.sources.length).toBe(2);
    expect(sources.total).toBe(2);

    // Check hasSource
    const hasTransformers = await store.hasSource('papers/transformers.pdf');
    expect(hasTransformers).toBe(true);

    const hasMissing = await store.hasSource('nonexistent/file.txt');
    expect(hasMissing).toBe(false);

    // OCR queue
    const ocrQueue = await store.getOcrQueue();
    expect(ocrQueue).toBeDefined();

    // Load chunks
    // Search keyword
    const keywordResults = await store.searchKeyword('transformers', 5);
    expect(keywordResults.length).toBeGreaterThan(0);
    expect(keywordResults[0].chunk.content).toContain('transformers');

    // Search similar vectors
    const similarResults = await store.searchSimilar([0.1, 0.2, 0.3, 0.4], 5);
    expect(similarResults.length).toBeGreaterThan(0);
    expect(similarResults[0].chunk.id).toBe('chunk_1');

    // Hybrid search
    const hybridResults = await store.hybridSearch('transformers', [0.1, 0.2, 0.3, 0.4], 5);
    expect(hybridResults.length).toBeGreaterThan(0);

    // Filtered listSources
    const qSources = await store.listSources({ q: 'transformers' });
    expect(qSources.sources.length).toBe(1);

    // Empty inputs
    await store.saveChunks([]);
    const emptyKeyword = await store.searchKeyword('', 5);
    expect(emptyKeyword).toEqual([]);
    const emptySimilar = await store.searchSimilar([], 5);
    expect(emptySimilar).toEqual([]);

    // SQLite LIKE keyword search
    const likeResults = await (store as any).searchKeywordSqliteLike(['transformers'], 5, {});
    expect(likeResults.length).toBeGreaterThan(0);

    // SQLite Candidate search
    const candidateResults = await (store as any).searchSimilarSqliteCandidates([0.1, 0.2, 0.3, 0.4], ['chunk_1', 'chunk_2'], 5, {});
    expect(candidateResults.length).toBeGreaterThan(0);
  });

  it('tests PostgreSQL dialect query builders, vector searches, and row mappings', async () => {
    const mockPgDb = {
      getType: () => 'postgresql',
      query: jest.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes('ts_rank')) {
          return Promise.resolve({
            rows: [
              {
                id: 'pg_chunk_1',
                content: 'Postgres tsvector ranking content',
                metadata: JSON.stringify({ authority: 'official', trustScore: 0.95 }),
                score: 0.85
              }
            ]
          });
        }
        if (sql.includes('<=>')) {
          return Promise.resolve({
            rows: [
              {
                id: 'pg_chunk_2',
                content: 'Postgres vector cosine similarity content',
                metadata: JSON.stringify({ authority: 'official', trustScore: 0.92 }),
                score: 0.9
              }
            ]
          });
        }
        return Promise.resolve({ rows: [] });
      }),
      batchQuery: jest.fn().mockResolvedValue([])
    };

    const pgStore = new RAGDocumentStore(mockPgDb as any);

    // PostgreSQL keyword and vector searches
    const pgKw = await pgStore.searchKeyword('postgres', 5);
    expect(pgKw.length).toBe(1);
    expect(pgKw[0].retrievalMethod).toBe('keyword');

    const pgSim = await pgStore.searchSimilar([0.1, 0.2, 0.3], 5);
    expect(pgSim.length).toBe(1);
    expect(pgSim[0].retrievalMethod).toBe('vector');

    const pgHybrid = await pgStore.hybridSearch('postgres', [0.1, 0.2, 0.3], 5);
    expect(pgHybrid.length).toBeGreaterThan(0);

    // Vector and helper utilities
    const pgVectorStr = (pgStore as any).toPgVector([0.1, 0.2, 0.3]);
    expect(pgVectorStr).toBe('[0.1,0.2,0.3]');

    const emptyPgVector = (pgStore as any).toPgVector([]);
    expect(emptyPgVector).toBeNull();

    // matchesFilters
    const match = (pgStore as any).matchesFilters(
      { metadata: { trustScore: 0.9, authority: 'official' } },
      { minTrustScore: 0.8, authority: ['official'] }
    );
    expect(match).toBe(true);

    const noMatch = (pgStore as any).matchesFilters(
      { metadata: { trustScore: 0.5, authority: 'deprecated' } },
      { excludeDeprecated: true }
    );
    expect(noMatch).toBe(false);

    // Source extension and identity normalization
    const ext = (pgStore as any).sourceExtension('file.EPUB');
    expect(ext).toBe('.epub');

    const normalizedTitle = (pgStore as any).normalizeIdentity('The Great Book (2024 Edition).epub');
    expect(normalizedTitle).toContain('great book');

    // rowToSourceRecord with warnings
    const sourceRec = (pgStore as any).rowToSourceRecord({
      id: 'ks_1',
      source: 'docs/guide.pdf',
      source_type: 'pdf',
      title: 'Guide',
      metadata: JSON.stringify({ author: 'Alice', needsOcr: true, emptyExtraction: true, extractionWarnings: ['Scanned PDF warning'] }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      latest_run_status: 'failed',
      latest_run_error: 'Parse error'
    });
    expect(sourceRec.needsOcr).toBe(true);
    expect(sourceRec.emptyExtraction).toBe(true);
    expect(sourceRec.warnings.length).toBeGreaterThan(0);
  });
});
