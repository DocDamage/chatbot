import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Database } from '../../database/Database';
import { RAGDocumentStore } from '../RAGDocumentStore';
import { DocumentChunk } from '../../../types/rag';

describe('RAGDocumentStore', () => {
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
    fs.rmSync(tempDir, { recursive: true, force: true });
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

  it('searches persisted chunks by keyword, vector similarity, and hybrid score', async () => {
    const store = new RAGDocumentStore(db);
    await store.saveChunks([
      {
        id: 'alpha-chunk-0',
        content: 'Alpha project uses durable vector retrieval.',
        metadata: { source: 'alpha.md', chunkIndex: 0 },
        embedding: [1, 0, 0]
      },
      {
        id: 'beta-chunk-0',
        content: 'Beta project talks about unrelated cooking notes.',
        metadata: { source: 'beta.md', chunkIndex: 0 },
        embedding: [0, 1, 0]
      }
    ], { runId: 'run-search' });

    const keyword = await store.searchKeyword('durable retrieval', 5);
    expect(keyword[0]).toMatchObject({
      chunk: expect.objectContaining({ id: 'alpha-chunk-0' }),
      retrievalMethod: 'keyword'
    });

    const similar = await store.searchSimilar([0.9, 0.1, 0], 5);
    expect(similar[0]).toMatchObject({
      chunk: expect.objectContaining({ id: 'alpha-chunk-0' }),
      retrievalMethod: 'vector'
    });

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
          title: 'Scanned Notes',
          type: 'pdf',
          author: 'Archive Desk',
          chunkIndex: 0,
          emptyExtraction: true,
          extractionWarnings: ['PDF text extraction produced no text; queue for OCR reimport.']
        }
      },
      {
        id: 'hobbit-a.epub-chunk-0',
        content: 'Bilbo sets out on an unexpected journey.',
        metadata: {
          source: 'hobbit-a.epub',
          title: 'The Hobbit',
          type: 'epub',
          author: 'J. R. R. Tolkien',
          chunkIndex: 0
        }
      },
      {
        id: 'hobbit-b.epub-chunk-0',
        content: 'A second imported edition of the same book.',
        metadata: {
          source: 'hobbit-b.epub',
          title: 'The Hobbit',
          type: 'epub',
          author: 'J. R. R. Tolkien',
          chunkIndex: 0
        }
      }
    ], { sourceType: 'book' });

    const listed = await store.listSources({ limit: 10 });
    expect(listed.total).toBe(3);
    expect(listed.sources.find(source => source.title === 'Scanned Notes')).toMatchObject({
      author: 'Archive Desk',
      needsOcr: true,
      citationLabel: 'Scanned Notes - Archive Desk'
    });

    const ocrQueue = await store.getOcrQueue({ limit: 10 });
    expect(ocrQueue.sources).toHaveLength(1);
    expect(ocrQueue.sources[0]).toMatchObject({
      title: 'Scanned Notes',
      needsOcr: true
    });

    const duplicates = await store.listSources({ duplicatesOnly: true, limit: 10 });
    expect(duplicates.sources).toHaveLength(2);
    expect(duplicates.sources.every(source => source.duplicateCount === 2)).toBe(true);
  });
});
