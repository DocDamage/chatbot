/**
 * Canary Certification Suite Unit & Integration Tests
 */

import { CanaryCertificationSuite } from './CanaryCertificationSuite';
import { ProcessTreeSupervisor } from '../../coding/teams/ProcessTreeSupervisor';
import { ProductionMediaEngineAdapter } from '../../multimodal/localization/ProductionMediaEngineAdapter';
import { LocalHardwareCanary } from '../../providers/local/LocalHardwareCanary';
import { CapabilityPersistenceStore } from '../persistence/CapabilityPersistenceStore';
import { AlertNotificationDispatcher } from '../observability/AlertNotificationDispatcher';

describe('CanaryCertificationSuite (CF-04 to CF-10)', () => {
  it('runs all multi-domain canaries successfully', async () => {
    const suite = new CanaryCertificationSuite();
    const report = await suite.runAll();

    expect(report.totalCanaries).toBe(7);
    expect(report.passedCanaries).toBe(7);
    expect(report.failedCanaries).toBe(0);
    expect(report.passed).toBe(true);
    expect(report.overallDigest).toMatch(/^[a-f0-9]{64}$/);

    for (const item of report.results) {
      expect(item.passed).toBe(true);
      expect(item.durationMs).toBeGreaterThanOrEqual(0);
      expect(item.sha256Digest).toMatch(/^[a-f0-9]{64}$/);
    }
  }, 30_000);

  describe('ProcessTreeSupervisor', () => {
    it('executes simple command and captures stdout and output digest', async () => {
      const supervisor = new ProcessTreeSupervisor();
      const res = await supervisor.executeCommand('node', ['-e', 'console.log("HELLO_PROCESS")'], {
        cwd: process.cwd(),
        timeoutMs: 5000
      });

      expect(res.exitCode).toBe(0);
      expect(res.stdout.trim()).toBe('HELLO_PROCESS');
      expect(res.timedOut).toBe(false);
      expect(res.outputDigest).toMatch(/^[a-f0-9]{64}$/);
    });

    it('kills process tree on timeout', async () => {
      const supervisor = new ProcessTreeSupervisor();
      const res = await supervisor.executeCommand('node', ['-e', 'setTimeout(()=>{}, 10000)'], {
        cwd: process.cwd(),
        timeoutMs: 150
      });

      expect(res.timedOut).toBe(true);
      expect(res.killedBySupervisor).toBe(true);
    });
  });

  describe('ProductionMediaEngineAdapter', () => {
    it('probes media files and returns resolution and duration', async () => {
      const adapter = new ProductionMediaEngineAdapter({ allowMockFallback: true });
      const info = await adapter.validateMedia(__filename);
      expect(info.duration).toBeGreaterThan(0);
      expect(info.sizeBytes).toBeGreaterThan(0);
    });
  });

  describe('LocalHardwareCanary', () => {
    it('executes hardware canary check without unhandled exceptions', async () => {
      const canary = new LocalHardwareCanary();
      const result = await canary.runCanary();
      expect(result.resourceManagerLease.passed).toBe(true);
      expect(result.passed).toBe(true);
    });
  });

  describe('CapabilityPersistenceStore & AlertNotificationDispatcher', () => {
    it('persists and retrieves telemetry records from disk', () => {
      const store = CapabilityPersistenceStore.getInstance();
      const testEvent = {
        id: `tel-test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        capabilityId: 'coding.test',
        operation: 'unit_test',
        durationMs: 45,
        success: true,
        privacyMode: 'strict_local' as const,
        auditCorrelationId: 'corr-test'
      };

      store.appendTelemetry(testEvent);
      const events = store.loadTelemetry(50);
      expect(events.some(e => e.id === testEvent.id)).toBe(true);
    });

    it('dispatches alert and appends to alert history', async () => {
      const dispatcher = AlertNotificationDispatcher.getInstance();
      const res = await dispatcher.dispatchAlert({
        id: `alert-unit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'info',
        capabilityId: 'core.test',
        title: 'Unit Test Alert',
        message: 'Dispatcher test executed',
        owner: 'Tester'
      });

      expect(dispatcher.getAlertHistory().length).toBeGreaterThan(0);
    });
  });
});
