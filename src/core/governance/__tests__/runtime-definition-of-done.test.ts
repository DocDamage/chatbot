import { describe, it, expect } from '@jest/globals';
import { RuntimeDefinitionOfDoneEvaluator } from '../RuntimeDefinitionOfDoneEvaluator';

describe('RuntimeDefinitionOfDoneEvaluator (§56)', () => {
  it('certifies 100% when all 43 criteria across 6 domains pass', () => {
    const evaluator = new RuntimeDefinitionOfDoneEvaluator();
    const result = evaluator.evaluate();

    expect(result.isCertified).toBe(true);
    expect(result.totalCriteria).toBe(43);
    expect(result.passedCriteria).toBe(43);
    expect(result.completionRate).toBe(1.0);
    expect(result.allUnmetCriteria).toHaveLength(0);

    // Verify all 6 domains
    expect(result.domainResults.runtime.isSatisfied).toBe(true);
    expect(result.domainResults.knowledge.isSatisfied).toBe(true);
    expect(result.domainResults.data.isSatisfied).toBe(true);
    expect(result.domainResults.quality.isSatisfied).toBe(true);
    expect(result.domainResults.ui.isSatisfied).toBe(true);
    expect(result.domainResults.operations.isSatisfied).toBe(true);
  });

  it('detects unmet criteria and blocks certification', () => {
    const evaluator = new RuntimeDefinitionOfDoneEvaluator();
    const result = evaluator.evaluate({
      runtime: {
        allDefaultChatApisCanonical: false,
      },
      quality: {
        goldenSuiteMeetsThresholds: false,
      },
    });

    expect(result.isCertified).toBe(false);
    expect(result.passedCriteria).toBe(41);
    expect(result.completionRate).toBeLessThan(1.0);
    expect(result.allUnmetCriteria).toContain('runtime.allDefaultChatApisCanonical');
    expect(result.allUnmetCriteria).toContain('quality.goldenSuiteMeetsThresholds');
    expect(result.domainResults.runtime.isSatisfied).toBe(false);
    expect(result.domainResults.quality.isSatisfied).toBe(false);
  });
});
