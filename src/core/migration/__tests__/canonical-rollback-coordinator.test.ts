import { CanonicalRollbackCoordinator } from '../CanonicalRollbackCoordinator';
import { RollbackAction } from '../../../types/rollback-recovery';

describe('CanonicalRollbackCoordinator (Section 44)', () => {
  let coordinator: CanonicalRollbackCoordinator;

  beforeEach(() => {
    coordinator = new CanonicalRollbackCoordinator({
      runtimeEngine: 'canonical',
      activeDatasetVersions: { docs: 'v2.1.0', wiki: 'v2.0.0' },
      activeRetrievalPolicyVersion: 'retrieval-v2',
      activeModelPolicyVersion: 'model-v2',
    });
  });

  it('performs runtime rollback returning routing to legacy orchestrator (§44.1)', () => {
    const action: RollbackAction = {
      domain: 'runtime',
      targetVersionOrFlag: 'legacy_orchestrator',
      reason: 'Regression detected in runtime pipeline',
      actor: 'oncall-dev',
      timestamp: new Date().toISOString(),
    };

    const result = coordinator.executeRollback(action);
    expect(result.success).toBe(true);
    expect(coordinator.getCurrentState().runtimeEngine).toBe('legacy_orchestrator');
    expect(result.invariants.conversationDataPreserved).toBe(true);
  });

  it('performs dataset atomic version rollback to prior ready version (§44.2)', () => {
    const action: RollbackAction = {
      domain: 'dataset',
      targetVersionOrFlag: 'v1.0.0',
      reason: 'Dataset corruption detected in v2',
      actor: 'data-eng',
      timestamp: new Date().toISOString(),
    };

    const result = coordinator.executeRollback(action);
    expect(result.success).toBe(true);
    expect(coordinator.getCurrentState().activeDatasetVersions.docs).toBe('v1.0.0');
    expect(coordinator.getCurrentState().activeDatasetVersions.wiki).toBe('v1.0.0');
  });

  it('performs retrieval policy rollback without re-ingesting data (§44.3)', () => {
    const action: RollbackAction = {
      domain: 'retrieval_policy',
      targetVersionOrFlag: 'retrieval-v1-stable',
      reason: 'Under-retrieval observed with v2 weights',
      actor: 'search-eng',
      timestamp: new Date().toISOString(),
    };

    const result = coordinator.executeRollback(action);
    expect(result.success).toBe(true);
    expect(coordinator.getCurrentState().activeRetrievalPolicyVersion).toBe('retrieval-v1-stable');
    // Ensure dataset data/versions remain untouched
    expect(coordinator.getCurrentState().activeDatasetVersions.docs).toBe('v2.1.0');
  });

  it('performs model policy rollback to prior configuration (§44.4)', () => {
    const action: RollbackAction = {
      domain: 'model_policy',
      targetVersionOrFlag: 'model-v1-fallback',
      reason: 'Primary model provider rate limiting',
      actor: 'platform-eng',
      timestamp: new Date().toISOString(),
    };

    const result = coordinator.executeRollback(action);
    expect(result.success).toBe(true);
    expect(coordinator.getCurrentState().activeModelPolicyVersion).toBe('model-v1-fallback');
  });

  it('detects and flags failed invariants during rollback', () => {
    const action: RollbackAction = {
      domain: 'runtime',
      targetVersionOrFlag: 'legacy_orchestrator',
      reason: 'Test invariant violation',
      actor: 'test-runner',
      timestamp: new Date().toISOString(),
    };

    const result = coordinator.executeRollback(action, () => ({
      conversationDataPreserved: false, // invariant failed!
      ragDataPreserved: true,
      datasetMetadataPreserved: true,
      botProfilesPreserved: true,
      feedbackPreserved: true,
      activeKnowledgeVersionPreserved: true,
    }));

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]).toContain('Preservation invariant check failed');
  });
});
