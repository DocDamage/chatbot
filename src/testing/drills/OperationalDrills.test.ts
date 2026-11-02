import { CapabilitySLOEngine } from '../../core/capabilities/reliability/CapabilitySLOEngine';
import { CapabilityMetricsCollector } from '../../core/capabilities/observability/CapabilityMetricsCollector';

describe('RT-MAINT-001..002 / RT-REL-001..003 — Quarterly Operational Drills & Reliability Matrix', () => {
  it('tracks SLO violations and reports latency & availability metrics', () => {
    const sloEngine = CapabilitySLOEngine.getInstance();
    const metrics = CapabilityMetricsCollector.getInstance();

    metrics.recordJobExecution('stt_engine', 150, 'completed');
    metrics.recordQueueDepth(2, 50);

    sloEngine.recordMeasurement({
      sloId: 'slo-health-check-latency',
      capabilityId: 'all',
      measuredValue: 45,
      appOverheadMs: 15,
      providerOverheadMs: 30,
    });

    const report = sloEngine.evaluateCompliance('slo-health-check-latency');
    expect(report).toBeDefined();
    expect(report?.isCompliant).toBe(true);
    expect(report?.status).toBe('healthy');
  });
});
