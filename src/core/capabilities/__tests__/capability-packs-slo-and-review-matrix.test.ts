import { CapabilityInstallationManager } from '../packs/CapabilityInstallationManager';
import { CapabilitySLOEngine } from '../reliability/CapabilitySLOEngine';
import { ReviewPipeline } from '../../coding/review/ReviewPipeline';
import { CapabilityPackManifest } from '../packs/CapabilityPackManifest';

describe('B75-08: Capability Packs, SLO Engine, and Code Review Pipeline Matrix', () => {
  describe('CapabilityInstallationManager', () => {
    const manager = CapabilityInstallationManager.getInstance();

    beforeEach(() => {
      manager.clear();
    });

    const sampleManifest: CapabilityPackManifest = {
      schemaVersion: '1.0.0',
      id: 'audio-stemdeck-pack',
      displayName: 'Audio StemDeck Pack',
      version: '1.2.0',
      description: 'Audio separation and stem isolation',
      maturity: 'supported',
      profiles: ['LOCAL_TRUSTED'],
      source: {
        license: 'MIT',
        integration: 'native',
        notices: []
      },
      capabilities: [
        {
          id: 'audio_stem_isolation',
          name: 'Stem Isolation',
          description: 'Stem separation capability',
          maturity: 'supported',
          category: 'multimodal',
          processingLocation: 'local',
          requiredPermissions: ['audio.process']
        }
      ],
      tools: [
        {
          id: 'demucs_separator',
          name: 'Demucs Separator',
          description: 'Separate tracks',
          parametersSchema: {},
          isDangerous: false
        }
      ],
      permissions: [
        {
          permission: 'audio.process',
          description: 'Process audio files',
          scope: 'project',
          requiresApproval: false
        }
      ],
      rollback: {
        canRollback: true,
        dataRetentionStrategy: 'retain_audit',
        remediationSteps: ['Revert binary package']
      }
    };

    it('generates installation plan, installs disabled by default, enables, rolls back, and audits', async () => {
      // 1. Dry run inspection plan
      const planRes = manager.generateInstallationPlan(sampleManifest);
      expect(planRes.success).toBe(true);
      expect(planRes.plan?.packId).toBe('audio-stemdeck-pack');
      expect(planRes.plan?.capabilitiesToAdd).toContain('audio_stem_isolation');

      // 2. Install pack (disabled by default)
      const installRes = manager.installPack(sampleManifest, 'admin_user');
      expect(installRes.success).toBe(true);
      expect(installRes.record?.enabled).toBe(false);
      expect(installRes.record?.status).toBe('installed_disabled');

      // 3. Enable pack
      const enableRes = await manager.enablePack('audio-stemdeck-pack', 'admin_user');
      expect(enableRes.success).toBe(true);
      expect(manager.getInstalledPack('audio-stemdeck-pack')?.enabled).toBe(true);

      // 4. Disable pack
      expect(manager.disablePack('audio-stemdeck-pack', 'admin_user')).toBe(true);
      expect(manager.getInstalledPack('audio-stemdeck-pack')?.enabled).toBe(false);

      // 5. Update pack to v1.3.0
      const v2Manifest: CapabilityPackManifest = { ...sampleManifest, version: '1.3.0' };
      manager.installPack(v2Manifest, 'admin_user');
      expect(manager.getInstalledPack('audio-stemdeck-pack')?.manifest.version).toBe('1.3.0');

      // 6. Rollback pack
      const rollbackRes = manager.rollbackPack('audio-stemdeck-pack', 'admin_user');
      expect(rollbackRes.success).toBe(true);
      expect(manager.getInstalledPack('audio-stemdeck-pack')?.manifest.version).toBe('1.2.0');

      // 7. Audit history
      const audits = manager.getAuditHistory('audio-stemdeck-pack');
      expect(audits.length).toBeGreaterThanOrEqual(4);

      // 8. Remove pack
      expect(manager.removePack('audio-stemdeck-pack', 'admin_user')).toBe(true);
      expect(manager.getInstalledPack('audio-stemdeck-pack')).toBeUndefined();
    });
  });

  describe('CapabilitySLOEngine', () => {
    it('registers targets, records measurements, evaluates compliance, and reports budget status', () => {
      const sloEngine = CapabilitySLOEngine.getInstance();

      // Record compliant measurement
      sloEngine.recordMeasurement({
        sloId: 'slo-health-check-latency',
        capabilityId: 'coding_agent',
        measuredValue: 120,
        appOverheadMs: 30,
        providerOverheadMs: 90
      });

      // Record breaching measurement
      sloEngine.recordMeasurement({
        sloId: 'slo-job-queue-delay',
        capabilityId: 'coding_agent',
        measuredValue: 850,
        appOverheadMs: 150,
        providerOverheadMs: 700
      });

      const evaluations = sloEngine.evaluateAll();
      expect(evaluations.length).toBeGreaterThan(0);

      const healthCheck = evaluations.find((e: any) => e.sloId === 'slo-health-check-latency');
      expect(healthCheck?.isCompliant).toBe(true);

      const queueDelay = evaluations.find((e: any) => e.sloId === 'slo-job-queue-delay');
      expect(queueDelay?.isCompliant).toBe(false);
      expect(['at_risk', 'breached']).toContain(queueDelay?.status);
    });
  });

  describe('ReviewPipeline', () => {
    it('detects dynamic execution, XSS innerHTML, hard-coded secrets, missing tests, and concurrency issues', () => {
      const pipeline = new ReviewPipeline();

      // 1. Dynamic shell execution finding
      const r1 = pipeline.review({
        diff: '+ const res = child_process.execSync(userInput);'
      });
      expect(r1.findings.some(f => f.category === 'security' && f.severity === 'high')).toBe(true);

      // 2. Unsanitized HTML
      const r2 = pipeline.review({
        diff: '+ element.innerHTML = userContent;'
      });
      expect(r2.findings.some(f => f.category === 'security' && f.issue.includes('unsanitized HTML'))).toBe(true);

      // 3. Hard-coded secret
      const r3 = pipeline.review({
        diff: '+ const api_key = "sk-1234567890abcdef";'
      });
      expect(r3.findings.some(f => f.category === 'secrets' && f.severity === 'critical')).toBe(true);

      // 4. Missing test artifacts when test focus is requested
      const r4 = pipeline.review({
        diff: '+ function add(a, b) { return a + b; }',
        focus: ['tests']
      });
      expect(r4.findings.some(f => f.category === 'tests')).toBe(true);

      // 5. Concurrency touching shared mutable state
      const r5 = pipeline.review({
        diff: '+ Promise.all([taskA(), taskB()]); // shared mutable state update'
      });
      expect(r5.findings.some(f => f.category === 'concurrency')).toBe(true);

      // 6. Clean diff with no findings
      const r6 = pipeline.review({
        diff: '+ const safe = 42;'
      });
      expect(r6.findings.length).toBe(0);
      expect(r6.summary).toContain('no detected findings');
    });
  });

  describe('DistributedTracingService', () => {
    it('creates traces and spans, sanitizes secrets, records errors, and computes digest', async () => {
      const { DistributedTracingService } = await import('../observability/DistributedTracingService');
      const tracing = DistributedTracingService.getInstance();
      tracing.clear();

      const { traceId, rootSpan } = tracing.startTrace('run_audio_separation');
      expect(traceId).toBeDefined();
      expect(rootSpan.stage).toBe('request');

      const span1 = tracing.startSpan(traceId, 'validate_permissions', 'policy_check', rootSpan.spanId, {
        apiKey: 'sk-1234567890abcdef',
        email: 'dev@example.com',
        workerCount: 4
      });
      expect(span1.attributes.apiKey).toBe('[REDACTED_KEY]');
      expect(span1.attributes.email).toBe('[REDACTED_EMAIL]');
      expect(span1.attributes.workerCount).toBe(4);

      tracing.endSpan(traceId, span1.spanId, 'ok');

      const span2 = tracing.startSpan(traceId, 'execute_worker', 'worker_execution');
      tracing.endSpan(traceId, span2.spanId, 'error', { errorMsg: 'GPU OOM' });

      const completed = tracing.endTrace(traceId, 'error');
      expect(completed).toBeDefined();
      expect(completed?.hasErrors).toBe(true);
      expect(completed?.sha256Digest).toBeDefined();

      const fetched = tracing.getTrace(traceId);
      expect(fetched?.traceId).toBe(traceId);
      expect(tracing.getRecentTraces(10).length).toBe(1);
    });
  });

  describe('CapabilityJobService', () => {
    it('creates, executes multi-stage jobs, tracks progress, handles cancellation, and isolates by tenant', async () => {
      const { CapabilityJobService } = await import('../jobs/CapabilityJobService');
      const jobService = CapabilityJobService.getInstance();
      jobService.clear();

      // Register custom stages
      jobService.registerJobStages('custom_worker', [
        {
          name: 'init_stage',
          isIdempotent: true,
          execute: async (_job, update) => {
            update(50);
            return { artifacts: ['art-1'] };
          }
        },
        {
          name: 'processing_stage',
          isIdempotent: false,
          execute: async (_job, update) => {
            update(100);
            return { artifacts: ['art-2'], result: { status: 'complete' } };
          }
        }
      ]);

      // Create job
      const job = jobService.createJob({
        capabilityId: 'custom_worker',
        packId: 'pack-1',
        ownerId: 'user-alice',
        inputs: { test: 123 },
        approvalDigest: 'digest-abc'
      });

      expect(job.id).toBeDefined();
      expect(job.state).toBe('queued');

      // Run job
      const completed = await jobService.runJob(job.id);
      expect(completed.state).toBe('succeeded');
      expect(completed.progressPercent).toBe(100);
      expect(completed.artifacts).toContain('art-1');
      expect(completed.artifacts).toContain('art-2');

      // Tenant isolation on getJob
      expect(jobService.getJob(job.id, { userId: 'user-bob', isAdmin: false })).toBeUndefined();
      expect(jobService.getJob(job.id, { userId: 'user-bob', isAdmin: true })).toBeDefined();
      expect(jobService.getJob(job.id, { userId: 'user-alice' })).toBeDefined();

      // List jobs filtering
      expect(jobService.listJobs({ capabilityId: 'custom_worker' }).length).toBe(1);
      expect(jobService.listJobs({ ownerId: 'user-alice' }).length).toBe(1);
      expect(jobService.listJobs({ state: 'succeeded' }).length).toBe(1);
      expect(jobService.listJobs({ state: 'failed' }).length).toBe(0);

      // Cancel a queued job
      const job2 = jobService.createJob({
        capabilityId: 'custom_worker',
        packId: 'pack-1',
        ownerId: 'user-alice',
        inputs: { cancelTest: true }
      });
      const cancelled = jobService.cancelJob(job2.id, 'User test cancellation');
      expect(cancelled).toBe(true);
      expect(jobService.getJob(job2.id)?.state).toBe('cancelled');
      expect(jobService.getJob(job2.id)?.failureCategory).toBe('user_cancelled');
    });
  });
});
