import { DatasetFixtureProvider } from '../DatasetFixtureProvider';
import { CANONICAL_DATASET_FIXTURES } from '../CanonicalDatasetFixtures';

describe('DatasetFixtureProvider (§49)', () => {
  let provider: DatasetFixtureProvider;

  beforeEach(() => {
    provider = new DatasetFixtureProvider();
  });

  it('contains all 10 canonical dataset fixtures', () => {
    const manifests = provider.getAllManifests();
    expect(manifests).toHaveLength(10);

    const categories = Object.keys(CANONICAL_DATASET_FIXTURES);
    expect(categories).toHaveLength(10);
  });

  it('enforces 100% zero-network guarantee (§49 invariant)', () => {
    const check = provider.verifyZeroNetworkGuarantee();
    expect(check.compliant).toBe(true);
    expect(check.totalChecked).toBe(10);
  });

  it('queries official docs and factual knowledge with lexical & authority scoring', () => {
    const results = provider.query({
      category: 'official_docs',
      query: 'TypeScript primitive types'
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.title).toContain('TypeScript Primitive Types');
    expect(results[0].chunk.authority).toBe(0.95);
    expect(results[0].score).toBeGreaterThan(0.7);
  });

  it('arbitrates conflicting sources favoring higher authority', () => {
    const winningChunk = provider.resolveConflictingFactualClaims('timeout');

    expect(winningChunk).toBeDefined();
    expect(winningChunk?.id).toBe('conflict-high-auth');
    expect(winningChunk?.authority).toBe(0.95);
    expect(winningChunk?.content).toContain('30 seconds');
  });

  it('detects duplicate chunks for deduplication testing', () => {
    const duplicates = provider.detectDuplicateChunks();

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].original.id).toBe('dup-1');
    expect(duplicates[0].duplicate.id).toBe('dup-2');
  });

  it('contains malicious prompt injection test vector for security tests', () => {
    const manifest = provider.getManifest('prompt_injection');

    expect(manifest).toBeDefined();
    expect(manifest?.chunks[0].content).toContain('SYSTEM OVERRIDE');
    expect(manifest?.chunks[0].metadata?.intendedResult).toBe('REJECT');
  });
});
