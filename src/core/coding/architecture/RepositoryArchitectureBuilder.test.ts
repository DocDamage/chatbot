import fs from 'fs';
import { createArchitectureFixture } from './__tests__/ArchitectureFixture';
import {
  CANONICAL_ARCHITECTURE_GENERATED_AT,
  REPODNA_REFERENCE_REVISION,
  REPOSITORY_ARCHITECTURE_SCHEMA_VERSION
} from './ArchitectureTypes';
import { RepositoryArchitectureBuilder } from './RepositoryArchitectureBuilder';
import { validateRepositoryArchitectureSnapshot } from './RepositoryArchitectureSchema';

function kinds(values: Array<{ kind: string }>): Set<string> {
  return new Set(values.map(value => value.kind));
}

describe('RepositoryArchitectureBuilder', () => {
  it('builds a deterministic, schema-valid, static-only mixed-repository graph', () => {
    const fixture = createArchitectureFixture();
    try {
      const builder = new RepositoryArchitectureBuilder(fixture.root);
      const first = builder.build();
      const afterFirst = builder.cacheStats();
      const second = builder.build();
      const afterSecond = builder.cacheStats();

      expect(second).toEqual(first);
      expect(afterFirst.misses).toBeGreaterThan(0);
      expect(afterSecond.hits).toBeGreaterThan(afterFirst.hits);
      expect(first.schemaVersion).toBe(REPOSITORY_ARCHITECTURE_SCHEMA_VERSION);
      expect(first.generatedAt).toBe(CANONICAL_ARCHITECTURE_GENERATED_AT);
      expect(first.source).toEqual(expect.objectContaining({
        repository: 'DocDamage/RepoDNA',
        revision: REPODNA_REFERENCE_REVISION,
        license: 'MIT',
        copiedSource: false
      }));
      expect(first.repository).toEqual(expect.objectContaining({
        name: 'mixed-architecture-fixture',
        root: '.'
      }));
      expect(first.metadata).toEqual({
        analysisMode: 'static_text_only',
        executedRepositoryCode: false,
        deterministic: true
      });
      expect(validateRepositoryArchitectureSnapshot(first)).toEqual({ valid: true, errors: [] });
      expect(fs.existsSync(fixture.marker)).toBe(false);

      expect([...kinds(first.nodes)]).toEqual(expect.arrayContaining([
        'repository', 'project_root', 'package', 'module', 'file', 'symbol',
        'api_route', 'database_table', 'migration', 'test', 'build_target',
        'external_dependency'
      ]));
      expect([...kinds(first.edges)]).toEqual(expect.arrayContaining([
        'contains', 'imports', 'tests', 'registers_route', 'reads_table',
        'creates_table', 'builds', 'depends_on'
      ]));
      expect(first.nodes).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'api_route', label: 'GET /users' }),
        expect.objectContaining({ kind: 'database_table', label: 'users' }),
        expect.objectContaining({ kind: 'external_dependency', label: 'tailwindcss' })
      ]));
      expect(first.entrypointIds.length).toBeGreaterThan(0);
      expect(first.parserHealth.length).toBeGreaterThan(0);
      expect(first.nodes.some(node => node.path === 'generated/ignored.generated.ts')).toBe(false);
      expect(first.stats.generatedFilesSkipped).toBe(1);
      expect(first.stats.binaryFilesSkipped).toBe(1);
      expect(first.warnings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'BINARY_FILE_SKIPPED', file: 'assets/binary.dat' })
      ]));

      const duplicateSymbols = first.nodes.filter(node =>
        node.kind === 'symbol' && node.label === 'duplicate'
      );
      expect(duplicateSymbols.map(node => node.path).sort()).toEqual([
        'src/duplicate-a.ts',
        'src/duplicate-b.ts'
      ]);
      for (const node of first.nodes) {
        expect(node.path || '.').not.toMatch(/^[A-Za-z]:|^\//);
        for (const evidence of node.evidence) {
          expect(evidence.file).not.toMatch(/^[A-Za-z]:|^\//);
        }
      }
    } finally {
      fixture.cleanup();
    }
  });

  it('supports generated-source opt-in without changing the default exclusion', () => {
    const fixture = createArchitectureFixture();
    try {
      const normal = new RepositoryArchitectureBuilder(fixture.root).build();
      const included = new RepositoryArchitectureBuilder(fixture.root, {
        includeGenerated: true
      }).build();

      expect(normal.nodes.some(node => node.path === 'generated/ignored.generated.ts')).toBe(false);
      expect(included.nodes.some(node => node.path === 'generated/ignored.generated.ts')).toBe(true);
      expect(included.repositoryVersion).not.toBe(normal.repositoryVersion);
    } finally {
      fixture.cleanup();
    }
  });

  it('reports file, edge, symbol, and path-depth limits without escaping bounds', () => {
    const fixture = createArchitectureFixture();
    try {
      const limited = new RepositoryArchitectureBuilder(fixture.root, {
        maxFiles: 4,
        maxEdges: 5,
        maxSymbols: 2
      }).build();
      const shallow = new RepositoryArchitectureBuilder(fixture.root, {
        maxPathDepth: 1,
        maxFiles: 100
      }).build();

      expect(limited.stats.filesAnalyzed).toBeLessThanOrEqual(4);
      expect(limited.edges.length).toBeLessThanOrEqual(5);
      expect(limited.stats.symbols).toBeLessThanOrEqual(2);
      expect(limited.stats.truncated).toBe(true);
      expect(limited.warnings.map(warning => warning.code)).toEqual(expect.arrayContaining([
        'FILE_LIMIT_REACHED',
        'EDGE_LIMIT_REACHED'
      ]));
      expect(shallow.warnings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'PATH_DEPTH_LIMIT_REACHED' })
      ]));
      expect(shallow.nodes.filter(node => node.kind === 'file').every(node => !node.path || node.path.split('/').length <= 1)).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });
});
