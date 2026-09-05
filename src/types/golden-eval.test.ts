import { goldenCaseSchema, baselineMetricsSchema } from './golden-eval';

describe('golden-eval schemas', () => {
  it('validates a structured golden case with deterministic assertions', () => {
    const goldCase = {
      id: 'case-coding-001',
      category: 'coding',
      input: [
        { role: 'user', content: 'Implement a binary search function in TypeScript' },
      ],
      requiredBehaviors: ['MUST_RETURN_VALID_TYPESCRIPT', 'MUST_HANDLE_EDGE_CASES'],
      prohibitedBehaviors: ['DO_NOT_HALLUCINATE_LIBRARY'],
      deterministicAssertions: [
        { type: 'contains_substring', param: 'function binarySearch' },
        { type: 'no_overclaim' },
      ],
      isolatedFromKnowledgeIndex: true,
    };

    const parsed = goldenCaseSchema.parse(goldCase);
    expect(parsed.id).toBe('case-coding-001');
    expect(parsed.isolatedFromKnowledgeIndex).toBe(true);
  });

  it('validates baseline metrics record', () => {
    const metrics = {
      totalCases: 50,
      passedCases: 49,
      taskSuccessRate: 0.98,
      routingAccuracy: 0.96,
      retrievalRecall: 0.94,
      citationCorrectness: 0.98,
      unsupportedClaimRate: 0.02,
      toolTruthfulnessRate: 1.0,
      latencyP95Ms: 820,
    };

    const parsed = baselineMetricsSchema.parse(metrics);
    expect(parsed.taskSuccessRate).toBe(0.98);
    expect(parsed.toolTruthfulnessRate).toBe(1.0);
  });
});
