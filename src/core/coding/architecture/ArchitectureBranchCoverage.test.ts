import {
  detectEntrypoints,
  detectManifestFacts,
  detectProjectRoots,
  detectRoutes,
  detectTables,
  isGeneratedPath,
  isIndexablePath,
  isMigrationPath,
  isTestPath,
  modulePathForFile,
  projectRootForFile,
  roleForFile
} from './ArchitectureDetectors';
import {
  canonicalJson,
  contentDigest,
  normalizeRepositoryPath,
  sortEdges,
  sortEvidence,
  sortNodes,
  stableHash,
  stableId
} from './ArchitectureIdentity';
import { RepositoryArchitectureCache } from './RepositoryArchitectureCache';
import { RepositoryArchitectureBuilder } from './RepositoryArchitectureBuilder';
import { RepositoryArchitectureQuery } from './RepositoryArchitectureQuery';
import { validateRepositoryArchitectureSnapshot } from './RepositoryArchitectureSchema';
import {
  ArchitectureEdge,
  ArchitectureEvidence,
  ArchitectureNode,
  ScannedArchitectureFile
} from './ArchitectureTypes';
import { createArchitectureFixture } from './__tests__/ArchitectureFixture';

function scanned(file: string, content?: string): ScannedArchitectureFile {
  return {
    path: file,
    size: content?.length || 0,
    digest: contentDigest(content || ''),
    generated: false,
    binary: false,
    parsed: false,
    symbols: [],
    ...(content === undefined ? {} : { content })
  };
}

describe('CF-01 architecture branch behavior', () => {
  it('classifies generated, source, test, migration, and architectural file roles', () => {
    expect(isGeneratedPath('generated/a.ts')).toBe(true);
    expect(isGeneratedPath('src/a.generated.ts')).toBe(true);
    expect(isGeneratedPath('src/a.ts')).toBe(false);
    expect(isIndexablePath('src/a.ts')).toBe(true);
    expect(isIndexablePath('Dockerfile')).toBe(true);
    expect(isIndexablePath('image.png')).toBe(false);

    for (const file of [
      'tests/a.ts', 'src/a.test.ts', 'pkg/widget_test.go', 'test_widget.py'
    ]) expect(isTestPath(file)).toBe(true);
    expect(isTestPath('src/widget.ts')).toBe(false);
    expect(isMigrationPath('migrations/001.sql')).toBe(true);
    expect(isMigrationPath('schema/tables.ts')).toBe(true);
    expect(isMigrationPath('100_create.sql')).toBe(true);
    expect(isMigrationPath('src/model.ts')).toBe(false);

    expect(roleForFile('tests/a.ts')).toBe('test');
    expect(roleForFile('migrations/001.sql')).toBe('migration');
    expect(roleForFile('src/routes/users.ts')).toBe('api');
    expect(roleForFile('src/services/users.ts')).toBe('service');
    expect(roleForFile('client/components/User.svelte')).toBe('frontend');
    expect(roleForFile('src/models/User.ts')).toBe('data');
    expect(roleForFile('src/workers/sync.ts')).toBe('worker');
    expect(roleForFile('Dockerfile')).toBe('configuration');
    expect(roleForFile('config/app.yaml')).toBe('configuration');
    expect(roleForFile('src/misc.ts')).toBe('source');
  });

  it('detects supported route and database patterns and safely handles absent content', () => {
    expect(detectRoutes(scanned('empty.ts'))).toEqual([]);
    const routes = detectRoutes(scanned('routes.ts', [
      "app.get('/express', handler);",
      "router.post('/inline');",
      "@Get('/decorated')",
      "@api.route('/flask')",
      "@api.delete('/python-delete')",
      'http.HandleFunc("/go", goHandler)',
      'router.route("/rust", get(rust_handler))',
      "app.get('/express', handler);"
    ].join('\n')));
    expect(routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'GET', routePath: '/express', handler: 'handler' }),
      expect.objectContaining({ method: 'POST', routePath: '/inline', handler: 'inline' }),
      expect.objectContaining({ method: 'GET', routePath: '/decorated', framework: 'decorator-router' }),
      expect.objectContaining({ method: 'ANY', routePath: '/flask', framework: 'python-router' }),
      expect.objectContaining({ method: 'DELETE', routePath: '/python-delete' }),
      expect.objectContaining({ method: 'ANY', routePath: '/go', handler: 'goHandler' }),
      expect.objectContaining({ method: 'GET', routePath: '/rust', handler: 'rust_handler' })
    ]));
    expect(routes.filter(route => route.routePath === '/express')).toHaveLength(1);

    expect(detectTables(scanned('empty.sql'))).toEqual([]);
    const tables = detectTables(scanned('models.sql', [
      'CREATE TABLE IF NOT EXISTS Users (id INTEGER);',
      'model Account {',
      "__tablename__ = 'profiles'",
      "@Entity('events')",
      'SELECT * FROM users JOIN profiles ON users.id = profiles.id;',
      'INSERT INTO events VALUES (1);',
      'UPDATE users SET id = 2;',
      'DELETE FROM profiles;',
      'SELECT * FROM users;'
    ].join('\n')));
    expect(tables).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'users', kind: 'creates' }),
      expect.objectContaining({ name: 'account', kind: 'creates' }),
      expect.objectContaining({ name: 'profiles', kind: 'creates' }),
      expect.objectContaining({ name: 'events', kind: 'creates' }),
      expect.objectContaining({ name: 'users', kind: 'reads' }),
      expect.objectContaining({ name: 'events', kind: 'writes' })
    ]));
  });

  it('extracts package, Python, Rust, Go, and project manifest facts', () => {
    expect(detectManifestFacts(scanned('src/a.ts', 'export const a = 1;'))).toBeUndefined();
    expect(detectManifestFacts(scanned('package.json'))).toBeUndefined();

    const packageFacts = detectManifestFacts(scanned('package.json', JSON.stringify({
      dependencies: { express: '^5', duplicate: '1' },
      devDependencies: { jest: '^29', duplicate: '2' },
      peerDependencies: [],
      optionalDependencies: { sharp: '^1' },
      scripts: { build: 'tsc', invalid: 42 }
    })))!;
    expect(packageFacts.dependencies.map(value => value.name)).toEqual([
      'express', 'duplicate', 'jest', 'sharp'
    ]);
    expect(packageFacts.buildTargets).toEqual([
      expect.objectContaining({ name: 'build', command: 'tsc' })
    ]);

    const invalidJson = detectManifestFacts(scanned('tsconfig.json', '{'))!;
    expect(invalidJson.manifest.parseError).toBeTruthy();
    const requirements = detectManifestFacts(scanned('requirements-dev.txt', [
      '# comment', 'pytest==8', 'ruff>=1', 'pytest==8', ''
    ].join('\n')))!
    expect(requirements.dependencies.map(value => value.name)).toEqual(['pytest', 'ruff']);

    const cargo = detectManifestFacts(scanned('Cargo.toml', [
      '[package]', 'name = "demo"', '[dependencies]', 'serde = "1"',
      '[target.x86_64.dependencies]', 'libc = "1"', '[dev-dependencies]', 'jest = "1"'
    ].join('\n')))!
    expect(cargo.dependencies.map(value => value.name)).toEqual(['serde', 'libc']);

    const go = detectManifestFacts(scanned('go.mod', [
      'module example.com/demo', 'require example.com/one v1.2.3',
      '(', 'example.com/two v2.0.0', ')'
    ].join('\n')))!
    expect(go.dependencies.map(value => value.name)).toEqual(['example.com/one', 'example.com/two']);

    const python = detectManifestFacts(scanned('pyproject.toml', [
      '[project]', 'dependencies = ["requests>=2", "pydantic"]'
    ].join('\n')))!
    expect(python.dependencies.map(value => value.name)).toEqual(['requests', 'pydantic']);
  });

  it('detects roots, modules, and entrypoints with deterministic fallback behavior', () => {
    expect(detectProjectRoots(['README.md'])).toEqual(['.']);
    const roots = detectProjectRoots([
      'package.json', 'packages/api/package.json', 'native/demo.sln', 'dotnet/App.csproj'
    ]);
    expect(roots).toEqual(expect.arrayContaining(['.', 'packages/api', 'native', 'dotnet']));
    expect(projectRootForFile('packages/api/src/index.ts', roots)).toBe('packages/api');
    expect(projectRootForFile('outside/file.ts', ['packages/api'])).toBe('.');
    expect(modulePathForFile('package.json', '.')).toBeUndefined();
    expect(modulePathForFile('src/index.ts', '.')).toBe('src');
    expect(modulePathForFile('src/core/index.ts', '.')).toBe('src/core');
    expect(modulePathForFile('packages/api/src/index.ts', 'packages/api')).toBe('packages/api/src');

    const entrypoints = detectEntrypoints([
      scanned('src/server.ts', "app.get('/health', health);\napp.listen(3000);"),
      scanned('python/main.py', 'main();'),
      scanned('src/routes.ts', "router.get('/x', handler);"),
      scanned('src/ordinary.ts', 'export const value = 1;'),
      scanned('empty.ts')
    ]);
    expect(entrypoints.map(value => value.file)).toEqual(expect.arrayContaining([
      'src/server.ts', 'python/main.py', 'src/routes.ts'
    ]));
    expect(entrypoints.find(value => value.file === 'src/server.ts')!.evidence).toEqual(
      expect.arrayContaining([
        expect.stringContaining('conventional entrypoint'),
        'contains an application start call',
        'registers HTTP routes'
      ])
    );
  });

  it('normalizes, hashes, canonicalizes, sorts, caches, and evicts deterministically', () => {
    expect(normalizeRepositoryPath('')).toBe('.');
    expect(normalizeRepositoryPath('./src\\core//file.ts')).toBe('src/core/file.ts');
    expect(stableHash(['a', 'b'])).toHaveLength(64);
    expect(stableId('file', './src/a.ts')).toBe(stableId('file', 'src/a.ts'));
    expect(contentDigest('same')).toBe(contentDigest('same'));
    expect(canonicalJson({ z: 1, a: [{ b: 2, a: 1 }, null] })).toBe(
      '{"a":[{"a":1,"b":2},null],"z":1}'
    );

    const evidence: ArchitectureEvidence[] = [
      { file: 'b.ts', detail: 'z', confidence: 0.8 },
      { file: 'a.ts', line: 2, detail: 'z', confidence: 0.8 },
      { file: 'a.ts', line: 1, detail: 'z', confidence: 0.8 },
      { file: 'a.ts', line: 1, detail: 'a', confidence: 0.9 },
      { file: 'a.ts', line: 1, detail: 'a', confidence: 0.7 }
    ];
    expect(sortEvidence(evidence).map(value => value.confidence)).toEqual([0.7, 0.9, 0.8, 0.8, 0.8]);

    const nodes = [
      { id: 'b', kind: 'file' }, { id: 'a', kind: 'file' }, { id: 'z', kind: 'repository' }
    ] as ArchitectureNode[];
    expect(sortNodes(nodes).map(value => value.id)).toEqual(['a', 'b', 'z']);
    const edges = [
      { id: '3', kind: 'imports', source: 'b', target: 'a' },
      { id: '2', kind: 'imports', source: 'a', target: 'b' },
      { id: '1', kind: 'contains', source: 'b', target: 'a' }
    ] as ArchitectureEdge[];
    expect(sortEdges(edges).map(value => value.id)).toEqual(['1', '2', '3']);

    const cache = new RepositoryArchitectureCache(1);
    const value = {
      parser: 'test-parser',
      symbols: [{
        kind: 'function' as const,
        name: 'run',
        file: 'src/a.ts',
        line: 1,
        confidence: 0.9,
        parser: 'test-parser'
      }]
    };
    expect(cache.get('v1', './src/a.ts', 'one')).toBeUndefined();
    cache.set('v1', './src/a.ts', 'one', value);
    const hit = cache.get('v1', 'src/a.ts', 'one')!;
    hit.symbols[0].name = 'mutated';
    expect(cache.get('v1', 'src/a.ts', 'one')!.symbols[0].name).toBe('run');
    cache.set('v1', 'src/b.ts', 'two', value);
    expect(cache.get('v1', 'src/a.ts', 'one')).toBeUndefined();
    expect(cache.stats('v1')).toEqual(expect.objectContaining({ entries: 1, hits: 2, misses: 2 }));
    cache.clear();
    expect(cache.stats('v1')).toEqual({ hits: 0, misses: 0, entries: 0, parserVersion: 'v1' });
  });

  it('reports every malformed snapshot boundary without throwing', () => {
    expect(validateRepositoryArchitectureSnapshot(null)).toEqual({
      valid: false,
      errors: ['Snapshot must be an object.']
    });
    const fixture = createArchitectureFixture();
    try {
      const snapshot = new RepositoryArchitectureBuilder(fixture.root).build();
      const invalid = structuredClone(snapshot) as any;
      invalid.repositoryVersion = 'bad';
      invalid.snapshotDigest = '0'.repeat(64);
      invalid.repository.root = '/absolute';
      invalid.source.revision = 'wrong';
      invalid.generatedAt = 'not-a-date';
      invalid.metadata.executedRepositoryCode = true;
      invalid.metadata.analysisMode = 'dynamic';
      invalid.nodes.push({
        ...invalid.nodes[0],
        path: '/absolute/node',
        evidence: [{ file: '../escape.ts', confidence: 1, detail: 'escape' }]
      });
      invalid.nodes.push({
        ...invalid.nodes[0],
        id: invalid.nodes[0].id,
        path: 'C:\\escape.ts',
        evidence: []
      });
      invalid.edges.push({
        ...invalid.edges[0],
        id: invalid.edges[0].id,
        source: 'missing-source',
        target: 'missing-target',
        evidence: [{ file: 'C:\\escape.ts', confidence: 1, detail: 'escape' }]
      });
      const result = validateRepositoryArchitectureSnapshot(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        'repositoryVersion must be a SHA-256 digest.',
        'repository.root must be the relative approved root marker.',
        'source.revision must identify the reviewed RepoDNA revision.',
        'Node IDs must be unique.',
        'Edge IDs must be unique.',
        'snapshotDigest does not match the canonical payload.'
      ]));

      const missing = validateRepositoryArchitectureSnapshot({
        schemaVersion: 'invalid',
        metadata: {},
        repository: {},
        source: {}
      });
      expect(missing.valid).toBe(false);
      expect(missing.errors).toEqual(expect.arrayContaining([
        'nodes must be an array.',
        'edges must be an array.',
        'parserHealth must be an array.',
        'warnings must be an array.'
      ]));
    } finally {
      fixture.cleanup();
    }
  });

  it('covers exact, partial, directional, bounded, empty, and missing graph queries', () => {
    const fixture = createArchitectureFixture();
    try {
      const snapshot = new RepositoryArchitectureBuilder(fixture.root).build();
      const query = new RepositoryArchitectureQuery(snapshot);
      const service = snapshot.nodes.find(node => node.path === 'src/service.ts')!;

      expect(query.find('', Number.NaN).nodeIds.length).toBeGreaterThan(0);
      expect(query.find(service.id, 1).nodeIds).toEqual([service.id]);
      expect(query.find(service.label, 1).nodeIds).toContain(service.id);
      expect(query.find('src/service.ts', 1).nodeIds).toContain(service.id);
      expect(query.find('src/serv', 10).nodeIds).toContain(service.id);
      expect(query.find('service.ts', 10).nodeIds).toContain(service.id);
      expect(query.find('ervice', 10).nodeIds).toContain(service.id);
      expect(query.find('file', 100).nodeIds.length).toBeGreaterThan(0);
      expect(query.find('definitely-not-present', -5)).toEqual({ nodeIds: [], truncated: false });

      expect(query.neighborhood('missing-node')).toEqual({
        nodeIds: [], edgeIds: [], truncated: false, maxDepthReached: 0, warnings: []
      });
      const incoming = query.neighborhood(service.id, { direction: 'incoming', maxDepth: 2 });
      const outgoing = query.neighborhood(service.id, { direction: 'outgoing', maxDepth: 2 });
      const filtered = query.neighborhood(service.id, {
        direction: 'both', edgeKinds: ['contains'], maxDepth: 2, maxNodes: 1
      });
      expect(incoming.nodeIds).toContain(service.id);
      expect(outgoing.nodeIds).toContain(service.id);
      expect(filtered.nodeIds).toHaveLength(1);
      expect(filtered.truncated).toBe(true);

      const noTests = query.testImpact(snapshot.nodes.find(node => node.kind === 'repository')!.id, {
        maxDepth: 0,
        maxNodes: 10
      });
      expect(noTests.nodeIds.length).toBeGreaterThan(0);
      const fakeResult = {
        nodeIds: [service.id, 'missing'],
        edgeIds: ['missing'],
        truncated: false,
        maxDepthReached: 0,
        warnings: []
      };
      expect(query.nodesFor(fakeResult)).toEqual([service]);
      expect(query.edgesFor(fakeResult)).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  });
});
