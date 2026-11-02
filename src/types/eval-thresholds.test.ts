import {
  RoutingMetricsSchema,
  RetrievalMetricsSchema,
  GroundingMetricsSchema,
  CodingMetricsSchema,
  ConversationMetricsSchema,
  OperationalMetricsSchema,
  CanonicalEvaluationReportSchema,
  EvaluationGateResultSchema,
} from './eval-thresholds';

describe('Evaluation Metrics & Release Thresholds Schemas (Section 37)', () => {
  it('validates canonical evaluation metrics report', () => {
    const report = CanonicalEvaluationReportSchema.parse({
      evaluationId: 'eval-run-001',
      runTimestamp: new Date().toISOString(),
      routing: {
        taskClassificationAccuracy: 0.96,
        contextNeedAccuracy: 0.94,
        packSelectionAccuracy: 0.92,
        unnecessaryRetrievalRate: 0.03,
      },
      retrieval: {
        recallAtK: 0.88,
        mrrOrNdcg: 0.85,
        topSourceAuthority: 0.91,
        versionCompatibilityRate: 0.97,
        duplicateRate: 0.01,
      },
      grounding: {
        citationCorrectness: 0.98,
        supportedClaimRate: 0.95,
        unsupportedClaimRate: 0.01,
        correctAbstentionRate: 0.96,
        incorrectAbstentionRate: 0.02,
      },
      coding: {
        taskCompletionRate: 0.94,
        compileTestSuccessRate: 0.98,
        patchApplicabilityRate: 0.97,
        regressionRate: 0.01,
        versionCorrectApiUseRate: 0.96,
        toolTruthfulnessRate: 1.00,
      },
      conversation: {
        followupContextRetentionRate: 0.97,
        contradictionHandlingRate: 0.92,
        unnecessaryClarificationRate: 0.03,
        memoryLeakageRate: 0.00,
      },
      operations: {
        p50LatencyMs: 620,
        p95LatencyMs: 1850,
        providerFallbackRate: 0.01,
        knowledgeJobFailureRate: 0.00,
        staleDefaultPackCount: 0,
        storageGrowthRate: 0.05,
      },
    });

    expect(report.evaluationId).toBe('eval-run-001');
    expect(report.routing.taskClassificationAccuracy).toBe(0.96);
  });

  it('validates evaluation gate result', () => {
    const gateResult = EvaluationGateResultSchema.parse({
      decision: 'PASSED',
      categoryResults: {
        routing: { passed: true, violations: [] },
      },
      blockers: [],
      warnings: [],
      evaluatedAt: new Date().toISOString(),
    });
    expect(gateResult.decision).toBe('PASSED');
  });
});
