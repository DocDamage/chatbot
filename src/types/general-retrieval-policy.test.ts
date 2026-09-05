import { describe, it, expect } from '@jest/globals';
import {
  GeneralQueryCategory,
  GeneralSourceTier,
  GeneralRetrievalPlan,
} from './general-retrieval-policy';

describe('GeneralRetrievalPolicy Types', () => {
  it('should accept valid query categories and source tiers', () => {
    const categories: GeneralQueryCategory[] = [
      'normal_fact',
      'scientific_question',
      'time_sensitive_fact',
    ];
    expect(categories).toHaveLength(3);

    const sourceTiers: GeneralSourceTier[] = [
      'structured_knowledge',
      'encyclopedia',
      'authoritative_domain',
      'research_papers',
      'live_web',
      'broader_sources',
    ];
    expect(sourceTiers).toHaveLength(6);
  });

  it('should validate complete GeneralRetrievalPlan structure', () => {
    const plan: GeneralRetrievalPlan = {
      query: 'What is the capital of France?',
      category: 'normal_fact',
      preferredSourceOrder: ['structured_knowledge', 'encyclopedia', 'authoritative_domain'],
      temporalAnalysis: {
        isTimeSensitive: false,
        temporalIndicators: [],
      },
      onlineRetrievalRecommended: false,
      freshnessDisclosureRequired: false,
      evaluatedAt: new Date().toISOString(),
    };

    expect(plan.category).toBe('normal_fact');
    expect(plan.preferredSourceOrder[0]).toBe('structured_knowledge');
    expect(plan.freshnessDisclosureRequired).toBe(false);
  });
});
