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
});
