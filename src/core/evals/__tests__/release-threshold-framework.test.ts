import {
  ReleaseThresholdFramework,
  CANONICAL_RELEASE_THRESHOLDS,
} from '../ReleaseThresholdFramework';
import { CanonicalEvaluationReport } from '../../../types/eval-thresholds';

describe('ReleaseThresholdFramework (Section 37 Evaluation Metrics & Release Thresholds)', () => {
  let framework: ReleaseThresholdFramework;

  const validReport: CanonicalEvaluationReport = {
    evaluationId: 'eval-run-pass',
    runTimestamp: new Date().toISOString(),
    routing: {
      taskClassificationAccuracy: 0.97,
      contextNeedAccuracy: 0.95,
      packSelectionAccuracy: 0.94,
      unnecessaryRetrievalRate: 0.02,
    },
    retrieval: {
      recallAtK: 0.89,
      mrrOrNdcg: 0.84,
      topSourceAuthority: 0.92,
      versionCompatibilityRate: 0.98,
      duplicateRate: 0.01,
    },
    grounding: {
      citationCorrectness: 0.97,
      supportedClaimRate: 0.94,
      unsupportedClaimRate: 0.01,
      correctAbstentionRate: 0.98,
      incorrectAbstentionRate: 0.02,
    },
    coding: {
      taskCompletionRate: 0.93,
      compileTestSuccessRate: 0.97,
      patchApplicabilityRate: 0.96,
      regressionRate: 0.01,
      versionCorrectApiUseRate: 0.97,
      toolTruthfulnessRate: 1.00,
    },
    conversation: {
      followupContextRetentionRate: 0.98,
      contradictionHandlingRate: 0.93,
      unnecessaryClarificationRate: 0.02,
      memoryLeakageRate: 0.00,
    },
    operations: {
      p50LatencyMs: 550,
      p95LatencyMs: 1600,
      providerFallbackRate: 0.01,
      knowledgeJobFailureRate: 0.00,
      staleDefaultPackCount: 0,
      storageGrowthRate: 0.04,
    },
  };

  beforeEach(() => {
    framework = new ReleaseThresholdFramework();
  });

  it('passes when candidate meets all 6 categories release thresholds', () => {
    const result = framework.evaluateCandidate(validReport);
    expect(result.decision).toBe('PASSED');
    expect(result.blockers).toHaveLength(0);
    expect(result.categoryResults.routing.passed).toBe(true);
    expect(result.categoryResults.retrieval.passed).toBe(true);
    expect(result.categoryResults.grounding.passed).toBe(true);
    expect(result.categoryResults.coding.passed).toBe(true);
    expect(result.categoryResults.conversation.passed).toBe(true);
    expect(result.categoryResults.operations.passed).toBe(true);
  });

  it('blocks release if tool truthfulness drops below 100%', () => {
    const compromisedReport: CanonicalEvaluationReport = {
      ...validReport,
      coding: {
        ...validReport.coding,
        toolTruthfulnessRate: 0.98, // must be 1.00
      },
    };
    const result = framework.evaluateCandidate(compromisedReport);
    expect(result.decision).toBe('BLOCKED');
    expect(result.blockers.some((b) => b.includes('Tool truthfulness'))).toBe(true);
  });

  it('blocks release if regression rate exceeds threshold', () => {
    const regressedReport: CanonicalEvaluationReport = {
      ...validReport,
      coding: {
        ...validReport.coding,
        regressionRate: 0.05, // max 0.02
      },
    };
    const result = framework.evaluateCandidate(regressedReport);
    expect(result.decision).toBe('BLOCKED');
    expect(result.blockers.some((b) => b.includes('Regression rate'))).toBe(true);
  });

  it('blocks release if memory leakage rate is non-zero', () => {
    const leakyReport: CanonicalEvaluationReport = {
      ...validReport,
      conversation: {
        ...validReport.conversation,
        memoryLeakageRate: 0.02, // must be 0.00
      },
    };
    const result = framework.evaluateCandidate(leakyReport);
    expect(result.decision).toBe('BLOCKED');
    expect(result.blockers.some((b) => b.includes('Memory leakage'))).toBe(true);
  });

  it('detects significant baseline degradation and adds blocker', () => {
    const baselineReport: CanonicalEvaluationReport = {
      ...validReport,
      coding: {
        ...validReport.coding,
        compileTestSuccessRate: 0.99,
      },
    };
    const degradedCandidate: CanonicalEvaluationReport = {
      ...validReport,
      coding: {
        ...validReport.coding,
        compileTestSuccessRate: 0.95, // dropped by 0.04 > 0.03
      },
    };
    const result = framework.evaluateCandidate(degradedCandidate, baselineReport);
    expect(result.decision).toBe('BLOCKED');
    expect(result.blockers.some((b) => b.includes('dropped > 3% below baseline'))).toBe(true);
  });
});
