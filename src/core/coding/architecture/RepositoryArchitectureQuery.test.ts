import { createArchitectureFixture } from './__tests__/ArchitectureFixture';
import { RepositoryArchitectureBuilder } from './RepositoryArchitectureBuilder';
import { RepositoryArchitectureQuery } from './RepositoryArchitectureQuery';

describe('RepositoryArchitectureQuery', () => {
  it('finds nodes and returns deterministic bounded neighborhoods', () => {
    const fixture = createArchitectureFixture();
    try {
      const snapshot = new RepositoryArchitectureBuilder(fixture.root).build();
      const query = new RepositoryArchitectureQuery(snapshot);
      const found = query.find('getUsers', 10);

      expect(found.nodeIds.length).toBeGreaterThan(0);
      const nodeId = found.nodeIds[0];
      const first = query.neighborhood(nodeId, { maxDepth: 3, maxNodes: 30 });
      const second = query.neighborhood(nodeId, { maxDepth: 3, maxNodes: 30 });

      expect(second).toEqual(first);
      expect(first.nodeIds).toContain(nodeId);
      expect(first.nodeIds.length).toBeLessThanOrEqual(30);
      expect(query.nodesFor(first).map(node => node.id)).toEqual(first.nodeIds);
      expect(query.edgesFor(first).every(edge =>
        first.nodeIds.includes(edge.source) && first.nodeIds.includes(edge.target)
      )).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it('returns reverse dependencies, impacted tests, and reachable entrypoints', () => {
    const fixture = createArchitectureFixture();
    try {
      const snapshot = new RepositoryArchitectureBuilder(fixture.root).build();
      const query = new RepositoryArchitectureQuery(snapshot);
      const serviceFile = snapshot.nodes.find(node =>
        node.kind === 'file' && node.path === 'src/service.ts'
      );
      expect(serviceFile).toBeDefined();

      const reverse = query.reverseDependencies(serviceFile!.id, { maxDepth: 5, maxNodes: 100 });
      expect(query.nodesFor(reverse)).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'src/routes.ts' })
      ]));

      const impact = query.testImpact(serviceFile!.id, { maxDepth: 5, maxNodes: 100 });
      expect(query.nodesFor(impact)).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'test', path: 'src/service.test.ts' })
      ]));

      const reachability = query.entrypointReachability(serviceFile!.id, {
        maxDepth: 8,
        maxNodes: 100
      });
      expect(reachability.matchedEntrypointIds?.length).toBeGreaterThan(0);
      expect(reachability.matchedEntrypointIds?.every(id => snapshot.entrypointIds.includes(id))).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it('is cycle-safe and reports traversal truncation', () => {
    const fixture = createArchitectureFixture();
    try {
      const snapshot = new RepositoryArchitectureBuilder(fixture.root).build();
      const query = new RepositoryArchitectureQuery(snapshot);
      const start = snapshot.nodes.find(node => node.kind === 'repository')!;
      const result = query.neighborhood(start.id, { maxDepth: 8, maxNodes: 2 });

      expect(result.nodeIds.length).toBeLessThanOrEqual(2);
      expect(result.truncated).toBe(true);
      expect(result.warnings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'TRAVERSAL_LIMIT_REACHED' })
      ]));
    } finally {
      fixture.cleanup();
    }
  });

  it('uses safe query defaults and bounds tests added after dependency traversal', () => {
    const fixture = createArchitectureFixture();
    try {
      const snapshot = new RepositoryArchitectureBuilder(fixture.root).build();
      const serviceFile = snapshot.nodes.find(node =>
        node.kind === 'file' && node.path === 'src/service.ts'
      )!;
      const isolatedTest = {
        ...serviceFile,
        id: 'isolated-test-node',
        kind: 'test' as const,
        label: 'isolated coverage test',
        path: 'isolated.coverage.test.ts'
      };
      const orphanTest = {
        ...isolatedTest,
        id: 'orphan-test-node',
        label: 'orphan coverage test',
        path: 'orphan.coverage.test.ts'
      };
      const edgeTemplate = snapshot.edges[0];
      snapshot.nodes.push(isolatedTest, orphanTest);
      snapshot.edges.push(
        {
          ...edgeTemplate,
          id: 'incoming-non-containment-edge',
          kind: 'references',
          source: serviceFile.id,
          target: isolatedTest.id
        },
        {
          ...edgeTemplate,
          id: 'isolated-reference-edge',
          kind: 'references',
          source: isolatedTest.id,
          target: serviceFile.id
        },
        {
          ...edgeTemplate,
          id: 'isolated-test-edge',
          kind: 'tests',
          source: isolatedTest.id,
          target: serviceFile.id
        }
      );

      const query = new RepositoryArchitectureQuery(snapshot);
      expect(query.find('isolated').nodeIds).toContain(isolatedTest.id);
      expect(query.neighborhood(serviceFile.id).nodeIds).toContain(serviceFile.id);
      expect(query.reverseDependencies(serviceFile.id).nodeIds).toContain(serviceFile.id);
      expect(query.testImpact(serviceFile.id).nodeIds).toContain(isolatedTest.id);
      expect(query.entrypointReachability(serviceFile.id).nodeIds).toContain(serviceFile.id);
      expect(query.find('repository').nodeIds.length).toBeGreaterThan(0);

      const bounded = query.testImpact(serviceFile.id, { maxDepth: 0, maxNodes: 1 });
      expect(bounded).toEqual(expect.objectContaining({
        truncated: true,
        warnings: [expect.objectContaining({ code: 'TRAVERSAL_LIMIT_REACHED' })]
      }));
    } finally {
      fixture.cleanup();
    }
  });
});
