import fs from 'fs';
import os from 'os';
import path from 'path';
import { IndexedSymbol } from '../index/ParserProvider';
import { ArchitectureFeatureCollector } from './ArchitectureFeatureCollector';
import { ArchitectureGraphCollector } from './ArchitectureGraphCollector';
import { contentDigest } from './ArchitectureIdentity';
import { ArchitectureStructureCollector } from './ArchitectureStructureCollector';
import {
  ArchitectureNode,
  ScannedArchitectureFile
} from './ArchitectureTypes';
import { RepositoryArchitectureBuilder } from './RepositoryArchitectureBuilder';

function symbol(
  file: string,
  name: string,
  kind: IndexedSymbol['kind'],
  line: number,
  extras: Partial<IndexedSymbol> = {}
): IndexedSymbol {
  return {
    kind,
    name,
    file,
    line,
    confidence: 0.9,
    parser: 'coverage-parser',
    ...extras
  };
}

function scanned(
  file: string,
  content?: string,
  options: Partial<ScannedArchitectureFile> = {}
): ScannedArchitectureFile {
  return {
    path: file,
    size: content?.length || 0,
    digest: contentDigest(content || `${file}:metadata`),
    generated: false,
    binary: false,
    parsed: false,
    symbols: [],
    ...(content === undefined ? {} : { content }),
    ...options
  };
}

function graphNode(
  id: string,
  label: string,
  confidence: number,
  evidence: ArchitectureNode['evidence'],
  attributes: ArchitectureNode['attributes'] = {}
): ArchitectureNode {
  return {
    id,
    kind: 'file',
    label,
    confidence,
    attributes,
    evidence,
    path: `${label}.ts`
  };
}

describe('CF-01 collector branch coverage', () => {
  it('merges graph nodes and edges while enforcing bounds and warning deduplication', () => {
    const graph = new ArchitectureGraphCollector(2);
    const first = graphNode('file:a', 'a', 0.5, [
      {
        file: 'a.ts',
        line: 1,
        parser: 'typescript',
        confidence: 0.5,
        detail: 'declaration'
      }
    ], { first: true });
    const second = graphNode('file:a', 'a', 0.9, [
      {
        file: 'a.ts',
        line: 1,
        parser: 'typescript',
        confidence: 0.4,
        detail: 'declaration'
      },
      { file: 'a.ts', line: 2, confidence: 0.8, detail: 'additional evidence' }
    ], { second: true });
    graph.addNode(first);
    graph.addNode(second);
    graph.addNode(graphNode('file:b', 'b', 0.7, [
      { file: 'b.ts', confidence: 0.7, detail: 'metadata' }
    ]));

    expect(graph.hasNode('file:a')).toBe(true);
    expect(graph.hasNode('missing')).toBe(false);
    const merged = graph.nodes().find(node => node.id === 'file:a')!;
    expect(merged.confidence).toBe(0.9);
    expect(merged.attributes).toEqual({ first: true, second: true });
    expect(merged.evidence).toHaveLength(2);
    expect(merged.evidence[0].confidence).toBe(0.5);

    expect(graph.addEdge('imports', 'file:a', 'file:a', 1, [])).toBeUndefined();
    const edgeId = graph.addEdge('imports', 'file:a', 'file:b', 0.5, [
      { file: 'a.ts', line: 1, confidence: 0.5, detail: 'imports b' }
    ]);
    expect(edgeId).toBeDefined();
    expect(graph.addEdge('imports', 'file:a', 'file:b', 0.95, [
      { file: 'a.ts', line: 1, confidence: 0.95, detail: 'imports b' },
      { file: 'a.ts', confidence: 0.7, detail: 'second import proof' }
    ])).toBe(edgeId);
    expect(graph.addEdge('contains', 'file:b', 'file:a', 0.8, [])).toBeDefined();
    expect(graph.addEdge('calls', 'file:a', 'file:b', 0.8, [])).toBeUndefined();
    expect(graph.addEdge('references', 'file:b', 'file:a', 0.8, [])).toBeUndefined();

    graph.warn('CUSTOM', 'without a file');
    graph.warn('CUSTOM', 'without a file');
    graph.warn('CUSTOM', 'with a file', 'a.ts');
    expect(graph.warnings.filter(warning => warning.code === 'EDGE_LIMIT_REACHED')).toHaveLength(1);
    expect(graph.warnings.filter(warning => warning.code === 'CUSTOM')).toHaveLength(2);
    expect(graph.edges().find(edge => edge.id === edgeId)).toEqual(expect.objectContaining({
      confidence: 0.95,
      evidence: expect.arrayContaining([
        expect.objectContaining({ detail: 'second import proof' })
      ])
    }));

    const dangling = new ArchitectureGraphCollector(5);
    dangling.addNode(first);
    dangling.addEdge('imports', 'file:a', 'missing', 0.5, []);
    expect(dangling.edges()).toEqual([]);
  });

  it('collects hierarchy, manifests, tests, migrations, routes, tables, and reused dependencies', () => {
    const files: ScannedArchitectureFile[] = [
      scanned('package.json', JSON.stringify({
        name: 'root-app',
        scripts: { build: 'tsc', invalid: 42 },
        dependencies: { express: '^5', shared: '1' }
      })),
      scanned('tsconfig.json', '{'),
      scanned('README.md'),
      scanned('main.ts', 'export const main = true;'),
      scanned('src/service.ts', [
        'export function run(): boolean { return true; }',
        'export class Service {}'
      ].join('\n'), {
        parsed: true,
        language: 'typescript',
        symbols: [
          symbol('src/service.ts', 'run', 'function', 1, {
            signature: 'run(): boolean'
          }),
          symbol('src/service.ts', 'Service', 'class', 2, { column: 8 })
        ]
      }),
      scanned('src/no-language.ts', 'export const value = 1;', {
        symbols: [symbol('src/no-language.ts', 'value', 'export', 1)]
      }),
      scanned('src/service.test.ts', [
        "import { run } from './service';",
        "test('run', () => expect(run()).toBe(true));"
      ].join('\n'), {
        language: 'typescript',
        symbols: [symbol('src/service.test.ts', 'run test', 'test', 2)]
      }),
      scanned('src/routes.ts', [
        "app.get('/users', getUsers);",
        'SELECT * FROM users;',
        'INSERT INTO audit_log VALUES (1);'
      ].join('\n'), { language: 'typescript' }),
      scanned('src/schema.sql', 'CREATE TABLE local_only (id INTEGER);', {
        language: 'sql'
      }),
      scanned('migrations/001_users.sql', [
        'CREATE TABLE users (id INTEGER);',
        'SELECT * FROM users;',
        'UPDATE users SET id = 2;'
      ].join('\n'), { language: 'sql' }),
      scanned('packages/api/package.json', JSON.stringify({
        scripts: { test: 'jest' },
        dependencies: { shared: '2', axios: '^1' }
      })),
      scanned('packages/api/src/index.ts', 'export const api = true;', {
        language: 'typescript'
      }),
      scanned('packages/api/src/other.ts', 'export const other = true;', {
        language: 'typescript'
      }),
      scanned('rust/Cargo.toml', [
        '[package]',
        'name = "native-api"',
        'version = "0.1.0"',
        '[dependencies]',
        'serde = "1"'
      ].join('\n'))
    ];
    const graph = new ArchitectureGraphCollector(1000);
    const structure = new ArchitectureStructureCollector().collect(files, graph, 'coverage-repository');
    const features = new ArchitectureFeatureCollector().collect(
      files,
      graph,
      structure.repositoryId,
      structure.fileIds,
      structure.parentIds
    );
    const nodes = graph.nodes();
    const edges = graph.edges();

    expect(nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'repository', label: 'coverage-repository', path: '.' }),
      expect.objectContaining({ kind: 'project_root', path: '.' }),
      expect.objectContaining({ kind: 'project_root', path: 'packages/api' }),
      expect.objectContaining({ kind: 'module', path: 'src' }),
      expect.objectContaining({ kind: 'module', path: 'packages/api/src' }),
      expect.objectContaining({ kind: 'test', path: 'src/service.test.ts' }),
      expect.objectContaining({ kind: 'migration', path: 'migrations/001_users.sql' }),
      expect.objectContaining({ kind: 'api_route', label: 'GET /users' }),
      expect.objectContaining({ kind: 'database_table', label: 'users' }),
      expect.objectContaining({ kind: 'database_table', label: 'local_only' }),
      expect.objectContaining({ kind: 'external_dependency', label: 'shared' }),
      expect.objectContaining({ kind: 'build_target', label: 'build' })
    ]));
    expect(nodes.find(node => node.kind === 'file' && node.path === 'src/service.ts'))
      .toEqual(expect.objectContaining({ confidence: 0.98, language: 'typescript' }));
    expect(nodes.find(node => node.kind === 'file' && node.path === 'README.md')!.evidence)
      .toEqual([expect.objectContaining({ detail: 'repository metadata only' })]);
    const runNode = nodes.find(node => node.kind === 'symbol' && node.label === 'run')!;
    const serviceNode = nodes.find(node => node.kind === 'symbol' && node.label === 'Service')!;
    expect(runNode.attributes.signature).toBe('run(): boolean');
    expect(serviceNode.attributes).not.toHaveProperty('signature');
    expect(runNode.language).toBe('typescript');
    expect(nodes.find(node => node.kind === 'symbol' && node.label === 'value'))
      .not.toHaveProperty('language');

    expect(structure.parentIds.get('main.ts')).toBeDefined();
    expect(structure.parentIds.get('packages/api/src/index.ts'))
      .toBe(structure.parentIds.get('packages/api/src/other.ts'));
    expect(features.testIds.has('src/service.test.ts')).toBe(true);
    expect(features.dependencyIds.has('express')).toBe(true);
    expect(features.dependencyIds.has('shared')).toBe(true);
    expect(features.dependencyIds.has('axios')).toBe(true);
    expect(graph.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MANIFEST_PARSE_ERROR', file: 'tsconfig.json' })
    ]));

    expect(edges.map(edge => edge.kind)).toEqual(expect.arrayContaining([
      'contains',
      'builds',
      'depends_on',
      'registers_route',
      'creates_table',
      'reads_table',
      'writes_table'
    ]));
    const usersTable = nodes.find(node => node.kind === 'database_table' && node.label === 'users')!;
    const migration = nodes.find(node => node.kind === 'migration' && node.path === 'migrations/001_users.sql')!;
    expect(edges).toContainEqual(expect.objectContaining({
      kind: 'creates_table',
      source: migration.id,
      target: usersTable.id
    }));
    const localTable = nodes.find(node => node.kind === 'database_table' && node.label === 'local_only')!;
    expect(edges.find(edge => edge.kind === 'creates_table' && edge.target === localTable.id)?.source)
      .toBe(structure.fileIds.get('src/schema.sql'));
  });

  it('normalizes option bounds and uses explicit or safe fallback repository metadata', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-options-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), '{', 'utf8');
      fs.writeFileSync(path.join(root, 'main.ts'), 'main();', 'utf8');
      const fallback = new RepositoryArchitectureBuilder(root, {
        generatedAt: '2026-08-23T00:00:00.000Z',
        maxFiles: -20,
        maxFileBytes: Number.POSITIVE_INFINITY,
        maxTotalBytes: 0,
        maxSymbols: 999_999_999,
        maxEdges: 0,
        maxPathDepth: 9999,
        maxTraversalDepth: 0,
        maxTraversalNodes: Number.NaN,
        includeGenerated: true
      }).build();
      expect(fallback.repository.name).toBe('repository');
      expect(fallback.generatedAt).toBe('2026-08-23T00:00:00.000Z');
      expect(fallback.limits).toEqual(expect.objectContaining({
        maxFiles: 1,
        maxFileBytes: 1024 * 1024,
        maxTotalBytes: 1024,
        maxSymbols: 500_000,
        maxEdges: 1,
        maxPathDepth: 256,
        maxTraversalDepth: 1,
        maxTraversalNodes: 5000,
        includeGenerated: true
      }));

      const explicit = new RepositoryArchitectureBuilder(root, {
        rootName: 'explicit-name',
        includeGenerated: false
      }).build();
      expect(explicit.repository.name).toBe('explicit-name');
      expect(explicit.limits.includeGenerated).toBe(false);
      expect(explicit.generatedAt).toBe('1970-01-01T00:00:00.000Z');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
