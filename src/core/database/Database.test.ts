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

  it('releases a failed SQLite initialization and can retry successfully', async () => {
    const db = new Database({ type: 'sqlite', filePath: path.join(tempDir, 'retry.db') });
    const migration = jest.spyOn(db as any, 'runMigrations').mockRejectedValueOnce(new Error('Schema setup failed'));
    await expect(db.initialize()).rejects.toThrow('Schema setup failed');
    expect((db as any).db.open).toBe(false);
    migration.mockRestore();
    try {
      await db.initialize();
      expect((await db.query("SELECT name FROM sqlite_master WHERE name = 'conversation_states'")).rowCount).toBe(1);
    } finally { await db.close(); }
  });

  it('runs SQLite schema changes in one transaction and rolls them back on failure', async () => {
    const db = new Database({ type: 'sqlite', filePath: path.join(tempDir, 'atomic.db') });
    await db.initialize();
    const native = (db as any).db;
    native.exec('DROP TABLE messages');
    const prepare = native.prepare.bind(native);
    const transactionStates: boolean[] = [];
    const spy = jest.spyOn(native, 'prepare').mockImplementation((sql: unknown) => {
      transactionStates.push(native.inTransaction);
      if (String(sql).includes('CREATE TABLE IF NOT EXISTS conversation_states')) throw new Error('Injected migration failure');
      return prepare(sql);
    });
    try {
      await expect((db as any).runMigrations()).rejects.toThrow('Injected migration failure');
      expect(transactionStates.length).toBeGreaterThan(1);
      expect(transactionStates.every(Boolean)).toBe(true);
      spy.mockRestore();
      expect((await db.query("SELECT name FROM sqlite_master WHERE name = 'messages'")).rows).toEqual([]);
    } finally { spy.mockRestore(); await db.close(); }
  });

  postgresIt('runs PostgreSQL pgvector migrations when an integration database is provided', async () => {
    const db = new Database({
      type: 'postgresql',
      connectionString: process.env.POSTGRES_VECTOR_TEST_URL
    });

    await db.initialize();

    const result = await db.query(
      "SELECT udt_name FROM information_schema.columns WHERE table_name = 'chunk_embeddings' AND column_name = 'embedding_vector'"
    );

    expect(result.rowCount).toBe(1);
    expect(result.rows[0].udt_name).toBe('vector');

    await db.close();
  });

  it('translates shared question-mark placeholders for PostgreSQL queries', () => {
    const db = new Database({ type: 'postgresql', connectionString: 'postgres://example' });

    expect((db as any).toPostgresSql('SELECT * FROM messages WHERE session_id = ? AND role = ? LIMIT ?'))
      .toBe('SELECT * FROM messages WHERE session_id = $1 AND role = $2 LIMIT $3');
  });
});
