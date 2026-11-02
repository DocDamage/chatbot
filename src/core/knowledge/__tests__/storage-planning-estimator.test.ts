import { describe, it, expect } from '@jest/globals';
import { StoragePlanningEstimator } from '../StoragePlanningEstimator';

describe('StoragePlanningEstimator (§54)', () => {
  const estimator = new StoragePlanningEstimator();

  it('should calculate exact raw float32 vector sizing per §54.1 example', () => {
    // 1,000,000 vectors * 768 dimensions * 4 bytes = 3,072,000,000 bytes (~3.07 GB)
    const bytes = estimator.calculateRawVectorBytes(1_000_000, 768);
    expect(bytes).toBe(3_072_000_000);
    const gb = bytes / (1024 * 1024 * 1024);
    expect(gb).toBeCloseTo(2.861, 2); // 3.072 billion decimal bytes = ~2.86 GiB
  });

  it('should generate valid preset plans for all canonical tiers (§54.2)', () => {
    const litePlan = estimator.getPresetPlan('Lite');
    expect(litePlan.includedPackIds).toEqual(['official_docs']);
    expect(litePlan.breakdown.totalFootprintBytes).toBeGreaterThan(0);
    expect(litePlan.indiscriminateEmbeddingAllowed).toBe(false);

    const devPlan = estimator.getPresetPlan('Developer');
    expect(devPlan.includedPackIds).toEqual(['official_docs', 'developer_qa', 'curated_code']);
    expect(devPlan.breakdown.totalFootprintBytes).toBeGreaterThan(
      litePlan.breakdown.totalFootprintBytes
    );

    const researchPlan = estimator.getPresetPlan('Research');
    expect(researchPlan.includedPackIds).toEqual([
      'general_knowledge',
      'research_papers',
      'math_proofs',
    ]);

    const extPlan = estimator.getPresetPlan('Extended');
    expect(extPlan.includedPackIds.length).toBe(7);
  });

  it('should verify disk headroom correctly and detect shortfalls', () => {
    const devPlan = estimator.getPresetPlan('Developer');
    const required = devPlan.breakdown.minimumFreeDiskBytes;

    // Test sufficient space
    const checkOk = estimator.verifyDiskHeadroom(required + 500_000_000, required);
    expect(checkOk.hasSufficientSpace).toBe(true);
    expect(checkOk.shortfallBytes).toBe(0);
    expect(checkOk.warning).toBeUndefined();

    // Test shortfall
    const checkFail = estimator.verifyDiskHeadroom(required - 100_000_000, required);
    expect(checkFail.hasSufficientSpace).toBe(false);
    expect(checkFail.shortfallBytes).toBe(100_000_000);
    expect(checkFail.warning).toContain('Insufficient disk headroom');
  });

  it('should handle custom pack selection properly', () => {
    const customPlan = estimator.getPresetPlan('Custom', ['curated_code', 'math_proofs']);
    expect(customPlan.includedPackIds).toEqual(['curated_code', 'math_proofs']);
    expect(customPlan.preset).toBe('Custom');
  });
});
