import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Database } from './Database';

describe('Database migrations', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-db-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes SQLite and creates durable RAG knowledge tables', async () => {
    const db = new Database({
      type: 'sqlite',
      filePath: path.join(tempDir, 'chatbot.db')
    });

    await db.initialize();

    const result = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?, ?, ?)",
      ['knowledge_sources', 'ingestion_runs', 'document_chunks', 'chunk_embeddings', 'source_citations']
    );

    expect(result.rows.map(row => row.name).sort()).toEqual([
      'chunk_embeddings',
      'document_chunks',
      'ingestion_runs',
      'knowledge_sources',
      'source_citations'
    ]);

    await db.close();
  });

  const postgresIt = process.env.POSTGRES_VECTOR_TEST_URL ? it : it.skip;

  postgresIt('runs PostgreSQL pgvector migrations when an integration database is provided', async () => {
    const db = new Database({
      type: 'postgresql',
      connectionString: process.env.POSTGRES_VECTOR_TEST_URL
    });

    await db.initialize();

    const result = await db.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'chunk_embeddings' AND indexname = 'idx_chunk_embeddings_vector'"
    );

    expect(result.rowCount).toBe(1);

    await db.close();
  });
});
