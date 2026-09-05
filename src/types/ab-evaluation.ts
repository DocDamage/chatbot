/**
 * Dataset and Policy A/B Evaluation Schemas (CRK-P25-T01 to T05)
 *
 * Provides schemas for controlled A/B evaluations between baseline runtime (A)
 * and candidate pack configurations (B), comparative metrics, promotion rules, and decision records.
 */

import { z } from 'zod';

export const packPromotionDecisionStatusSchema = z.enum([
  'PROMOTED_DEFAULT',
  'PROMOTED_OPTIONAL',
  'REJECTED',
]);

export type PackPromotionDecisionStatus = z.infer<typeof packPromotionDecisionStatusSchema>;

export const abComparativeMetricsSchema = z.object({
  correctnessRateA: z.number().min(0).max(1),
  correctnessRateB: z.number().min(0).max(1),
  outdatedAnswerRateA: z.number().min(0).max(1),
  outdatedAnswerRateB: z.number().min(0).max(1),
  unsupportedClaimsRateA: z.number().min(0).max(1),
  unsupportedClaimsRateB: z.number().min(0).max(1),
  citationCorrectnessA: z.number().min(0).max(1),
  citationCorrectnessB: z.number().min(0).max(1),
  avgRetrievalLatencyMsA: z.number().nonnegative(),
  avgRetrievalLatencyMsB: z.number().nonnegative(),
  storageAddedBytes: z.number().nonnegative(),
  sourceDiversityScore: z.number().min(0).max(1),
});

export type AbComparativeMetrics = z.infer<typeof abComparativeMetricsSchema>;

export const promotionDecisionRecordSchema = z.object({
  packId: z.string().min(1),
  evaluationDate: z.string(),
  baselineConfigId: z.string().min(1),
  candidateConfigId: z.string().min(1),
  metrics: abComparativeMetricsSchema,
  status: packPromotionDecisionStatusSchema,
  rationale: z.string().min(1),
  storageThresholdBytes: z.number().nonnegative(),
  latencyDeltaMaxMs: z.number().nonnegative(),
});

export type PromotionDecisionRecord = z.infer<typeof promotionDecisionRecordSchema>;

export const retrievalWeightCandidateSchema = z.object({
  weights: z.record(z.number().min(0).max(1)),
  heldOutEvaluationScore: z.number().min(0).max(1),
  version: z.string().min(1),
});

export type RetrievalWeightCandidate = z.infer<typeof retrievalWeightCandidateSchema>;
