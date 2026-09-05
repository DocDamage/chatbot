import { RolloutStageCoordinator } from '../RolloutStageCoordinator';
import { Stage7Prerequisites } from '../../../types/rollout-migration';

describe('RolloutStageCoordinator (Section 43)', () => {
  let coordinator: RolloutStageCoordinator;

  beforeEach(() => {
    coordinator = new RolloutStageCoordinator('1_instrumentation');
  });

  it('initializes at Stage 1 routing to legacy', () => {
    expect(coordinator.getStatus().currentStage).toBe('1_instrumentation');
    const decision = coordinator.routeTraffic({ requestId: 'r-1' });
    expect(decision.routingTarget).toBe('legacy');
  });

  it('routes to shadow planner in Stage 3', () => {
    coordinator.setStage('3_shadow_planner');
    expect(coordinator.getStatus().shadowExecutionEnabled).toBe(true);
    const decision = coordinator.routeTraffic({ requestId: 'r-2' });
    expect(decision.routingTarget).toBe('shadow');
  });

  it('routes internal canary users to canonical while non-internal remain on legacy in Stage 4', () => {
    coordinator.setStage('4_internal_canary', { allowedRoles: ['developer', 'tester'] });
    const devDecision = coordinator.routeTraffic({ requestId: 'r-3', userRole: 'developer' });
    expect(devDecision.routingTarget).toBe('canonical');

    const guestDecision = coordinator.routeTraffic({ requestId: 'r-4', userRole: 'guest' });
    expect(guestDecision.routingTarget).toBe('legacy');
  });

  it('routes percentage canary traffic in Stage 6', () => {
    coordinator.setStage('6_production_preview', { trafficPercentage: 25 });
    const inCanary = coordinator.routeTraffic({ requestId: 'r-5', sampleBucket: 10 });
    expect(inCanary.routingTarget).toBe('canonical');

    const outCanary = coordinator.routeTraffic({ requestId: 'r-6', sampleBucket: 50 });
    expect(outCanary.routingTarget).toBe('legacy');
  });

  it('enforces Stage 7 prerequisites strictly before promoting to default', () => {
    const incompletePrereqs: Stage7Prerequisites = {
      goldenSuitePassed: true,
      securityCleared: true,
      loadValidated: false, // failing prerequisite
      dataMigrationVerified: true,
      providerCanariesHealthy: true,
      knowledgeAbPromoted: true,
      rollbackEvidenceCollected: false, // failing prerequisite
    };

    const attempt = coordinator.setStage('7_default', { stage7Prereqs: incompletePrereqs });
    expect(attempt.success).toBe(false);
    expect(attempt.errors.length).toBe(2);
    expect(coordinator.getStatus().currentStage).toBe('1_instrumentation');

    const completePrereqs: Stage7Prerequisites = {
      ...incompletePrereqs,
      loadValidated: true,
      rollbackEvidenceCollected: true,
    };

    const successAttempt = coordinator.setStage('7_default', { stage7Prereqs: completePrereqs });
    expect(successAttempt.success).toBe(true);
    expect(coordinator.getStatus().currentStage).toBe('7_default');
    expect(coordinator.getStatus().trafficPercentage).toBe(100);

    const defaultDecision = coordinator.routeTraffic({ requestId: 'r-7' });
    expect(defaultDecision.routingTarget).toBe('canonical');
  });
});
