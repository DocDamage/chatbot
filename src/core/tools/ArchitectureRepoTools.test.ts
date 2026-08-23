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
      const blank = await query.execute({ queryType: 'find', value: ' ' });

      expect(found.success).toBe(true);
      expect(found.data.result.nodeIds.length).toBeGreaterThan(0);
      expect(neighborhood.success).toBe(true);
      expect(neighborhood.data.nodes.length).toBeLessThanOrEqual(20);
      expect(unsupported).toEqual(expect.objectContaining({ success: false }));
      expect(blank).toEqual(expect.objectContaining({ success: false }));
    } finally {
      fixture.cleanup();
    }
  });
});
