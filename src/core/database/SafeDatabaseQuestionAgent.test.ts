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
  });

  afterEach(async () => {
    await database.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('blocks mutation SQL', async () => {
    const agent = new SafeDatabaseQuestionAgent(database);
    const result = await agent.queryReadOnly('DROP TABLE document_chunks');

    expect(result.rows).toEqual([]);
    expect(result.warnings.join(' ')).toContain('SELECT');
  });

  it('blocks reads from non-allowlisted app tables', async () => {
    const agent = new SafeDatabaseQuestionAgent(database);
    const result = await agent.queryReadOnly('SELECT * FROM messages');

    expect(result.rows).toEqual([]);
    expect(result.warnings.join(' ')).toContain('messages');
  });

  it('allows read-only SQL with an automatic limit', async () => {
    const agent = new SafeDatabaseQuestionAgent(database);
    const result = await agent.queryReadOnly('SELECT COUNT(*) AS count FROM document_chunks');

    expect(result.answer).toContain('Returned');
    expect(result.rows[0]).toHaveProperty('count');
    expect(result.sql).toContain('LIMIT 100');
  });

  it('answers deterministic count questions', async () => {
    const agent = new SafeDatabaseQuestionAgent(database);
    const result = await agent.ask('How many chunks are in the database?');

    expect(result.answer).toContain('chunks:');
    expect(result.mode).toBe('known_question');
  });

  it('summarizes only allowlisted schema tables', () => {
    const agent = new SafeDatabaseQuestionAgent(database);
    const summary = agent.schemaSummary();

    expect(summary.tables.map(table => table.name)).toContain('document_chunks');
    expect(summary.tables.map(table => table.name)).not.toContain('messages');
  });
});
