/**
 * Section 43: Migration and Rollout Stage Coordinator
 * Governs the 8-stage rollout lifecycle, prerequisite gates, and canary traffic routing.
 */
import {
  RolloutStage,
  Stage7Prerequisites,
  RolloutStageStatus,
  StageTransitionCheck,
  TrafficRoutingDecision,
} from '../../types/rollout-migration';

export class RolloutStageCoordinator {
  private status: RolloutStageStatus;

  constructor(initialStage: RolloutStage = '1_instrumentation') {
    this.status = {
      currentStage: initialStage,
      enabledAt: new Date().toISOString(),
      trafficPercentage: 0,
      allowedUserRoles: ['developer', 'internal'],
      shadowExecutionEnabled: false,
    };
  }

  getStatus(): RolloutStageStatus {
    return { ...this.status };
  }

  canAdvanceToStage(
    targetStage: RolloutStage,
    stage7Prereqs?: Stage7Prerequisites,
  ): StageTransitionCheck {
    const missing: string[] = [];

    if (targetStage === '7_default') {
      if (!stage7Prereqs) {
        missing.push('Stage 7 prerequisites verification object is missing');
      } else {
        if (!stage7Prereqs.goldenSuitePassed) missing.push('Golden conversation suite has not passed');
        if (!stage7Prereqs.securityCleared) missing.push('Security and vulnerability assessment not cleared');
        if (!stage7Prereqs.loadValidated) missing.push('Performance and load testing not validated');
        if (!stage7Prereqs.dataMigrationVerified) missing.push('Database and dataset migrations not verified');
        if (!stage7Prereqs.providerCanariesHealthy) missing.push('Model provider canaries are not healthy');
        if (!stage7Prereqs.knowledgeAbPromoted) missing.push('Knowledge pack A/B evaluation not promoted');
        if (!stage7Prereqs.rollbackEvidenceCollected) missing.push('Rollback drill and evidence not collected');
      }
    }

    if (targetStage === '8_legacy_removal' && this.status.currentStage !== '7_default') {
      missing.push('Must successfully complete and certify Stage 7 (default) before removing legacy');
    }

    return {
      targetStage,
      canAdvance: missing.length === 0,
      missingPrerequisites: missing,
    };
  }

  setStage(
    targetStage: RolloutStage,
    options?: {
      stage7Prereqs?: Stage7Prerequisites;
      trafficPercentage?: number;
      allowedRoles?: string[];
    },
  ): { success: boolean; errors: string[] } {
    const check = this.canAdvanceToStage(targetStage, options?.stage7Prereqs);
    if (!check.canAdvance) {
      return { success: false, errors: check.missingPrerequisites };
    }

    this.status.currentStage = targetStage;
    this.status.enabledAt = new Date().toISOString();
    this.status.shadowExecutionEnabled = targetStage === '3_shadow_planner';

    if (options?.trafficPercentage !== undefined) {
      this.status.trafficPercentage = Math.min(100, Math.max(0, options.trafficPercentage));
    } else {
      if (targetStage === '7_default' || targetStage === '8_legacy_removal') {
        this.status.trafficPercentage = 100;
      } else if (targetStage === '6_production_preview') {
        this.status.trafficPercentage = 20;
      } else {
        this.status.trafficPercentage = 0;
      }
    }

    if (options?.allowedRoles) {
      this.status.allowedUserRoles = [...options.allowedRoles];
    }

    return { success: true, errors: [] };
  }

  routeTraffic(context: {
    requestId: string;
    userRole?: string;
    isLocalEnv?: boolean;
    sampleBucket?: number; // 0-99 for deterministic canary
  }): TrafficRoutingDecision {
    const { requestId, userRole, isLocalEnv, sampleBucket = 0 } = context;

    switch (this.status.currentStage) {
      case '1_instrumentation':
      case '2_build_flag':
        return {
          routingTarget: 'legacy',
          stage: this.status.currentStage,
          reason: 'Stage requires 100% legacy traffic routing',
          requestId,
        };

      case '3_shadow_planner':
        return {
          routingTarget: 'shadow',
          stage: this.status.currentStage,
          reason: 'Shadow planner active without duplicate side-effects',
          requestId,
        };

      case '4_internal_canary':
        if (userRole && this.status.allowedUserRoles.includes(userRole)) {
          return {
            routingTarget: 'canonical',
            stage: this.status.currentStage,
            reason: `User role '${userRole}' eligible for internal canary`,
            requestId,
          };
        }
        return {
          routingTarget: 'legacy',
          stage: this.status.currentStage,
          reason: 'General traffic routed to legacy during internal canary',
          requestId,
        };

      case '5_default_local_beta':
        if (isLocalEnv) {
          return {
            routingTarget: 'canonical',
            stage: this.status.currentStage,
            reason: 'Local environment enabled for default local beta',
            requestId,
          };
        }
        return {
          routingTarget: 'legacy',
          stage: this.status.currentStage,
          reason: 'Non-local traffic remains on legacy in local beta',
          requestId,
        };

      case '6_production_preview':
        if (sampleBucket < this.status.trafficPercentage) {
          return {
            routingTarget: 'canonical',
            stage: this.status.currentStage,
            reason: `Canary sample bucket ${sampleBucket} within ${this.status.trafficPercentage}% preview threshold`,
            requestId,
          };
        }
        return {
          routingTarget: 'legacy',
          stage: this.status.currentStage,
          reason: `Canary sample bucket ${sampleBucket} exceeds ${this.status.trafficPercentage}% preview threshold`,
          requestId,
        };

      case '7_default':
      case '8_legacy_removal':
      default:
        return {
          routingTarget: 'canonical',
          stage: this.status.currentStage,
          reason: 'Canonical runtime is default production engine',
          requestId,
        };
    }
  }
}
