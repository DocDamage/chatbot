import { describe, it, expect } from '@jest/globals';
import {
  contextPlanSchema,
  contextRequirementSchema,
  ContextPlan,
} from './context-plan';

describe('ContextPlan Schemas (CRK-P05-T01)', () => {
  it('validates all 7 requirement types', () => {
    const requirements = [
      { type: 'conversation' as const, maxTokens: 4000 },
      { type: 'variables' as const, keys: ['framework', 'language'] },
      { type: 'memory' as const, scopes: ['episodic'], maxItems: 3 },
      { type: 'project' as const, strategy: 'structural' as const, paths: ['src/index.ts'] },
      { type: 'knowledge' as const, packs: ['core-official-docs'], query: 'TypeScript generics', filters: { lang: 'ts' } },
      { type: 'tool' as const, toolId: 'code_search', reason: 'locate symbol' },
      { type: 'none' as const, reason: 'creative query requires no retrieval' },
    ];

    for (const req of requirements) {
      const parsed = contextRequirementSchema.safeParse(req);
      expect(parsed.success).toBe(true);
    }
  });

  it('validates a complete ContextPlan with rationale codes and token budgets', () => {
    const plan: ContextPlan = {
      requestId: 'req-12345',
      requirements: [
        { type: 'conversation', maxTokens: 2000 },
        { type: 'project', paths: ['tsconfig.json'], strategy: 'targeted', includeDiagnostics: true, includeTests: false },
        { type: 'knowledge', packs: ['core-official-docs'], query: 'TS2322 error', filters: {}, maxChunks: 5 },
      ],
      answerReserveTokens: 2500,
      rationaleCodes: ['CODING_TASK', 'PROJECT_ERROR_REFERENCE'],
      skippedRequirements: [
        { type: 'web', reason: 'Web search not requested and local docs exist' },
      ],
      tokenBudgets: {
        conversation: 2000,
        project: 4000,
        knowledge: 3000,
        answer: 2500,
      },
      confidence: 0.95,
    };

    const parsed = contextPlanSchema.safeParse(plan);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rationaleCodes).toContain('CODING_TASK');
      expect(parsed.data.requirements).toHaveLength(3);
    }
  });

  it('rejects invalid requirement structures', () => {
    const invalidReq = { type: 'unknown_type', value: 123 };
    const parsed = contextRequirementSchema.safeParse(invalidReq);
    expect(parsed.success).toBe(false);
  });
});
