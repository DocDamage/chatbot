/**
 * Section 37: Evaluation Metrics and Release Threshold Framework
 * Enforces empirical release thresholds and regression protections.
 */
import {
  CanonicalEvaluationReport,
  EvaluationGateResult,
  ReleaseGateDecision,
} from '../../types/eval-thresholds';

export interface ReleaseThresholdLimits {
  routing: {
    minTaskClassificationAccuracy: number;
    minContextNeedAccuracy: number;
    minPackSelectionAccuracy: number;
    maxUnnecessaryRetrievalRate: number;
  };
  retrieval: {
    minRecallAtK: number;
    minMrrOrNdcg: number;
    minTopSourceAuthority: number;
    minVersionCompatibilityRate: number;
    maxDuplicateRate: number;
  };
  grounding: {
    minCitationCorrectness: number;
    minSupportedClaimRate: number;
    maxUnsupportedClaimRate: number;
    minCorrectAbstentionRate: number;
    maxIncorrectAbstentionRate: number;
  };
  coding: {
    minTaskCompletionRate: number;
    minCompileTestSuccessRate: number;
    minPatchApplicabilityRate: number;
    maxRegressionRate: number;
    minVersionCorrectApiUseRate: number;
    minToolTruthfulnessRate: number;
  };
  conversation: {
    minFollowupContextRetentionRate: number;
    minContradictionHandlingRate: number;
    maxUnnecessaryClarificationRate: number;
    maxMemoryLeakageRate: number;
  };
  operations: {
    maxP50LatencyMs: number;
    maxP95LatencyMs: number;
    maxProviderFallbackRate: number;
    maxKnowledgeJobFailureRate: number;
    maxStaleDefaultPackCount: number;
    maxStorageGrowthRate: number;
  };
}

export const CANONICAL_RELEASE_THRESHOLDS: ReleaseThresholdLimits = {
  routing: {
    minTaskClassificationAccuracy: 0.95,
    minContextNeedAccuracy: 0.92,
    minPackSelectionAccuracy: 0.90,
    maxUnnecessaryRetrievalRate: 0.05,
  },
  retrieval: {
    minRecallAtK: 0.85,
    minMrrOrNdcg: 0.80,
    minTopSourceAuthority: 0.85,
    minVersionCompatibilityRate: 0.95,
    maxDuplicateRate: 0.02,
  },
  grounding: {
    minCitationCorrectness: 0.95,
    minSupportedClaimRate: 0.92,
    maxUnsupportedClaimRate: 0.03,
    minCorrectAbstentionRate: 0.95,
    maxIncorrectAbstentionRate: 0.05,
  },
  coding: {
    minTaskCompletionRate: 0.90,
    minCompileTestSuccessRate: 0.95,
    minPatchApplicabilityRate: 0.95,
    maxRegressionRate: 0.02,
    minVersionCorrectApiUseRate: 0.95,
    minToolTruthfulnessRate: 1.00,
  },
  conversation: {
    minFollowupContextRetentionRate: 0.95,
    minContradictionHandlingRate: 0.90,
    maxUnnecessaryClarificationRate: 0.05,
    maxMemoryLeakageRate: 0.00,
  },
  operations: {
    maxP50LatencyMs: 800,
    maxP95LatencyMs: 2500,
    maxProviderFallbackRate: 0.02,
    maxKnowledgeJobFailureRate: 0.01,
    maxStaleDefaultPackCount: 0,
    maxStorageGrowthRate: 0.20,
  },
};

export class ReleaseThresholdFramework {
  constructor(
    private thresholds: ReleaseThresholdLimits = CANONICAL_RELEASE_THRESHOLDS,
  ) {}

  evaluateCandidate(
    candidate: CanonicalEvaluationReport,
    baseline?: CanonicalEvaluationReport,
  ): EvaluationGateResult {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const categoryResults: Record<string, { passed: boolean; violations: string[] }> = {};

    // 1. Routing
    const routingViolations: string[] = [];
    if (candidate.routing.taskClassificationAccuracy < this.thresholds.routing.minTaskClassificationAccuracy) {
      routingViolations.push(`Task classification accuracy ${candidate.routing.taskClassificationAccuracy} < min ${this.thresholds.routing.minTaskClassificationAccuracy}`);
    }
    if (candidate.routing.contextNeedAccuracy < this.thresholds.routing.minContextNeedAccuracy) {
      routingViolations.push(`Context need accuracy ${candidate.routing.contextNeedAccuracy} < min ${this.thresholds.routing.minContextNeedAccuracy}`);
    }
    if (candidate.routing.packSelectionAccuracy < this.thresholds.routing.minPackSelectionAccuracy) {
      routingViolations.push(`Pack selection accuracy ${candidate.routing.packSelectionAccuracy} < min ${this.thresholds.routing.minPackSelectionAccuracy}`);
    }
    if (candidate.routing.unnecessaryRetrievalRate > this.thresholds.routing.maxUnnecessaryRetrievalRate) {
      routingViolations.push(`Unnecessary retrieval rate ${candidate.routing.unnecessaryRetrievalRate} > max ${this.thresholds.routing.maxUnnecessaryRetrievalRate}`);
    }
    categoryResults.routing = { passed: routingViolations.length === 0, violations: routingViolations };

    // 2. Retrieval
    const retrievalViolations: string[] = [];
    if (candidate.retrieval.recallAtK < this.thresholds.retrieval.minRecallAtK) {
      retrievalViolations.push(`Recall@K ${candidate.retrieval.recallAtK} < min ${this.thresholds.retrieval.minRecallAtK}`);
    }
    if (candidate.retrieval.mrrOrNdcg < this.thresholds.retrieval.minMrrOrNdcg) {
      retrievalViolations.push(`MRR/NDCG ${candidate.retrieval.mrrOrNdcg} < min ${this.thresholds.retrieval.minMrrOrNdcg}`);
    }
    if (candidate.retrieval.topSourceAuthority < this.thresholds.retrieval.minTopSourceAuthority) {
      retrievalViolations.push(`Top-source authority ${candidate.retrieval.topSourceAuthority} < min ${this.thresholds.retrieval.minTopSourceAuthority}`);
    }
    if (candidate.retrieval.versionCompatibilityRate < this.thresholds.retrieval.minVersionCompatibilityRate) {
      retrievalViolations.push(`Version compatibility rate ${candidate.retrieval.versionCompatibilityRate} < min ${this.thresholds.retrieval.minVersionCompatibilityRate}`);
    }
    if (candidate.retrieval.duplicateRate > this.thresholds.retrieval.maxDuplicateRate) {
      retrievalViolations.push(`Duplicate rate ${candidate.retrieval.duplicateRate} > max ${this.thresholds.retrieval.maxDuplicateRate}`);
    }
    categoryResults.retrieval = { passed: retrievalViolations.length === 0, violations: retrievalViolations };

    // 3. Grounding
    const groundingViolations: string[] = [];
    if (candidate.grounding.citationCorrectness < this.thresholds.grounding.minCitationCorrectness) {
      groundingViolations.push(`Citation correctness ${candidate.grounding.citationCorrectness} < min ${this.thresholds.grounding.minCitationCorrectness}`);
    }
    if (candidate.grounding.supportedClaimRate < this.thresholds.grounding.minSupportedClaimRate) {
      groundingViolations.push(`Supported claim rate ${candidate.grounding.supportedClaimRate} < min ${this.thresholds.grounding.minSupportedClaimRate}`);
    }
    if (candidate.grounding.unsupportedClaimRate > this.thresholds.grounding.maxUnsupportedClaimRate) {
      const msg = `Unsupported claim rate ${candidate.grounding.unsupportedClaimRate} > max ${this.thresholds.grounding.maxUnsupportedClaimRate}`;
      groundingViolations.push(msg);
      blockers.push(msg);
    }
    categoryResults.grounding = { passed: groundingViolations.length === 0, violations: groundingViolations };

    // 4. Coding
    const codingViolations: string[] = [];
    if (candidate.coding.taskCompletionRate < this.thresholds.coding.minTaskCompletionRate) {
      codingViolations.push(`Coding task completion ${candidate.coding.taskCompletionRate} < min ${this.thresholds.coding.minTaskCompletionRate}`);
    }
    if (candidate.coding.compileTestSuccessRate < this.thresholds.coding.minCompileTestSuccessRate) {
      codingViolations.push(`Compile/test success ${candidate.coding.compileTestSuccessRate} < min ${this.thresholds.coding.minCompileTestSuccessRate}`);
    }
    if (candidate.coding.patchApplicabilityRate < this.thresholds.coding.minPatchApplicabilityRate) {
      codingViolations.push(`Patch applicability ${candidate.coding.patchApplicabilityRate} < min ${this.thresholds.coding.minPatchApplicabilityRate}`);
    }
    if (candidate.coding.regressionRate > this.thresholds.coding.maxRegressionRate) {
      const msg = `Regression rate ${candidate.coding.regressionRate} > max ${this.thresholds.coding.maxRegressionRate}`;
      codingViolations.push(msg);
      blockers.push(msg);
    }
    if (candidate.coding.toolTruthfulnessRate < this.thresholds.coding.minToolTruthfulnessRate) {
      const msg = `Tool truthfulness ${candidate.coding.toolTruthfulnessRate} < 100% truth requirement`;
      codingViolations.push(msg);
      blockers.push(msg);
    }
    categoryResults.coding = { passed: codingViolations.length === 0, violations: codingViolations };

    // 5. Conversation
    const conversationViolations: string[] = [];
    if (candidate.conversation.followupContextRetentionRate < this.thresholds.conversation.minFollowupContextRetentionRate) {
      conversationViolations.push(`Follow-up context retention ${candidate.conversation.followupContextRetentionRate} < min ${this.thresholds.conversation.minFollowupContextRetentionRate}`);
    }
    if (candidate.conversation.contradictionHandlingRate < this.thresholds.conversation.minContradictionHandlingRate) {
      conversationViolations.push(`Contradiction handling ${candidate.conversation.contradictionHandlingRate} < min ${this.thresholds.conversation.minContradictionHandlingRate}`);
    }
    if (candidate.conversation.memoryLeakageRate > this.thresholds.conversation.maxMemoryLeakageRate) {
      const msg = `Memory leakage ${candidate.conversation.memoryLeakageRate} violates zero-leakage invariant`;
      conversationViolations.push(msg);
      blockers.push(msg);
    }
    categoryResults.conversation = { passed: conversationViolations.length === 0, violations: conversationViolations };

    // 6. Operations
    const operationsViolations: string[] = [];
    if (candidate.operations.p50LatencyMs > this.thresholds.operations.maxP50LatencyMs) {
      operationsViolations.push(`p50 latency ${candidate.operations.p50LatencyMs}ms > max ${this.thresholds.operations.maxP50LatencyMs}ms`);
    }
    if (candidate.operations.p95LatencyMs > this.thresholds.operations.maxP95LatencyMs) {
      operationsViolations.push(`p95 latency ${candidate.operations.p95LatencyMs}ms > max ${this.thresholds.operations.maxP95LatencyMs}ms`);
    }
    if (candidate.operations.staleDefaultPackCount > this.thresholds.operations.maxStaleDefaultPackCount) {
      operationsViolations.push(`Stale default packs ${candidate.operations.staleDefaultPackCount} > 0`);
    }
    categoryResults.operations = { passed: operationsViolations.length === 0, violations: operationsViolations };

    // Baseline degradation check
    if (baseline) {
      if (candidate.coding.compileTestSuccessRate < baseline.coding.compileTestSuccessRate - 0.03) {
        const msg = `Candidate compile success dropped > 3% below baseline (${candidate.coding.compileTestSuccessRate} vs ${baseline.coding.compileTestSuccessRate})`;
        blockers.push(msg);
      }
      if (candidate.retrieval.recallAtK < baseline.retrieval.recallAtK - 0.05) {
        warnings.push(`Candidate Recall@K dropped > 5% below baseline (${candidate.retrieval.recallAtK} vs ${baseline.retrieval.recallAtK})`);
      }
    }

    // Determine decision
    let decision: ReleaseGateDecision = 'PASSED';
    const hasAnyViolation = Object.values(categoryResults).some((c) => !c.passed);
    if (blockers.length > 0) {
      decision = 'BLOCKED';
    } else if (hasAnyViolation) {
      decision = 'FAILED';
    }

    return {
      decision,
      categoryResults,
      blockers,
      warnings,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
