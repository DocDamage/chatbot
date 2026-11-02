import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Database } from '../database/Database';
import { PrivateMemoryStore } from './PrivateMemoryStore';

describe('PrivateMemoryStore', () => {
  let database: Database;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-memory-'));
    database = new Database({ type: 'sqlite', filePath: path.join(tempDir, 'test.db') });
    await database.initialize();
  });

  afterEach(async () => {
    await database.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('stores approved private memories and recalls by query', async () => {
    const store = new PrivateMemoryStore(database);
    await store.remember({
      userId: 'user-1',
      content: 'The user prefers FL Studio for beatmaking.',
      tags: ['music', 'fl_studio'],
      importance: 0.8
    });

    const recalled = await store.recall('FL Studio', { userId: 'user-1' });

    expect(recalled).toHaveLength(1);
    expect(recalled[0].content).toContain('FL Studio');
  });

  it('keeps approval-required memories hidden unless requested', async () => {
    const store = new PrivateMemoryStore(database);
    const pending = await store.remember({
      userId: 'user-1',
      content: 'Sensitive memory awaiting approval.',
      requiresApproval: true
    });

    expect(await store.recall('Sensitive', { userId: 'user-1' })).toHaveLength(0);
    expect(await store.recall('Sensitive', { userId: 'user-1', includePending: true })).toHaveLength(1);

    await store.approve(pending.id, 'approved');
    expect(await store.recall('Sensitive', { userId: 'user-1' })).toHaveLength(1);
  });

  it('covers get, stats, rejected approval, missing database errors, and PostgreSQL queries', async () => {
    const store = new PrivateMemoryStore(database);

    // 1. Remember and get by ID
    const memory = await store.remember({
      content: 'Important private note',
      tags: ['security'],
      importance: 0.9,
      confidence: 0.85
    });

    const fetched = await store.get(memory.id);
    expect(fetched?.content).toBe('Important private note');
    expect(await store.get('non-existent-id')).toBeUndefined();

    // 2. Reject approval
    await store.approve(memory.id, 'rejected');
    const rejected = await store.get(memory.id);
    expect(rejected?.status).toBe('rejected');

    // 3. Stats
    const stats = await store.stats('local');
    expect(stats.total).toBe(1);

    // 4. Missing database error handling
    const noDbStore = new PrivateMemoryStore();
    await expect(noDbStore.remember({ content: 'test' })).rejects.toThrow('Database is required');
    await expect(noDbStore.recall('test')).rejects.toThrow('Database is required');
    await expect(noDbStore.approve('id', 'approved')).rejects.toThrow('Database is required');
    await expect(noDbStore.get('id')).rejects.toThrow('Database is required');
    expect(await noDbStore.stats()).toEqual({ total: 0, approved: 0, pending: 0 });

    // 5. Mock PostgreSQL database branches
    const mockPgDb = {
      getType: () => 'postgresql',
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO')) return { rows: [] };
        if (sql.includes('SELECT * FROM private_memories WHERE id = $1')) return { rows: [{ id: 'pg-1', user_id: 'local', content: 'pg note', tags: '["pg"]', confidence: 0.8, importance: 0.7, visibility: 'private', status: 'approved', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] };
        if (sql.includes('SELECT * FROM private_memories')) return { rows: [{ id: 'pg-1', user_id: 'local', content: 'pg note', tags: '["pg"]', confidence: 0.8, importance: 0.7, visibility: 'private', status: 'approved', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] };
        if (sql.includes('UPDATE private_memories')) return { rows: [] };
        if (sql.includes('COUNT(*)')) return { rows: [{ total: '5', approved: '4', pending: '1' }] };
        return { rows: [] };
      })
    } as any;

    const pgStore = new PrivateMemoryStore(mockPgDb);
    await pgStore.remember({ content: 'pg note' });
    await pgStore.recall('pg note');
    await pgStore.approve('pg-1', 'approved');
    await pgStore.get('pg-1');
    const pgStats = await pgStore.stats('local');
    expect(pgStats.total).toBe(5);
  });
});
