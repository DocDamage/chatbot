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
});
