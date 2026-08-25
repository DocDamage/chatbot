import { CapabilityObservabilityService } from './CapabilityObservabilityService';

describe('CapabilityObservabilityService', () => {
  let service: CapabilityObservabilityService;

  beforeEach(() => {
    service = CapabilityObservabilityService.getInstance();
    service.resetTelemetry();
  });

  it('records telemetry and updates live latency and success percentiles', () => {
    service.recordTelemetry({
      capabilityId: 'repo_architecture',
      operation: 'generate_topology',
      durationMs: 150,
      success: true,
      privacyMode: 'strict_local',
      auditCorrelationId: 'corr-001',
      sanitizedMetadata: { nodeCount: 42 }
    });

    service.recordTelemetry({
      capabilityId: 'repo_architecture',
      operation: 'generate_topology',
      durationMs: 300,
      success: true,
      privacyMode: 'strict_local',
      auditCorrelationId: 'corr-002'
    });

    const summary = service.getDashboardSummary();
    expect(summary.totalInvocations).toBe(2);
    expect(summary.successRate).toBe(1.0);
    expect(summary.latencyPercentiles.p50).toBeGreaterThanOrEqual(150);
    expect(summary.slos.length).toBeGreaterThanOrEqual(3);
  });

  it('tracks error budget depletion on failure and triggers at_risk status', () => {
    for (let i = 0; i < 5; i++) {
      service.recordTelemetry({
        capabilityId: 'browser_qa_automation',
        operation: 'navigate_and_capture',
        durationMs: 800,
        success: false,
        errorCode: 'TIMEOUT',
        privacyMode: 'strict_local',
        auditCorrelationId: `corr-err-${i}`
      });
    }

    const summary = service.getDashboardSummary();
    expect(summary.successRate).toBe(0);
    const availSLO = summary.slos.find(s => s.id === 'availability');
    expect(availSLO).toBeDefined();
    expect(availSLO?.errorBudgetRemaining).toBeLessThan(100);
  });

  it('generates a scrubbed diagnostic support bundle with SHA-256 digest', () => {
    service.recordTelemetry({
      capabilityId: 'video_localization_worker',
      operation: 'transcribe',
      durationMs: 250,
      success: true,
      privacyMode: 'strict_local',
      auditCorrelationId: 'corr-sub',
      sanitizedMetadata: { userEmail: 'operator@example.com', secretToken: 'sk-live-1234567890' }
    });

    const bundle = service.generateSupportBundle();
    expect(bundle.bundleId).toMatch(/^bundle-/);
    expect(bundle.sha256Digest).toHaveLength(64);
    expect(bundle.systemEnvironment.nodeVersion).toBeDefined();
    expect(bundle.metricsSummary).toBeDefined();

    // Verify logs and metadata are scrubbed
    const jsonStr = JSON.stringify(bundle);
    expect(jsonStr).not.toContain('sk-live-1234567890');
    expect(jsonStr).not.toContain('operator@example.com');
  });

  it('sanitizes every metadata value category and applies zero-cost defaults', () => {
    const event = service.recordTelemetry({
      capabilityId: 'local_model_adapter',
      operation: 'metadata-test',
      durationMs: 0,
      success: true,
      privacyMode: 'strict_local',
      auditCorrelationId: 'metadata-test',
      sanitizedMetadata: {
        text: 'operator@example.com',
        count: 2,
        enabled: false,
        nested: { secret: true }
      } as any
    });

    expect(event.sanitizedMetadata).toMatchObject({
      count: 2,
      enabled: false,
      nested: '[COMPLEX_OBJECT]'
    });
    expect(event.sanitizedMetadata?.text).not.toContain('operator@example.com');
    expect(service.getDashboardSummary().totalEstimatedCostUsd).toBe(0);
  });

  it('reports critical rollback triggers and warning error-budget alerts', () => {
    for (let i = 0; i < 41; i++) {
      service.recordTelemetry({
        capabilityId: 'browser_jobs',
        operation: 'slow-success',
        durationMs: 900,
        success: true,
        privacyMode: 'strict_local',
        auditCorrelationId: `slow-${i}`
      });
    }
    let summary = service.getDashboardSummary();
    expect(summary.recentAlerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'warning', owner: expect.any(String) })
    ]));

    service.recordTelemetry({
      capabilityId: 'browser_jobs',
      operation: 'failure',
      durationMs: 10,
      success: false,
      privacyMode: 'strict_local',
      auditCorrelationId: 'failure-with-default-code'
    });
    summary = service.getDashboardSummary();
    expect(summary.activeRollbackTriggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ capabilityId: 'availability', severity: 'critical' })
    ]));
  });

  it('caps retained telemetry and records deployment mode in support bundles', () => {
    (service as any).MAX_EVENTS = 2;
    process.env.DEPLOYMENT_MODE = 'TEST_PROFILE';
    for (let i = 0; i < 3; i++) {
      service.recordTelemetry({
        capabilityId: 'repo_architecture', operation: `event-${i}`, durationMs: i,
        success: true, privacyMode: 'strict_local', auditCorrelationId: `cap-${i}`
      });
    }

    expect(service.getDashboardSummary().totalInvocations).toBe(2);
    expect(service.generateSupportBundle().systemEnvironment.deploymentMode).toBe('TEST_PROFILE');
    delete process.env.DEPLOYMENT_MODE;
    (service as any).MAX_EVENTS = 5000;
  });
});
