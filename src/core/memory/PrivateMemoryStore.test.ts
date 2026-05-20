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
});
