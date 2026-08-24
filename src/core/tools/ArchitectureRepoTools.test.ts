import { createArchitectureFixture } from '../coding/architecture/__tests__/ArchitectureFixture';
import { createArchitectureRepoTools } from './ArchitectureRepoTools';

describe('ArchitectureRepoTools', () => {
  it('exposes deterministic summary and bounded full snapshots', async () => {
    const fixture = createArchitectureFixture();
    try {
      const tools = createArchitectureRepoTools(fixture.root);
      const get = tools.find(tool => tool.id === 'get_repository_architecture')!;
      const first = await get.execute({});
      const second = await get.execute({});
      const full = await get.execute({ detail: 'full', maxNodes: 3, maxResponseEdges: 3 });

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(second.data.snapshotDigest).toBe(first.data.snapshotDigest);
      expect(second.data.cache.hits).toBeGreaterThan(first.data.cache.hits);
      expect(full.success).toBe(true);
      expect(full.data.nodes.length).toBeLessThanOrEqual(3);
      expect(full.data.edges.length).toBeLessThanOrEqual(3);
      expect(full.data.responseTruncated).toBe(true);
      expect(full.data.nodes.every((node: Record<string, unknown>) => !('evidence' in node))).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  it('supports evidence opt-in, cache refresh, generated files, and bounded numeric options', async () => {
    const fixture = createArchitectureFixture();
    try {
      const get = createArchitectureRepoTools(fixture.root)
        .find(tool => tool.id === 'get_repository_architecture')!;
      const full = await get.execute({
        detail: 'FULL',
        includeEvidence: true,
        refresh: true,
        includeGenerated: true,
        maxNodes: '2',
        maxResponseEdges: 99999,
        maxFiles: '100',
        maxTotalBytes: '2000000',
        maxFileBytes: '200000',
        maxSymbols: '500',
        maxEdges: '1000',
        maxPathDepth: '20',
        depth: '4',
        limit: '200'
      });

      expect(full.success).toBe(true);
      expect(full.data.nodes).toHaveLength(2);
      expect(full.data.nodes.every((node: Record<string, unknown>) => 'evidence' in node)).toBe(true);
      expect(full.data.edges.length).toBeLessThanOrEqual(4000);
      expect(full.data.stats.generatedFilesSkipped).toBe(0);
      expect(full.data.cache.parserVersion).toBeTruthy();
    } finally {
      fixture.cleanup();
    }
  });

  it('queries the graph and rejects unsupported or blank queries safely', async () => {
    const fixture = createArchitectureFixture();
    try {
      const query = createArchitectureRepoTools(fixture.root)
        .find(tool => tool.id === 'query_repository_architecture')!;
      const found = await query.execute({ queryType: 'find', value: 'getUsers', limit: 10 });
      const neighborhood = await query.execute({
        queryType: 'neighborhood',
        value: 'getUsers',
        depth: 2,
        limit: 20
      });
      const unsupported = await query.execute({ queryType: 'execute', value: 'getUsers' });
      const blankType = await query.execute({ queryType: '', value: 'getUsers' });
      const blank = await query.execute({ queryType: 'find', value: ' ' });

      expect(found.success).toBe(true);
      expect(found.data.result.nodeIds.length).toBeGreaterThan(0);
      expect(neighborhood.success).toBe(true);
      expect(neighborhood.data.nodes.length).toBeLessThanOrEqual(20);
      expect(unsupported).toEqual(expect.objectContaining({ success: false }));
      expect(blankType.error).toContain('(blank)');
      expect(blank).toEqual(expect.objectContaining({ success: false }));
    } finally {
      fixture.cleanup();
    }
  });

  it('runs every graph query mode by node ID and preserves evidence only when requested', async () => {
    const fixture = createArchitectureFixture();
    try {
      const query = createArchitectureRepoTools(fixture.root)
        .find(tool => tool.id === 'query_repository_architecture')!;
      const found = await query.execute({
        queryType: 'find',
        value: 'src/service.ts',
        limit: 'bad',
        includeEvidence: true
      });
      expect(found.success).toBe(true);
      expect(found.data.nodes[0].evidence).toBeDefined();
      const nodeId = found.data.nodes[0].id;

      for (const queryType of [
        'neighborhood',
        'reverse-dependencies',
        'test-impact',
        'entrypoint-reachability'
      ]) {
        const result = await query.execute({
          queryType,
          value: nodeId,
          depth: queryType === 'neighborhood' ? -10 : 8,
          limit: queryType === 'test-impact' ? 0 : 100,
          includeEvidence: queryType === 'entrypoint-reachability',
          refresh: queryType === 'reverse-dependencies'
        });
        expect(result.success).toBe(true);
        expect(result.data.matchedNodeId).toBe(nodeId);
        if (queryType === 'entrypoint-reachability') {
          expect(result.data.nodes.every((node: Record<string, unknown>) => 'evidence' in node)).toBe(true);
        } else {
          expect(result.data.nodes.every((node: Record<string, unknown>) => !('evidence' in node))).toBe(true);
        }
      }

      const missing = await query.execute({
        queryType: 'neighborhood',
        value: 'there-is-no-such-node',
        depth: Number.POSITIVE_INFINITY,
        limit: Number.NaN
      });
      expect(missing).toEqual(expect.objectContaining({
        success: false,
        error: expect.stringContaining('No architecture node matched')
      }));
    } finally {
      fixture.cleanup();
    }
  });

  it('returns a safe generic failure if the approved repository disappears before execution', async () => {
    const fixture = createArchitectureFixture();
    const get = createArchitectureRepoTools(fixture.root)
      .find(tool => tool.id === 'get_repository_architecture')!;
    fixture.cleanup();

    const result = await get.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ENOENT|no such file|not found/i);
  });
});
