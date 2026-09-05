/**
 * Section 43: Migration and Rollout Strategy Types & Schemas
 * Governs the 8 canonical migration stages, prerequisite validation, and traffic routing.
 */
import { z } from 'zod';

export type RolloutStage =
  | '1_instrumentation'
  | '2_build_flag'
  | '3_shadow_planner'
  | '4_internal_canary'
  | '5_default_local_beta'
  | '6_production_preview'
  | '7_default'
  | '8_legacy_removal';

export const RolloutStageSchema = z.enum([
  '1_instrumentation',
  '2_build_flag',
  '3_shadow_planner',
  '4_internal_canary',
  '5_default_local_beta',
  '6_production_preview',
  '7_default',
  '8_legacy_removal',
]);

export interface Stage7Prerequisites {
  goldenSuitePassed: boolean;
  securityCleared: boolean;
  loadValidated: boolean;
  dataMigrationVerified: boolean;
  providerCanariesHealthy: boolean;
  knowledgeAbPromoted: boolean;
  rollbackEvidenceCollected: boolean;
}

export interface RolloutStageStatus {
  currentStage: RolloutStage;
  enabledAt: string;
  trafficPercentage: number; // 0 to 100
  allowedUserRoles: string[];
  shadowExecutionEnabled: boolean;
}

export interface StageTransitionCheck {
  targetStage: RolloutStage;
  canAdvance: boolean;
  missingPrerequisites: string[];
}

export type RoutingTarget = 'legacy' | 'shadow' | 'canonical';

export interface TrafficRoutingDecision {
  routingTarget: RoutingTarget;
  stage: RolloutStage;
  reason: string;
  requestId: string;
}
