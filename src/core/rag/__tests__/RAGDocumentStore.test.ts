import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import { Database } from '../../database/Database';
import { RAGDocumentStore } from '../RAGDocumentStore';
import { DocumentChunk } from '../../../types/rag';

describe('RAGDocumentStore Comprehensive Retrieval, Management, and Analytics Suite', () => {
  let tempDir: string;
  let db: Database;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-store-test-'));
    db = new Database({
      type: 'sqlite',
      filePath: path.join(tempDir, 'chatbot.db')
    });
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('persists chunks and reloads them with metadata and embeddings', async () => {
    const store = new RAGDocumentStore(db);
    const chunks: DocumentChunk[] = [{
      id: 'guide.md-chunk-0',
      content: 'RAG retrieval should survive process restarts.',
      metadata: {
        source: 'guide.md',
        title: 'Guide',
        chunkIndex: 0
      },
      embedding: [0.1, 0.2, 0.3]
    }];

    await store.saveChunks(chunks, { sourceType: 'markdown', runId: 'run-1' });

    await expect(store.hasSource('guide.md')).resolves.toBe(true);
    await expect(store.hasSource('missing.md')).resolves.toBe(false);

    const loaded = await store.loadChunks();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      id: 'guide.md-chunk-0',
      content: 'RAG retrieval should survive process restarts.',
      metadata: expect.objectContaining({
        source: 'guide.md',
        title: 'Guide',
        chunkIndex: 0
      }),
      embedding: [0.1, 0.2, 0.3]
    });
  });

  it('searches persisted chunks by keyword, vector similarity, and hybrid score with filters', async () => {
    const store = new RAGDocumentStore(db);
    await store.saveChunks([
      {
        id: 'alpha-chunk-0',
        content: 'Alpha project uses durable vector retrieval.',
        metadata: { source: 'docs/alpha.md', chunkIndex: 0, project: 'alpha-proj', tag: 'target', type: 'markdown' },
        embedding: [1, 0, 0]
      },
      {
        id: 'beta-chunk-0',
        content: 'Beta project talks about unrelated cooking notes.',
        metadata: { source: 'notes/beta.md', chunkIndex: 0, tag: 'other', type: 'markdown' },
        embedding: [0, 1, 0]
      }
    ], { runId: 'run-search' });

    // 1. Keyword search
    const keyword = await store.searchKeyword('durable retrieval', 5);
    expect(keyword[0]).toMatchObject({
      chunk: expect.objectContaining({ id: 'alpha-chunk-0' }),
      retrievalMethod: 'keyword'
    });

    // 2. Keyword search with project filter
    const filteredKeyword = await store.searchKeyword('project', 5, { project: 'alpha-proj' });
    expect(filteredKeyword.length).toBe(1);
    expect(filteredKeyword[0].chunk.id).toBe('alpha-chunk-0');

    // 3. Empty query returns empty array
    expect(await store.searchKeyword('', 5)).toEqual([]);

    // 4. Similar vector search
    const similar = await store.searchSimilar([0.9, 0.1, 0], 5);
    expect(similar[0]).toMatchObject({
      chunk: expect.objectContaining({ id: 'alpha-chunk-0' }),
      retrievalMethod: 'vector'
    });

    // 5. Similar vector search with excludeDeprecated filter
    const filteredVector = await store.searchSimilar([0.9, 0.1, 0], 5, { excludeDeprecated: true });
    expect(filteredVector.length).toBe(2);

    // 6. Empty vector returns empty array
    expect(await store.searchSimilar([], 5)).toEqual([]);

    // 7. Hybrid search
    const hybrid = await store.hybridSearch('durable retrieval', [0.9, 0.1, 0], 5);
    expect(hybrid[0]).toMatchObject({
      chunk: expect.objectContaining({ id: 'alpha-chunk-0' }),
      retrievalMethod: expect.stringContaining('keyword')
    });
  });

  it('lists source metadata, duplicate groups, and OCR queue candidates', async () => {
    const store = new RAGDocumentStore(db);
    await store.saveChunks([
      {
        id: 'scan.pdf-chunk-0',
        content: 'Extraction warning for scan.pdf: no extractable text.',
        metadata: {
          source: 'scan.pdf',
          title: 'Architecture Reference Manual',
          type: 'pdf',
          needsOcr: true,
          pdfOcrStatus: 'queued',
          contentHash: 'hash-dup'
        }
      },
      {
        id: 'scan-copy.pdf-chunk-0',
        content: 'Extraction warning for scan.pdf: no extractable text.',
        metadata: {
          source: 'scan-copy.pdf',
          title: 'Architecture Reference Manual (PDF Edition)',
          type: 'pdf',
          needsOcr: true,
          pdfOcrStatus: 'queued',
          contentHash: 'hash-dup'
        }
      }
    ], { sourceType: 'pdf', runId: 'run-ocr' });

    // Stats
    const stats = await store.getStats();
    expect(stats.chunks).toBe(2);
    expect(stats.sources).toBe(2);

    // List sources
    const sourcesList = await store.listSources({ q: 'Architecture', limit: 10, offset: 0 });
    expect(sourcesList.sources.length).toBe(2);
    expect(sourcesList.total).toBe(2);

    // OCR queue
    const ocrQueue = await store.getOcrQueue();
    expect(ocrQueue.sources.length).toBe(2);

    // Duplicates only list
    const duplicates = await store.listSources({ duplicatesOnly: true });
    expect(duplicates.sources.length).toBeGreaterThan(0);
  });
});
