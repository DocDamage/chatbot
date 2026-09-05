import {
  promotionDecisionRecordSchema,
  abComparativeMetricsSchema,
} from './ab-evaluation';

describe('ab-evaluation schemas', () => {
  it('validates a complete promotion decision record', () => {
    const record = {
      packId: 'core-official-docs',
      evaluationDate: new Date().toISOString(),
      baselineConfigId: 'baseline-no-official-docs',
      candidateConfigId: 'candidate-with-official-docs',
      metrics: {
        correctnessRateA: 0.81,
        correctnessRateB: 0.92,
        outdatedAnswerRateA: 0.14,
        outdatedAnswerRateB: 0.06,
        unsupportedClaimsRateA: 0.07,
        unsupportedClaimsRateB: 0.02,
        citationCorrectnessA: 0.80,
        citationCorrectnessB: 0.98,
        avgRetrievalLatencyMsA: 20,
        avgRetrievalLatencyMsB: 60,
        storageAddedBytes: 3100000000,
        sourceDiversityScore: 0.85,
      },
      status: 'PROMOTED_DEFAULT',
      rationale: 'Official docs significantly improved correctness (+11%) and reduced outdated answers (-8%).',
      storageThresholdBytes: 5000000000,
      latencyDeltaMaxMs: 150,
    };

    const parsed = promotionDecisionRecordSchema.parse(record);
    expect(parsed.status).toBe('PROMOTED_DEFAULT');
    expect(parsed.metrics.correctnessRateB).toBe(0.92);
  });
});
