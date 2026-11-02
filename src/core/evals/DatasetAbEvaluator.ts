/**
 * Dataset A/B Evaluator and Promotion Policy Engine (CRK-P25-T01, T02, T03, T04)
 *
 * Runs controlled evaluations between baseline runtime (A) and candidate pack configurations (B).
 * Enforces empirical promotion rules: rejects packs that degrade correctness, increase outdated
 * answers, or exceed latency/storage budgets (§3684-3693).
 */

import {
  AbComparativeMetrics,
  PromotionDecisionRecord,
  PackPromotionDecisionStatus,
  promotionDecisionRecordSchema,
} from '../../types/ab-evaluation';

export interface PromotionRuleThresholds {
  minCorrectnessDelta: number;
  maxOutdatedIncrease: number;
  maxUnsupportedClaimsIncrease: number;
  maxLatencyDeltaMs: number;
  maxStorageBytes: number;
}

export const DEFAULT_PROMOTION_THRESHOLDS: PromotionRuleThresholds = {
  minCorrectnessDelta: 0.0,      // Must not decrease correctness
  maxOutdatedIncrease: 0.02,     // Cannot increase outdated answers by more than 2%
  maxUnsupportedClaimsIncrease: 0.03, // Cannot increase hallucinations by more than 3%
  maxLatencyDeltaMs: 150,        // Cannot add more than 150ms average retrieval latency
  maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB limit
};

export class DatasetAbEvaluator {
  constructor(
    private readonly thresholds: PromotionRuleThresholds = DEFAULT_PROMOTION_THRESHOLDS
  ) {}

  public evaluatePromotion(
    packId: string,
    metrics: AbComparativeMetrics,
    options?: {
      targetStatus?: 'DEFAULT' | 'OPTIONAL';
      storageThresholdBytes?: number;
      latencyDeltaMaxMs?: number;
    }
  ): PromotionDecisionRecord {
    const storageLimit = options?.storageThresholdBytes ?? this.thresholds.maxStorageBytes;
    const latencyLimit = options?.latencyDeltaMaxMs ?? this.thresholds.maxLatencyDeltaMs;

    const correctnessDelta = metrics.correctnessRateB - metrics.correctnessRateA;
    const outdatedDelta = metrics.outdatedAnswerRateB - metrics.outdatedAnswerRateA;
    const unsupportedDelta = metrics.unsupportedClaimsRateB - metrics.unsupportedClaimsRateA;
    const latencyDelta = metrics.avgRetrievalLatencyMsB - metrics.avgRetrievalLatencyMsA;

    const rejections: string[] = [];

    // Rule 1: Correctness must not degrade
    if (correctnessDelta < this.thresholds.minCorrectnessDelta) {
      rejections.push(`Correctness degraded by ${(correctnessDelta * 100).toFixed(1)}%`);
    }

    // Rule 2: Outdated answers must not increase materially
    if (outdatedDelta > this.thresholds.maxOutdatedIncrease) {
      rejections.push(`Outdated answers increased by ${(outdatedDelta * 100).toFixed(1)}%`);
    }

    // Rule 3: Unsupported claims / hallucinations must not increase materially
    if (unsupportedDelta > this.thresholds.maxUnsupportedClaimsIncrease) {
      rejections.push(`Unsupported claims increased by ${(unsupportedDelta * 100).toFixed(1)}%`);
    }

    // Rule 4: Latency delta check
    if (latencyDelta > latencyLimit) {
      rejections.push(`Retrieval latency increased by ${latencyDelta.toFixed(0)}ms (limit: ${latencyLimit}ms)`);
    }

    // Rule 5: Storage capacity check
    if (metrics.storageAddedBytes > storageLimit) {
      rejections.push(`Storage added (${metrics.storageAddedBytes} bytes) exceeds budget of ${storageLimit} bytes`);
    }

    let status: PackPromotionDecisionStatus;
    let rationale: string;

    if (rejections.length > 0) {
      status = 'REJECTED';
      rationale = `Pack rejected due to: ${rejections.join('; ')}.`;
    } else {
      // Check if eligible for DEFAULT or OPTIONAL
      if (options?.targetStatus === 'OPTIONAL' || correctnessDelta < 0.05) {
        status = 'PROMOTED_OPTIONAL';
        rationale = `Pack approved as OPTIONAL: safe metrics (correctness ${(correctnessDelta >= 0 ? '+' : '')}${(correctnessDelta * 100).toFixed(1)}%, latency +${latencyDelta.toFixed(0)}ms).`;
      } else {
        status = 'PROMOTED_DEFAULT';
        rationale = `Pack promoted to DEFAULT: significant correctness gain (+${(correctnessDelta * 100).toFixed(1)}%), low outdated answer rate, latency within budget.`;
      }
    }

    const record: PromotionDecisionRecord = {
      packId,
      evaluationDate: new Date().toISOString(),
      baselineConfigId: `baseline-without-${packId}`,
      candidateConfigId: `candidate-with-${packId}`,
      metrics,
      status,
      rationale,
      storageThresholdBytes: storageLimit,
      latencyDeltaMaxMs: latencyLimit,
    };

    return promotionDecisionRecordSchema.parse(record);
  }
}
