/**
 * Safe RL - Constrain exploration to safe regions
 * Research: Stanford CS224N, Safe RL
 */

import { RewardSignal } from './RewardModel';
import { logger } from '../observability/logger';

export interface SafetyConstraint {
  minSafety: number;
  minCoherence: number;
  maxRisk: number;
}

export class SafeRL {
  private constraints: SafetyConstraint;

  constructor(constraints: SafetyConstraint = {
    minSafety: 0.7,
    minCoherence: 0.6,
    maxRisk: 0.3
  }) {
    this.constraints = constraints;
  }

  /**
   * Check if reward signal meets safety constraints
   */
  isSafe(rewardSignal: RewardSignal): boolean {
    const safetyOk = rewardSignal.safety >= this.constraints.minSafety;
    const coherenceOk = rewardSignal.coherence >= this.constraints.minCoherence;
    const riskOk = (1 - rewardSignal.overall) <= this.constraints.maxRisk;

    const safe = safetyOk && coherenceOk && riskOk;

    if (!safe) {
      logger.warn('Reward signal fails safety constraints', {
        safety: rewardSignal.safety.toFixed(2),
        coherence: rewardSignal.coherence.toFixed(2),
        risk: (1 - rewardSignal.overall).toFixed(2)
      });
    }

    return safe;
  }

  /**
   * Adjust reward based on safety constraints
   */
  adjustReward(rewardSignal: RewardSignal): RewardSignal {
    if (this.isSafe(rewardSignal)) {
      return rewardSignal;
    }

    // Penalize unsafe responses
    const penalty = 0.3;
    const adjustedOverall = Math.max(0, rewardSignal.overall - penalty);

    logger.debug('Reward adjusted for safety', {
      original: rewardSignal.overall.toFixed(2),
      adjusted: adjustedOverall.toFixed(2)
    });

    return {
      ...rewardSignal,
      overall: adjustedOverall
    };
  }

  /**
   * Check if action is allowed (exploration vs exploitation)
   */
  canExplore(currentReward: number, explorationRate: number = 0.1): boolean {
    // Only explore if current performance is good enough
    if (currentReward < 0.5) {
      return false; // Too risky to explore
    }

    // Random exploration based on rate
    return Math.random() < explorationRate;
  }

  /**
   * Update safety constraints
   */
  updateConstraints(constraints: Partial<SafetyConstraint>): void {
    this.constraints = {
      ...this.constraints,
      ...constraints
    };
    logger.info('Safety constraints updated', { constraints: this.constraints });
  }
}

