import fs from 'fs';
import os from 'os';
import path from 'path';
import Sqlite from 'better-sqlite3';
import { CanonicalCliRegistry } from '../CanonicalCliRegistry';
import { CanonicalCliCommandName } from '../../../types/cli-scripts';

describe('local knowledge operations', () => {
  let root: string;
  const previous = Object.fromEntries(
    ['RAG_SQLITE_PATH', 'DATABASE_URL', 'RAG_DATABASE_URL', 'CHAT_SHADOW_REPORT_PATH'].map(
      (key) => [key, process.env[key]]
    )
  );
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-ops-'));
    process.env.RAG_SQLITE_PATH = path.join(root, 'knowledge.db');
    delete process.env.DATABASE_URL;
    delete process.env.RAG_DATABASE_URL;
    delete process.env.CHAT_SHADOW_REPORT_PATH;
  });
  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
  const run = (name: CanonicalCliCommandName, args: string[] = []) =>
    new CanonicalCliRegistry().execute(name, {
      environment: 'test',
      authenticated: false,
      bypassAuthRequested: false,
      args,
    });
  function bundle(version = '1', content = 'The cobalt observatory opens Thursday.') {
    const file = path.join(root, 'pack.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        pack: {
          id: 'local-science',
          name: 'Local science',
          category: 'custom',
          datasetIds: ['observatory'],
        },
        datasets: [
          {
            manifest: {
              id: 'observatory',
              slug: 'observatory',
              name: 'Observatory',
              provider: 'Local',
              sourceType: 'custom',
              sourceUri: 'https://example.org/observatory',
              license: { id: 'MIT', redistributable: true },
            },
            version,
            documents: [
              { id: 'hours', content, sourceUri: 'https://example.org/observatory/hours' },
            ],
          },
        ],
      })
    );
    return file;
  }
  it('installs searchable chunks, updates atomically and repeats idempotently', async () => {
    expect((await run('knowledge:install', ['--bundle', bundle()])).success).toBe(true);
    const db = new Sqlite(process.env.RAG_SQLITE_PATH!);
    try {
      expect(
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM document_chunks_fts WHERE document_chunks_fts MATCH 'cobalt'"
          )
          .get()
      ).toEqual({ n: 1 });
      expect((await run('knowledge:install', ['--bundle', bundle()])).success).toBe(true);
      expect(
        (await run('knowledge:update', ['--bundle', bundle('2', 'The observatory opens Friday.')]))
          .success
      ).toBe(true);
      expect(db.prepare('SELECT content FROM document_chunks').all()).toEqual([
        { content: 'The observatory opens Friday.' },
      ]);
      expect(db.prepare('SELECT current_version FROM knowledge_datasets').get()).toEqual({
        current_version: '2',
      });
      expect(
        (await run('knowledge:update', ['--bundle', bundle('2', 'Tampered content')])).success
      ).toBe(false);
      expect(db.prepare('SELECT content FROM document_chunks').get()).toEqual({
        content: 'The observatory opens Friday.',
      });
    } finally {
      db.close();
    }
  });
  it('rejects unknown licensing and updates of uninstalled packs', async () => {
    const file = bundle();
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.datasets[0].manifest.license.id = 'Mystery';
    fs.writeFileSync(file, JSON.stringify(data));
    expect((await run('knowledge:install', ['--bundle', file])).success).toBe(false);
    expect((await run('knowledge:update', ['--bundle', bundle()])).success).toBe(false);
  });
  it('links a second pack to existing data and removes superseded source records', async () => {
    const file = bundle();
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.datasets[0].documents.push({
      id: 'removed',
      content: 'Old document',
      sourceUri: 'https://example.org/old',
    });
    fs.writeFileSync(file, JSON.stringify(data));
    expect((await run('knowledge:install', ['--bundle', file])).success).toBe(true);
    data.pack.id = 'second-pack';
    fs.writeFileSync(file, JSON.stringify(data));
    expect((await run('knowledge:install', ['--bundle', file])).success).toBe(true);
    const db = new Sqlite(process.env.RAG_SQLITE_PATH!);
    try {
      expect(db.prepare('SELECT COUNT(*) AS n FROM knowledge_pack_memberships').get()).toEqual({
        n: 2,
      });
      data.datasets[0].version = '2';
      data.datasets[0].documents.pop();
      data.pack.precedence = 5;
      fs.writeFileSync(file, JSON.stringify(data));
      expect((await run('knowledge:update', ['--bundle', file])).success).toBe(true);
      expect(db.prepare('SELECT COUNT(*) AS n FROM knowledge_sources').get()).toEqual({ n: 1 });
      expect(db.prepare('SELECT COUNT(*) AS n FROM dataset_source_links').get()).toEqual({ n: 1 });
      expect(
        db.prepare('SELECT precedence FROM knowledge_packs WHERE id = ?').get('second-pack')
      ).toEqual({ precedence: 5 });
    } finally {
      db.close();
    }
  });
  it('reports recorded shadow comparisons and rejects empty or malformed evidence', async () => {
    const file = path.join(root, 'shadow.jsonl');
    fs.writeFileSync(
      file,
      JSON.stringify({
        requestId: 'one',
        timestamp: new Date().toISOString(),
        legacyLatencyMs: 10,
        shadowLatencyMs: 20,
        divergences: ['Model route divergence'],
      }) + '\n'
    );
    const result = await run('chat:runtime:shadow-report', ['--input', file]);
    expect(result.success).toBe(true);
    expect(JSON.parse(result.stdout)).toMatchObject({
      comparisons: 1,
      divergent: 1,
      parityRate: 0,
    });
    fs.writeFileSync(file, '');
    expect((await run('chat:runtime:shadow-report', ['--input', file])).success).toBe(false);
    fs.writeFileSync(file, '{broken');
    expect((await run('chat:runtime:shadow-report', ['--input', file])).success).toBe(false);
  });

  it('supports read-only integrity, manifest, license and provenance checks on installed data', async () => {
    expect((await run('knowledge:install', ['--bundle', bundle()])).success).toBe(true);
    for (const name of [
      'knowledge:list',
      'knowledge:stats',
      'knowledge:verify',
      'knowledge:verify-manifests',
      'check:knowledge-licenses',
      'check:knowledge-provenance',
    ] as const) {
      const result = await run(name);
      expect(result.success).toBe(true);
      expect(JSON.parse(result.stdout)).toBeDefined();
    }
    const db = new Sqlite(process.env.RAG_SQLITE_PATH!);
    try {
      db.prepare(
        "UPDATE knowledge_datasets SET metadata = '{}', source_uri = '', current_version = ''"
      ).run();
      for (const name of [
        'knowledge:verify-manifests',
        'check:knowledge-licenses',
        'check:knowledge-provenance',
      ] as const) {
        const result = await run(name);
        expect(result.success).toBe(false);
        expect(JSON.parse(result.stdout).failures).toHaveLength(1);
      }
      db.prepare('DELETE FROM dataset_jobs').run();
      db.prepare('DELETE FROM dataset_source_links').run();
      db.prepare('DELETE FROM knowledge_pack_memberships').run();
      db.prepare('DELETE FROM knowledge_dataset_versions').run();
      db.prepare('DELETE FROM knowledge_datasets').run();
      expect((await run('knowledge:verify-manifests')).stderr).toContain('No registered dataset');
    } finally {
      db.close();
    }
  });

  it('refuses inconsistent persisted license metadata', async () => {
    expect((await run('knowledge:install', ['--bundle', bundle()])).success).toBe(true);
    const db = new Sqlite(process.env.RAG_SQLITE_PATH!);
    try {
      db.prepare("UPDATE knowledge_datasets SET license_id = 'restricted'").run();
    } finally {
      db.close();
    }
    const result = await run('check:knowledge-licenses');
    expect(result.success).toBe(false);
    expect(JSON.parse(result.stdout).failures[0]).toContain('inconsistent');
  });

  it.each(['DATABASE_URL', 'RAG_DATABASE_URL'])(
    'refuses SQLite operations when %s selects a remote store',
    async (key) => {
      process.env[key] = 'postgresql://localhost/fixture';
      expect((await run('knowledge:install', ['--bundle', bundle()])).stderr).toContain(
        'SQLite only'
      );
      expect((await run('knowledge:list')).stderr).toContain('PostgreSQL database was not checked');
      expect(fs.existsSync(process.env.RAG_SQLITE_PATH!)).toBe(false);
    }
  );

  it('rejects unsupported arguments and non-file inputs before installation', async () => {
    for (const args of [
      [],
      ['--bundle'],
      ['--wrong', bundle()],
      ['--bundle', root],
      ['--bundle', bundle(), '--force'],
    ]) {
      expect((await run('knowledge:install', args)).success).toBe(false);
    }
    expect((await run('knowledge:list', ['--force'])).stderr).toContain(
      'does not accept arguments'
    );
  });

  it.each([
    'duplicateDataset',
    'duplicateMembership',
    'missingMembership',
    'wrongMembership',
    'duplicateDocument',
  ])('rejects invalid pack relationships: %s', async (mutation) => {
    const file = bundle(),
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (mutation === 'duplicateDataset') data.datasets.push(data.datasets[0]);
    if (mutation === 'duplicateMembership') data.pack.datasetIds.push('observatory');
    if (mutation === 'missingMembership') data.pack.datasetIds = [];
    if (mutation === 'wrongMembership') data.pack.datasetIds = ['elsewhere'];
    if (mutation === 'duplicateDocument')
      data.datasets[0].documents.push(data.datasets[0].documents[0]);
    fs.writeFileSync(file, JSON.stringify(data));
    expect((await run('knowledge:install', ['--bundle', file])).success).toBe(false);
    expect(fs.existsSync(process.env.RAG_SQLITE_PATH!)).toBe(false);
  });

  it('requires update for a new version and rolls back pack metadata on rejection', async () => {
    expect((await run('knowledge:install', ['--bundle', bundle()])).success).toBe(true);
    const file = bundle('2'),
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.pack.name = 'Uncommitted rename';
    fs.writeFileSync(file, JSON.stringify(data));
    expect((await run('knowledge:install', ['--bundle', file])).stderr).toContain(
      'use knowledge:update'
    );
    const db = new Sqlite(process.env.RAG_SQLITE_PATH!);
    try {
      expect(db.prepare('SELECT name FROM knowledge_packs').get()).toEqual({
        name: 'Local science',
      });
      data.pack.datasetIds = ['new-dataset'];
      data.datasets[0].manifest.id = 'new-dataset';
      fs.writeFileSync(file, JSON.stringify(data));
      expect((await run('knowledge:update', ['--bundle', file])).stderr).toContain(
        'separate migration'
      );
      expect(db.prepare('SELECT current_version FROM knowledge_datasets').get()).toEqual({
        current_version: '1',
      });
    } finally {
      db.close();
    }
  });

  it('reports parity from the configured recording path with no prompt content', async () => {
    const file = path.join(root, 'shadow.jsonl');
    process.env.CHAT_SHADOW_REPORT_PATH = file;
    fs.writeFileSync(
      file,
      JSON.stringify({
        requestId: 'one',
        timestamp: new Date().toISOString(),
        legacyLatencyMs: 10,
        shadowLatencyMs: 5,
        divergences: [],
      }) + '\n'
    );
    const result = await run('chat:runtime:shadow-report');
    expect(JSON.parse(result.stdout)).toMatchObject({
      comparisons: 1,
      divergent: 0,
      parityRate: 1,
      meanShadowLatencyMs: 5,
    });
  });
});
