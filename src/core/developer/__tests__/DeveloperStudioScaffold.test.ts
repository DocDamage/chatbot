import { CapabilityPackScaffolder } from '../CapabilityPackScaffolder';
import { MockApiEngine } from '../MockApiEngine';

describe('RT-DEV-001..002 — Developer Utilities, Mock API and Scaffolder Suite', () => {
  it('scaffolds capability pack manifest with compliant schema', () => {
    const scaffolder = new CapabilityPackScaffolder();
    const pack = scaffolder.scaffoldPack({
      packId: 'pack-custom-tool',
      displayName: 'Custom Utility Pack',
      description: 'Test pack scaffold',
      author: 'Test Author',
    });

    expect(pack.manifest.id).toBe('pack-custom-tool');
    expect(pack.manifest.version).toBe('0.1.0');
    expect(pack.manifest.capabilities.length).toBeGreaterThan(0);
    expect(pack.files.length).toBeGreaterThan(0);
  });

  it('runs mock API engine collections and CRUD queries', () => {
    const mockEngine = new MockApiEngine();
    const collections = mockEngine.getCollections();
    expect(collections.length).toBeGreaterThan(0);

    const firstCol = collections[0];
    const items = mockEngine.listRecords(firstCol.name);
    expect(items.total).toBeGreaterThanOrEqual(0);
  });
});
