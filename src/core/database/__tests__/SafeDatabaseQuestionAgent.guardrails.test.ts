import { SafeDatabaseQuestionAgent } from '../SafeDatabaseQuestionAgent';
import { Database } from '../Database';

describe('RT-PLAT-008 / RT-DB-001: SafeDatabaseQuestionAgent Read-Only Guardrails Suite', () => {
  it('throws when uninitialized database is queried', async () => {
    const agent = new SafeDatabaseQuestionAgent();
    await expect(agent.ask('how many chunks?')).rejects.toThrow('Database is not initialized');
    await expect(agent.queryReadOnly('SELECT * FROM document_chunks')).rejects.toThrow('Database is not initialized');
  });

  it('answers count queries and handles table queries gracefully', async () => {
    const mockDb = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('private_memories')) {
          throw new Error('Table not created');
        }
        return { rows: [{ count: 42 }] };
      }),
      getType: () => 'sqlite'
    } as unknown as Database;

    const agent = new SafeDatabaseQuestionAgent(mockDb);
    const result = await agent.ask('how many chunks and memories are in the database?');
    expect(result.mode).toBe('known_question');
    expect(result.rows).toEqual([
      { label: 'chunks', count: 42 },
      { label: 'memories', count: 0 }
    ]);
  });

  it('performs knowledge searches across sqlite and postgresql', async () => {
    // 1. SQLite search
    const sqliteDb = {
      query: jest.fn(async () => ({ rows: [{ id: '1', content: 'FL Studio audio engine' }] })),
      getType: () => 'sqlite'
    } as unknown as Database;

    const sqliteAgent = new SafeDatabaseQuestionAgent(sqliteDb);
    const res1 = await sqliteAgent.ask('search knowledge for FL Studio');
    expect(res1.answer).toContain('Found 1 matching knowledge chunk');

    // 2. PostgreSQL ILIKE search
    const pgDb = {
      query: jest.fn(async () => ({ rows: [] })),
      getType: () => 'postgresql'
    } as unknown as Database;

    const pgAgent = new SafeDatabaseQuestionAgent(pgDb);
    const res2 = await pgAgent.ask('find documents about nothing');
    expect(res2.answer).toBe('No matching knowledge chunks found.');

    // 3. Fallback generic question
    const res3 = await pgAgent.ask('tell me a funny joke');
    expect(res3.warnings).toContain('No safe deterministic database intent matched.');
  });

  it('validates and blocks unsafe, mutating, multi-statement, comment, and non-allowlisted SQL', async () => {
    const mockDb = {
      query: jest.fn(async (sql: string) => ({ rows: [{ id: 1 }] })),
      getType: () => 'sqlite'
    } as unknown as Database;

    const agent = new SafeDatabaseQuestionAgent(mockDb);

    // 1. Valid safe SQL
    const valid = await agent.queryReadOnly('SELECT id, content FROM document_chunks');
    expect(valid.warnings.length).toBe(0);
    expect(valid.sql).toContain('LIMIT 100');

    // 2. Block non-SELECT (e.g. DELETE)
    const delRes = await agent.queryReadOnly('DELETE FROM document_chunks');
    expect(delRes.warnings).toContain('SQL must start with SELECT.');
    expect(delRes.warnings).toContain('Mutation, DDL, admin, and bulk commands are blocked.');

    // 3. Block multi-statement
    const multiRes = await agent.queryReadOnly('SELECT 1 FROM document_chunks; DROP TABLE users;');
    expect(multiRes.warnings).toContain('Multiple SQL statements are not allowed.');

    // 4. Block SQL comments
    const commentRes = await agent.queryReadOnly('SELECT * FROM document_chunks -- comment injection');
    expect(commentRes.warnings).toContain('SQL comments are blocked.');

    // 5. Block non-allowlisted table
    const forbiddenTable = await agent.queryReadOnly('SELECT * FROM users');
    expect(forbiddenTable.warnings).toContain('Table is not allowlisted for safe SQL: users.');
  });

  it('generates a complete safe schema summary with table purposes', () => {
    const agent = new SafeDatabaseQuestionAgent();
    const summary = agent.schemaSummary();
    expect(summary.tables.length).toBe(8);
    expect(summary.tables.some(t => t.name === 'document_chunks')).toBe(true);
    expect(summary.tables.some(t => t.name === 'governance_evidence_reports')).toBe(true);
  });
});
