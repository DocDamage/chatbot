/**
 * Section 37: Evaluation Metrics and Release Threshold Framework Schemas
 */
import { z } from 'zod';

export const RoutingMetricsSchema = z.object({
  taskClassificationAccuracy: z.number().min(0).max(1),
  contextNeedAccuracy: z.number().min(0).max(1),
  packSelectionAccuracy: z.number().min(0).max(1),
  unnecessaryRetrievalRate: z.number().min(0).max(1),
});
export type RoutingMetrics = z.infer<typeof RoutingMetricsSchema>;

export const RetrievalMetricsSchema = z.object({
  recallAtK: z.number().min(0).max(1),
  mrrOrNdcg: z.number().min(0).max(1),
  topSourceAuthority: z.number().min(0).max(1),
  versionCompatibilityRate: z.number().min(0).max(1),
  duplicateRate: z.number().min(0).max(1),
});
export type RetrievalMetrics = z.infer<typeof RetrievalMetricsSchema>;

export const GroundingMetricsSchema = z.object({
  citationCorrectness: z.number().min(0).max(1),
  supportedClaimRate: z.number().min(0).max(1),
  unsupportedClaimRate: z.number().min(0).max(1),
  correctAbstentionRate: z.number().min(0).max(1),
  incorrectAbstentionRate: z.number().min(0).max(1),
});
export type GroundingMetrics = z.infer<typeof GroundingMetricsSchema>;

export const CodingMetricsSchema = z.object({
  taskCompletionRate: z.number().min(0).max(1),
  compileTestSuccessRate: z.number().min(0).max(1),
  patchApplicabilityRate: z.number().min(0).max(1),
  regressionRate: z.number().min(0).max(1),
  versionCorrectApiUseRate: z.number().min(0).max(1),
  toolTruthfulnessRate: z.number().min(0).max(1),
});
export type CodingMetrics = z.infer<typeof CodingMetricsSchema>;

export const ConversationMetricsSchema = z.object({
  followupContextRetentionRate: z.number().min(0).max(1),
  contradictionHandlingRate: z.number().min(0).max(1),
  unnecessaryClarificationRate: z.number().min(0).max(1),
  memoryLeakageRate: z.number().min(0).max(1),
});
export type ConversationMetrics = z.infer<typeof ConversationMetricsSchema>;

export const OperationalMetricsSchema = z.object({
  p50LatencyMs: z.number().nonnegative(),
  p95LatencyMs: z.number().nonnegative(),
  providerFallbackRate: z.number().min(0).max(1),
  knowledgeJobFailureRate: z.number().min(0).max(1),
  staleDefaultPackCount: z.number().nonnegative(),
  storageGrowthRate: z.number().min(0),
});
export type OperationalMetrics = z.infer<typeof OperationalMetricsSchema>;

export const CanonicalEvaluationReportSchema = z.object({
  evaluationId: z.string(),
  runTimestamp: z.string(),
  routing: RoutingMetricsSchema,
  retrieval: RetrievalMetricsSchema,
  grounding: GroundingMetricsSchema,
  coding: CodingMetricsSchema,
  conversation: ConversationMetricsSchema,
  operations: OperationalMetricsSchema,
});
export type CanonicalEvaluationReport = z.infer<typeof CanonicalEvaluationReportSchema>;

export const ReleaseGateDecisionSchema = z.enum(['PASSED', 'FAILED', 'BLOCKED']);
export type ReleaseGateDecision = z.infer<typeof ReleaseGateDecisionSchema>;

export const EvaluationGateResultSchema = z.object({
  decision: ReleaseGateDecisionSchema,
  categoryResults: z.record(z.string(), z.object({
    passed: z.boolean(),
    violations: z.array(z.string()),
  })),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  evaluatedAt: z.string(),
});
export type EvaluationGateResult = z.infer<typeof EvaluationGateResultSchema>;
