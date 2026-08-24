import { CapabilityPromotionEngine } from './CapabilityPromotionEngine';
import { CapabilityRegistry } from '../CapabilityRegistry';
import { CapabilityObservabilityService } from '../observability/CapabilityObservabilityService';

describe('CapabilityPromotionEngine', () => {
  let engine: CapabilityPromotionEngine;
  let registry: CapabilityRegistry;

  beforeEach(() => {
    engine = CapabilityPromotionEngine.getInstance();
    registry = CapabilityRegistry.getInstance();
    registry.clearOverrides();
    CapabilityObservabilityService.getInstance().resetTelemetry();
    delete process.env.CF_ACCESSIBILITY_CERTIFIED;
  });

  afterEach(() => delete process.env.CF_ACCESSIBILITY_CERTIFIED);

  it('rejects a promotion that does not advance exactly one maturity stage', async () => {
    const evalResult = await engine.evaluatePromotion('repo_architecture', 'LOCAL_ONLY_EXPERIMENTAL');

    expect(evalResult).toBeDefined();
    expect(evalResult.capabilityId).toBe('repo_architecture');
    expect(evalResult.targetMaturity).toBe('LOCAL_ONLY_EXPERIMENTAL');
    expect(evalResult.isEligible).toBe(false);
    expect(evalResult.blockers.join(' ')).toContain('Invalid promotion transition');
    expect(evalResult.gateCriteria.length).toBeGreaterThanOrEqual(2);
  });

  it('executes promotion and generates immutable PromotionDecisionRecord with SHA-256 digest', async () => {
    process.env.CF_ACCESSIBILITY_CERTIFIED = 'true';
    CapabilityObservabilityService.getInstance().recordTelemetry({
      capabilityId: 'repo_architecture', operation: 'promotion-test', durationMs: 10, success: true,
      auditCorrelationId: 'promotion-test-correlation', privacyMode: 'prefer_local'
    });
    const result = await engine.executePromotion({
      capabilityId: 'repo_architecture',
      targetMaturity: 'PRODUCTION_PREVIEW',
      promotedBy: 'Test Auditor',
      rationale: 'Passed full benchmark suite with 100% checks green',
      userRole: 'admin'
    });

    expect(result.success).toBe(true);
    expect(result.decisionRecord).toBeDefined();
    expect(result.decisionRecord?.sha256Digest).toHaveLength(64);
    expect(result.decisionRecord?.newMaturity).toBe('PRODUCTION_PREVIEW');
    expect(result.decisionRecord?.promotedBy).toBe('Test Auditor');

    // Verify registry reflects updated maturity
    const cap = registry.getCapabilityById('repo_architecture');
    expect(cap?.maturity).toBe('PRODUCTION_PREVIEW');
  });

  it('rejects promotion if user does not have developer or admin role', async () => {
    const result = await engine.executePromotion({
      capabilityId: 'repo_architecture',
      targetMaturity: 'PRODUCTION_PREVIEW',
      promotedBy: 'Standard User',
      rationale: 'Unapproved user promotion attempt',
      userRole: 'user'
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('does not have authority');
  });

  it('executes rollback and records audit record', async () => {
    registry.updateCapabilityMaturity('repo_architecture', 'PRODUCTION_PREVIEW');
    const result = await engine.executeRollback({
      capabilityId: 'repo_architecture',
      rollbackMaturity: 'LOCAL_ONLY_EXPERIMENTAL',
      reason: 'Automated rollback triggered: SLO degradation detected',
      operator: 'Rollback Watchdog',
      userRole: 'admin'
    });

    expect(result.success).toBe(true);
    const cap = registry.getCapabilityById('repo_architecture');
    expect(cap?.maturity).toBe('LOCAL_ONLY_EXPERIMENTAL');

    const records = engine.getDecisionRecords();
    const latest = records[records.length - 1];
    expect(latest.rationale).toContain('ROLLBACK TRIGGERED');
  });
});
