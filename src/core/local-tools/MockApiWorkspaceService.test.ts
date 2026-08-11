import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MockApiWorkspaceService } from './MockApiWorkspaceService';

describe('MockApiWorkspaceService', () => {
  let workspace: string;
  beforeEach(() => { workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-mock-api-')); });
  afterEach(() => { fs.rmSync(workspace, { recursive: true, force: true }); });

  it('imports JSON and persists a deterministic local collection', () => {
    const service = new MockApiWorkspaceService(workspace);
    const collection = service.importText({ collection: 'Users', format: 'json', content: '[{"name":"Ada"}]' });
    expect(collection.name).toBe('users');
    expect(collection.records[0]).toEqual({ id: 1, name: 'Ada' });
    expect(new MockApiWorkspaceService(workspace).list('users')).toHaveLength(1);
  });

  it('imports CSV with headers', () => {
    const collection = new MockApiWorkspaceService(workspace).importText({ format: 'csv', content: 'name,status\nAda,ready\nLinus,review' });
    expect(collection.records).toEqual([{ id: 1, name: 'Ada', status: 'ready' }, { id: 2, name: 'Linus', status: 'review' }]);
  });
});
