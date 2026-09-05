import { CapabilityPromotionEngine } from './CapabilityPromotionEngine';
import { CapabilityRegistry } from '../CapabilityRegistry';
import { CapabilityObservabilityService } from '../observability/CapabilityObservabilityService';

const suiteResult = (overrides: Record<string, unknown> = {}) => ({
  id: 'eval-test',
  timestamp: new Date(0).toISOString(),
  runtimeProfile: 'local',
  totalChecks: 1,
  passedChecks: 1,
  failedChecks: 0,
  warnedChecks: 0,
  overallScore: 1,
  status: 'passed',
  domainSummaries: {},
  checks: [],
  sha256Digest: 'a'.repeat(64),
  ...overrides
} as any);

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

  it('returns a deterministic blocker for unknown capabilities', async () => {
    const result = await engine.evaluatePromotion('missing-capability', 'PRODUCTION_PREVIEW', suiteResult());

    expect(result.currentMaturity).toBe('DEPRECATED');
    expect(result.gateCriteria).toEqual([]);
    expect(result.blockers).toEqual(["Capability 'missing-capability' not found in registry."]);
  });

  it('evaluates both passing and failing local-experimental gates', async () => {
    registry.updateCapabilityMaturity('local_model_adapter', 'DEPRECATED');
    const passing = await engine.evaluatePromotion(
      'local_model_adapter',
      'LOCAL_ONLY_EXPERIMENTAL',
      suiteResult()
    );
    expect(passing.isEligible).toBe(true);
    expect(passing.evaluationSummary).toEqual({ passedCriteria: 2, totalCriteria: 2, score: 1 });

    registry.updateCapabilityMaturity('repo_architecture', 'DEPRECATED');
    const failing = await engine.evaluatePromotion(
      'repo_architecture',
      'LOCAL_ONLY_EXPERIMENTAL',
      suiteResult({ status: 'failed', overallScore: 0.79 })
    );
    expect(failing.isEligible).toBe(false);
    expect(failing.gateCriteria.map(gate => gate.passed)).toEqual([false, false]);
    expect(failing.blockers).toHaveLength(2);
  });

  it('requires benchmark, telemetry, and explicit accessibility evidence for preview', async () => {
    const result = await engine.evaluatePromotion(
      'repo_architecture',
      'PRODUCTION_PREVIEW',
      suiteResult({ status: 'degraded', overallScore: 0.89 })
    );

    expect(result.gateCriteria.map(gate => gate.passed)).toEqual([false, false, false]);
    expect(result.evaluationSummary.score).toBe(0);
  });

  it('requires production evaluation and signed release certification for supported maturity', async () => {
    registry.updateCapabilityMaturity('knowledge_online', 'PRODUCTION_PREVIEW');
    const failing = await engine.evaluatePromotion(
      'knowledge_online',
      'PRODUCTION_SUPPORTED',
      suiteResult({ status: 'degraded', overallScore: 0.96 })
    );
    expect(failing.gateCriteria.map(gate => gate.passed)).toEqual([false, false]);

    process.env.CF_RELEASE_CERTIFIED = 'true';
    const passing = await engine.evaluatePromotion(
      'knowledge_online',
      'PRODUCTION_SUPPORTED',
      suiteResult()
    );
    expect(passing.isEligible).toBe(true);
    delete process.env.CF_RELEASE_CERTIFIED;
  });

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

  it('rejects execution when promotion gates fail', async () => {
    const result = await engine.executePromotion({
      capabilityId: 'repo_architecture',
      targetMaturity: 'PRODUCTION_SUPPORTED',
      promotedBy: 'Developer',
      rationale: 'Invalid stage skip',
      userRole: 'developer'
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Promotion failed gate validation');
  });

  it('handles a capability disappearing after an eligible evaluation', async () => {
    const evaluate = jest.spyOn(engine, 'evaluatePromotion').mockResolvedValue({
      capabilityId: 'vanishing',
      currentMaturity: 'LOCAL_ONLY_EXPERIMENTAL',
      targetMaturity: 'PRODUCTION_PREVIEW',
      isEligible: true,
      gateCriteria: [],
      evaluationSummary: { passedCriteria: 0, totalCriteria: 0, score: 0 },
      blockers: []
    });
    const lookup = jest.spyOn(registry, 'getCapabilityById').mockReturnValue(undefined);

    const result = await engine.executePromotion({
      capabilityId: 'vanishing',
      targetMaturity: 'PRODUCTION_PREVIEW',
      promotedBy: 'Developer',
      rationale: 'Race condition test',
      userRole: 'developer'
    });
    expect(result).toEqual({ success: false, message: "Capability 'vanishing' not found." });
    evaluate.mockRestore();
    lookup.mockRestore();
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

  it('rejects unauthorized, unknown, and non-lowering rollbacks', async () => {
    await expect(engine.executeRollback({
      capabilityId: 'repo_architecture', rollbackMaturity: 'DEPRECATED', reason: 'test', operator: 'User', userRole: 'user'
    })).resolves.toMatchObject({ success: false, message: expect.stringContaining('does not have authority') });

    await expect(engine.executeRollback({
      capabilityId: 'missing', rollbackMaturity: 'DEPRECATED', reason: 'test', operator: 'Admin', userRole: 'admin'
    })).resolves.toEqual({ success: false, message: "Capability 'missing' not found." });

    await expect(engine.executeRollback({
      capabilityId: 'repo_architecture', rollbackMaturity: 'PRODUCTION_PREVIEW', reason: 'test', operator: 'Admin', userRole: 'admin'
    })).resolves.toMatchObject({ success: false, message: expect.stringContaining('must be below') });
  });

  it('returns a defensive copy of decision records', () => {
    const records = engine.getDecisionRecords();
    records.length = 0;
    expect(engine.getDecisionRecords().length).toBeGreaterThan(0);
  });
});
