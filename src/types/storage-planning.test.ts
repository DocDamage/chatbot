import { describe, it, expect } from '@jest/globals';
import {
  InstallPresetTier,
  StorageEstimateBreakdown,
  PresetPlan,
} from './storage-planning';

describe('StoragePlanning Types', () => {
  it('should enumerate all 5 install preset tiers', () => {
    const tiers: InstallPresetTier[] = ['Lite', 'Developer', 'Research', 'Extended', 'Custom'];
    expect(tiers).toHaveLength(5);
  });

  it('should validate PresetPlan with strictly prohibited indiscriminate embedding', () => {
    const breakdown: StorageEstimateBreakdown = {
      downloadBytes: 100_000_000,
      normalizedTextBytes: 250_000_000,
      rawVectorBytes: 300_000_000,
      indexOverheadBytes: 60_000_000,
      totalFootprintBytes: 610_000_000,
      minimumFreeDiskBytes: 1_220_000_000,
    };

    const plan: PresetPlan = {
      preset: 'Developer',
      description: 'Official docs + developer Q&A + curated code',
      includedPackIds: ['official_docs', 'developer_qa', 'curated_code'],
      breakdown,
      indiscriminateEmbeddingAllowed: false,
    };

    expect(plan.indiscriminateEmbeddingAllowed).toBe(false);
    expect(plan.breakdown.minimumFreeDiskBytes).toBeGreaterThan(plan.breakdown.totalFootprintBytes);
  });
});
