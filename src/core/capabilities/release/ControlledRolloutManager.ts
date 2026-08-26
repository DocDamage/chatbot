/**
 * Controlled Rollout and Rollback Manager (PX22-T04)
 * Orchestrates the 6 progressive rollout stages:
 *   Stage 1: Internal Development
 *   Stage 2: Clean-Machine Local Validation
 *   Stage 3: Production-Like Staging
 *   Stage 4: Limited Opt-In Preview
 *   Stage 5: Broader Preview
 *   Stage 6: Production Supported Release
 * Enforces automated rollback triggers:
 * - Security / boundary violation
 * - Data loss or corrupted index
 * - Crash loops
 * - Capability misrouting
 * - Runaway resource or provider cost
 * - Unsafe filesystem / editor mutation
 * - Privacy / telemetry leakage
 * - Severe quality / accuracy regression
 */

export type RolloutStage =
  | 'internal_dev'
  | 'clean_machine_local'
  | 'staging'
  | 'opt_in_preview'
  | 'broader_preview'
  | 'production_supported';

export type RollbackTriggerReason =
  | 'security_violation'
  | 'data_loss'
  | 'crash_loop'
  | 'capability_misrouting'
  | 'runaway_resource_cost'
  | 'unsafe_mutation'
  | 'privacy_leakage'
  | 'quality_regression';

export interface RolloutState {
  capabilityId: string;
  currentStage: RolloutStage;
  targetStage: RolloutStage;
  rolloutPercentage: number;
  isRollbackActive: boolean;
  activeRollbackReason?: RollbackTriggerReason;
  lastUpdated: string;
  history: Array<{ stage: RolloutStage; timestamp: string; note: string }>;
}

export class ControlledRolloutManager {
  private static instance: ControlledRolloutManager;
  private states: Map<string, RolloutState> = new Map();

  public static getInstance(): ControlledRolloutManager {
    if (!ControlledRolloutManager.instance) {
      ControlledRolloutManager.instance = new ControlledRolloutManager();
    }
    return ControlledRolloutManager.instance;
  }

  public getOrCreateRolloutState(capabilityId: string): RolloutState {
    let state = this.states.get(capabilityId);
    if (!state) {
      state = {
        capabilityId,
        currentStage: 'internal_dev',
        targetStage: 'production_supported',
        rolloutPercentage: 0,
        isRollbackActive: false,
        lastUpdated: new Date().toISOString(),
        history: [{ stage: 'internal_dev', timestamp: new Date().toISOString(), note: 'Initial rollout state created' }]
      };
      this.states.set(capabilityId, state);
    }
    return state;
  }

  /**
   * Promotes a capability to the next rollout stage.
   */
  public advanceStage(capabilityId: string, nextStage: RolloutStage, note: string = ''): { success: boolean; state: RolloutState; error?: string } {
    const state = this.getOrCreateRolloutState(capabilityId);

    if (state.isRollbackActive) {
      return { success: false, state, error: 'Cannot advance rollout while an active rollback trigger is unresolved' };
    }

    const stages: RolloutStage[] = [
      'internal_dev',
      'clean_machine_local',
      'staging',
      'opt_in_preview',
      'broader_preview',
      'production_supported'
    ];
    const expectedStage = stages[stages.indexOf(state.currentStage) + 1];
    if (nextStage !== expectedStage) {
      return { success: false, state, error: `Rollout must advance sequentially to '${expectedStage || 'none'}'.` };
    }
    if (!note.trim()) {
      return { success: false, state, error: 'Rollout advancement requires an immutable evidence reference.' };
    }

    state.currentStage = nextStage;
    state.lastUpdated = new Date().toISOString();
    state.history.push({ stage: nextStage, timestamp: state.lastUpdated, note });

    // Update traffic percentage according to stage
    switch (nextStage) {
      case 'internal_dev': state.rolloutPercentage = 0; break;
      case 'clean_machine_local': state.rolloutPercentage = 5; break;
      case 'staging': state.rolloutPercentage = 10; break;
      case 'opt_in_preview': state.rolloutPercentage = 25; break;
      case 'broader_preview': state.rolloutPercentage = 50; break;
      case 'production_supported': state.rolloutPercentage = 100; break;
    }

    return { success: true, state };
  }

  /**
   * Executes an immediate rollback to safe baseline upon trigger condition.
   */
  public triggerRollback(capabilityId: string, reason: RollbackTriggerReason, details: string): RolloutState {
    const state = this.getOrCreateRolloutState(capabilityId);
    state.isRollbackActive = true;
    state.activeRollbackReason = reason;
    state.currentStage = 'internal_dev';
    state.rolloutPercentage = 0;
    state.lastUpdated = new Date().toISOString();
    state.history.push({
      stage: 'internal_dev',
      timestamp: state.lastUpdated,
      note: `ROLLBACK EXECUTED: [${reason}] ${details}`
    });

    return state;
  }

  public listAllStates(): RolloutState[] {
    return Array.from(this.states.values());
  }
}
