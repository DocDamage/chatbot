import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Database } from './Database';
import { SafeDatabaseQuestionAgent } from './SafeDatabaseQuestionAgent';

describe('SafeDatabaseQuestionAgent', () => {
  let database: Database;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-safe-db-'));
    database = new Database({ type: 'sqlite', filePath: path.join(tempDir, 'test.db') });
    await database.initialize();

    // Insert sample test chunk for search
    await database.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        content TEXT,
        metadata TEXT
      )
    `);
    await database.query(`
      INSERT INTO document_chunks (id, content, metadata)
      VALUES ('c1', 'FL Studio mixer and channel routing concepts', '{}')
    `);
  });

  afterEach(async () => {
    await database.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('throws when uninitialized database is used', async () => {
    const agent = new SafeDatabaseQuestionAgent(undefined);
    await expect(agent.ask('how many chunks?')).rejects.toThrow('Database is not initialized');
    await expect(agent.queryReadOnly('SELECT * FROM document_chunks')).rejects.toThrow('Database is not initialized');
  });

  it('blocks mutation SQL and multi-statements', async () => {
    const agent = new SafeDatabaseQuestionAgent(database);
    const result = await agent.queryReadOnly('DROP TABLE document_chunks');

    expect(result.rows).toEqual([]);
    expect(result.warnings.join(' ')).toContain('SELECT');

    const multi = await agent.queryReadOnly('SELECT * FROM document_chunks; SELECT * FROM document_chunks');
    expect(multi.warnings.join(' ')).toContain('Multiple SQL statements');

    const comment = await agent.queryReadOnly('SELECT * FROM document_chunks -- comment');
    expect(comment.warnings.join(' ')).toContain('SQL comments are blocked');
  });

  it('blocks reads from non-allowlisted app tables', async () => {
    const agent = new SafeDatabaseQuestionAgent(database);
    const result = await agent.queryReadOnly('SELECT * FROM messages');

    expect(result.rows).toEqual([]);
    expect(result.warnings.join(' ')).toContain('messages');
  });

  it('allows read-only SQL with an automatic limit and handles custom limit', async () => {
    const agent = new SafeDatabaseQuestionAgent(database);
    const result = await agent.queryReadOnly('SELECT COUNT(*) AS count FROM document_chunks');

    expect(result.answer).toContain('Returned');
    expect(result.rows[0]).toHaveProperty('count');
    expect(result.sql).toContain('LIMIT 100');

    // Existing limit
    const custom = await agent.queryReadOnly('SELECT * FROM document_chunks LIMIT 1');
    expect(custom.sql).toBe('SELECT * FROM document_chunks LIMIT 1');
  });

  it('answers deterministic count questions across sources, embeddings, chunks, and memories', async () => {
    const agent = new SafeDatabaseQuestionAgent(database);
    const result = await agent.ask('How many chunks, sources, and embeddings are in the database?');

    expect(result.answer).toContain('chunks:');
    expect(result.mode).toBe('known_question');
  });

  it('searches knowledge chunks and handles miss fallback', async () => {
    const agent = new SafeDatabaseQuestionAgent(database);
    const found = await agent.ask('Search knowledge for FL Studio mixer');
    expect(found.answer).toContain('Found 1 matching knowledge chunk');
    expect(found.rows.length).toBe(1);

    const notFound = await agent.ask('Search knowledge for nonexistent query');
    expect(notFound.answer).toContain('No matching knowledge chunks found');
  });

  it('handles unmatched intent questions with informative help', async () => {
    const agent = new SafeDatabaseQuestionAgent(database);
    const result = await agent.ask('What is the weather outside?');
    expect(result.answer).toContain('I can safely answer database questions');
    expect(result.warnings).toContain('No safe deterministic database intent matched.');
  });

  it('summarizes only allowlisted schema tables', () => {
    const agent = new SafeDatabaseQuestionAgent(database);
    const summary = agent.schemaSummary();

    expect(summary.tables.map(table => table.name)).toContain('document_chunks');
    expect(summary.tables.map(table => table.name)).not.toContain('messages');
  });
});
