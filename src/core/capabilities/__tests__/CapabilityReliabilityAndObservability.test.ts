import { CapabilitySLOEngine } from '../reliability/CapabilitySLOEngine';
import { CapabilityMetricsCollector } from '../observability/CapabilityMetricsCollector';
import { DistributedTracingService } from '../observability/DistributedTracingService';
import { DurableRestartRecoveryService } from '../reliability/DurableRestartRecoveryService';
import { AdapterFailureMatrix } from '../reliability/AdapterFailureMatrix';
import { LoadSoakBenchmarkRunner } from '../reliability/LoadSoakBenchmarkRunner';
import { ExpandedBackupRecoveryEngine } from '../backup/ExpandedBackupRecoveryEngine';
import { StorageQuotaManager } from '../storage/StorageQuotaManager';
import { CapabilityDashboardService } from '../observability/CapabilityDashboardService';
import { PerformanceRegressionGate } from '../reliability/PerformanceRegressionGate';
import { createHash } from 'crypto';

describe('Phase PX-20: Performance, Reliability, Observability, Backup, and Recovery', () => {
  describe('PX20-T01: CapabilitySLOEngine', () => {
    it('defines SLO targets and separates app overhead from provider overhead', () => {
      const engine = CapabilitySLOEngine.getInstance();
      const targets = engine.listTargets();
      expect(targets.length).toBeGreaterThanOrEqual(8);

      engine.recordMeasurement({
        sloId: 'slo-health-check-latency',
        capabilityId: 'all',
        measuredValue: 45,
        appOverheadMs: 15,
        providerOverheadMs: 30
      });

      const evalResult = engine.evaluateCompliance('slo-health-check-latency');
      expect(evalResult).toBeDefined();
      expect(evalResult?.isCompliant).toBe(true);
      expect(evalResult?.appOverheadWithinBudget).toBe(true);
      expect(evalResult?.status).toBe('healthy');
    });

    it('evaluates compliance breach when measured value exceeds target', () => {
      const engine = CapabilitySLOEngine.getInstance();
      engine.resetMeasurements();

      engine.recordMeasurement({
        sloId: 'slo-health-check-latency',
        capabilityId: 'all',
        measuredValue: 500, // exceeds 200ms
        appOverheadMs: 120,
        providerOverheadMs: 380
      });

      const evalResult = engine.evaluateCompliance('slo-health-check-latency');
      expect(evalResult?.isCompliant).toBe(false);
      expect(evalResult?.status).toBe('breached');
    });
  });

  describe('PX20-T02: CapabilityMetricsCollector', () => {
    it('collects counters, gauges, and histograms with bounded labels', () => {
      const collector = CapabilityMetricsCollector.getInstance();
      collector.reset();

      collector.recordJobExecution('godot_studio', 150, 'completed');
      collector.recordQueueDepth(5, 300);
      collector.recordContextSavings(500, 1000);
      collector.recordWorkerCrash('ffmpeg_worker', 'SIGSEGV');

      const snapshot = collector.getSnapshot();
      expect(snapshot.counters.length).toBeGreaterThanOrEqual(3);
      expect(snapshot.gauges.length).toBeGreaterThanOrEqual(2);
      expect(snapshot.histograms.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PX20-T03: DistributedTracingService', () => {
    it('tracks spans and traces with sanitized attributes', () => {
      const tracer = DistributedTracingService.getInstance();
      tracer.clear();

      const { traceId, rootSpan } = tracer.startTrace('execute_agent_task');
      expect(traceId).toBeDefined();
      expect(rootSpan.stage).toBe('request');

      const span = tracer.startSpan(traceId, 'policy_evaluation', 'policy_check', rootSpan.spanId, {
        apiKey: 'sk-live-1234567890abcdef',
        role: 'developer'
      });

      expect(span.attributes.apiKey).toBe('[REDACTED_KEY]');

      tracer.endSpan(traceId, span.spanId, 'ok');
      const finishedTrace = tracer.endTrace(traceId, 'ok');

      expect(finishedTrace).toBeDefined();
      expect(finishedTrace?.spans.length).toBe(2);
      expect(finishedTrace?.sha256Digest).toBeDefined();
    });
  });

  describe('PX20-T04: DurableRestartRecoveryService', () => {
    it('requeues idempotent jobs and fails non-resumable jobs on startup', async () => {
      const recovery = DurableRestartRecoveryService.getInstance();

      const result = await recovery.executeStartupRecovery({
        pendingJobs: [
          {
            jobId: 'job-idempotent-1',
            capabilityId: 'context_economy',
            isIdempotent: true,
            status: 'running',
            payloadSummary: 'AST Outline Generation',
            createdTimestamp: new Date().toISOString()
          },
          {
            jobId: 'job-destructive-2',
            capabilityId: 'godot_studio',
            isIdempotent: false,
            status: 'running',
            payloadSummary: 'Direct Scene Mutation',
            createdTimestamp: new Date().toISOString()
          }
        ],
        registeredAdapters: ['local_model_engine', 'godot_adapter'],
        staleClaims: ['claim-1'],
        orphanPids: [1234]
      });

      expect(result.requeuedJobs).toContain('job-idempotent-1');
      expect(result.failedNonResumableJobs).toContain('job-destructive-2');
      expect(result.releasedClaimsCount).toBe(1);
      expect(result.terminatedOrphanProcesses).toBe(1);
      expect(result.sha256Digest).toBeDefined();
    });
  });

  describe('PX20-T05: AdapterFailureMatrix', () => {
    it('handles failure modes gracefully with remediation guidance', () => {
      const matrix = AdapterFailureMatrix.getInstance();
      const rules = matrix.listRules();
      expect(rules.length).toBeGreaterThanOrEqual(10);

      const localModelFail = matrix.handleFailure('local_model_unreachable');
      expect(localModelFail.handledSuccessfully).toBe(true);
      expect(localModelFail.actionTaken).toBe('fallback_to_template');

      const diskFail = matrix.handleFailure('disk_full');
      expect(diskFail.actionTaken).toBe('refuse_gracefully');

      const gpuFail = matrix.handleFailure('gpu_oom');
      expect(gpuFail.actionTaken).toBe('fail_safe');
    });
  });

  describe('PX20-T06: LoadSoakBenchmarkRunner', () => {
    it('executes multi-domain workload scenarios and captures resource metrics', async () => {
      const runner = LoadSoakBenchmarkRunner.getInstance();
      const scenarios = runner.getSupportedScenarios();
      expect(scenarios.length).toBeGreaterThanOrEqual(8);

      const result = await runner.executeScenario(scenarios[0]);
      expect(result.passed).toBe(false);
      expect(result.evidenceKind).toBe('synthetic_simulation');
      expect(result.certificationEligible).toBe(false);
      expect(result.avgIterationMs).toBeGreaterThanOrEqual(0);
      expect(result.peakResources.eventLoopDelayMs).toBeLessThan(50);
    });
  });

  describe('PX20-T07: ExpandedBackupRecoveryEngine', () => {
    it('generates a full multi-domain backup manifest and executes a restore drill', () => {
      const engine = ExpandedBackupRecoveryEngine.getInstance();
      const itemData = { installedPacks: ['context_economy'], telemetryMode: 'scrubbed' };
      const bundle = engine.generateBackupBundle({
        ownerId: 'usr-admin-1',
        projectId: 'proj-core-alpha',
        items: [{
          id: 'item-cap-config-001',
          category: 'capability_config',
          title: 'Active Capability Configurations',
          ownerId: 'usr-admin-1',
          projectId: 'proj-core-alpha',
          payloadDigest: createHash('sha256').update(JSON.stringify(itemData)).digest('hex'),
          sizeBytes: Buffer.byteLength(JSON.stringify(itemData)),
          data: itemData
        }]
      });

      expect(bundle.items.length).toBe(1);
      expect(bundle.categoriesCovered).toContain('capability_config');
      expect(bundle.certificationEligible).toBe(true);
      expect(bundle.overallSha256Digest).toBeDefined();

      const drill = engine.executeRestoreDrill(bundle);
      expect(drill.success).toBe(true);
      expect(drill.digestIntegrityPassed).toBe(true);
      expect(drill.manifestIntegrityPassed).toBe(true);
      expect(drill.ownershipValidated).toBe(true);
      expect(drill.corruptedItems.length).toBe(0);
    });
  });

  describe('PX20-T08: StorageQuotaManager', () => {
    it('enforces low disk refusal and quota limits', () => {
      const manager = StorageQuotaManager.getInstance();
      manager.setPolicy({
        ownerId: 'user1',
        projectId: 'proj1',
        maxArtifactQuotaBytes: 100 * 1024 * 1024, // 100MB
        maxTempQuotaBytes: 20 * 1024 * 1024,
        maxJobRetentionDays: 30,
        lowDiskRefusalThresholdMb: 500
      });

      // Permitted write
      const perm1 = manager.evaluateWritePermission({
        ownerId: 'user1',
        projectId: 'proj1',
        writeSizeBytes: 10 * 1024 * 1024,
        currentArtifactBytes: 20 * 1024 * 1024,
        currentAvailableDiskMb: 2048
      });
      expect(perm1.allowed).toBe(true);

      // Low disk refusal
      const permLowDisk = manager.evaluateWritePermission({
        ownerId: 'user1',
        projectId: 'proj1',
        writeSizeBytes: 1024,
        currentArtifactBytes: 1024,
        currentAvailableDiskMb: 300 // below 500MB
      });
      expect(permLowDisk.allowed).toBe(false);
      expect(permLowDisk.reason).toContain('Low disk refusal active');

      // Quota exceeded
      const permOverQuota = manager.evaluateWritePermission({
        ownerId: 'user1',
        projectId: 'proj1',
        writeSizeBytes: 90 * 1024 * 1024,
        currentArtifactBytes: 20 * 1024 * 1024,
        currentAvailableDiskMb: 5000
      });
      expect(permOverQuota.allowed).toBe(false);
      expect(permOverQuota.reason).toContain('Artifact quota exceeded');
    });

    it('generates cleanup preview while respecting pinned protected artifacts', () => {
      const manager = StorageQuotaManager.getInstance();
      manager.protectArtifact('art-pinned-important');

      const preview = manager.generateCleanupPreview([
        { id: 'art-pinned-important', path: '/art/pinned', category: 'old_artifact', sizeBytes: 5000, ageDays: 45 },
        { id: 'art-old-temp', path: '/art/temp', category: 'temp', sizeBytes: 3000, ageDays: 10 },
        { id: 'art-orphan', path: '/art/orphan', category: 'orphan', sizeBytes: 7000, ageDays: 5 }
      ]);

      expect(preview.protectedSkippedCount).toBe(1);
      expect(preview.totalCandidates).toBe(2);
      expect(preview.reclaimableBytes).toBe(10000);
    });
  });

  describe('PX20-T09: CapabilityDashboardService', () => {
    it('returns domain dashboard overviews and operational runbooks', () => {
      const dashboards = CapabilityDashboardService.getInstance();
      const overview = dashboards.getDashboardOverview();
      expect(overview.length).toBe(9);

      const runbooks = dashboards.getRunbooks();
      expect(runbooks.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('PX20-T10: PerformanceRegressionGate', () => {
    it('validates current run against versioned baselines', () => {
      const gate = PerformanceRegressionGate.getInstance();

      const passingRun = gate.evaluateCurrentRun({
        repo_indexing_p95_ms: 140, // baseline is 150
        context_compression_ratio: 45.0, // baseline is 40.0
        local_model_first_token_ms: 750,
        retrieval_benchmark_score: 1.0,
        peak_resident_memory_mb: 240
      });
      expect(passingRun.passed).toBe(true);
      expect(passingRun.regressedMetricsCount).toBe(0);

      const failingRun = gate.evaluateCurrentRun({
        repo_indexing_p95_ms: 300, // severe latency regression
        retrieval_benchmark_score: 0.8 // accuracy regression
      });
      expect(failingRun.passed).toBe(false);
      expect(failingRun.regressedMetricsCount).toBe(2);
    });
  });
});
