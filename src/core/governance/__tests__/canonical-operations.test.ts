import fs from 'fs';
import os from 'os';
import path from 'path';
import { Database } from '../../database/Database';
import { CanonicalCommandOperations } from '../CanonicalCommandOperations';

describe('operational knowledge checks', () => {
  const original = { ...process.env };
  let root: string;
  let database: Database;
  const operations = new CanonicalCommandOperations();
  const context = { environment: 'test' as const, authenticated: false, bypassAuthRequested: false, args: [] };
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-operations-'));
    process.env.RAG_SQLITE_PATH = path.join(root, 'knowledge.db');
    delete process.env.DATABASE_URL;
    delete process.env.RAG_DATABASE_URL;
    database = new Database({ type: 'sqlite', filePath: process.env.RAG_SQLITE_PATH });
    await database.initialize();
  });
  afterEach(async () => { await database.close(); fs.rmSync(root, { recursive: true, force: true }); process.env = { ...original }; });

  it('inspects real database counts and integrity without claiming nonexistent datasets were checked', async () => {
    const stats = await operations.run('knowledge:stats', context);
    expect(JSON.parse(stats.stdout)).toMatchObject({ knowledge_sources: 0, document_chunks: 0, knowledge_datasets: 0 });
    expect((await operations.run('knowledge:verify', context)).success).toBe(true);
    expect((await operations.run('knowledge:verify-manifests', context)).success).toBe(false);
  });

  it('checks a persisted license against the manifest and rejects unknown licenses', async () => {
    const manifest = { id: 'sample', slug: 'sample', name: 'Sample', provider: 'local', sourceType: 'custom', sourceUri: 'https://example.com/source', license: { id: 'MIT', redistributable: true } };
    await database.query('INSERT INTO knowledge_datasets (id, slug, name, provider, source_type, source_uri, current_version, license_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['sample', 'sample', 'Sample', 'local', 'custom', manifest.sourceUri, '1', 'MIT', JSON.stringify({ manifest })]);
    expect((await operations.run('check:knowledge-licenses', context)).success).toBe(true);
    await database.query('UPDATE knowledge_datasets SET license_id = ?, metadata = ? WHERE id = ?',
      ['UNKNOWN', JSON.stringify({ manifest: { ...manifest, license: { id: 'UNKNOWN', redistributable: true } } }), 'sample']);
    expect((await operations.run('check:knowledge-licenses', context)).success).toBe(false);
  });
});
