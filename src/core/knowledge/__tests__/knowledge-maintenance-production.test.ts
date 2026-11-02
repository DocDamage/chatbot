/**
 * Phase 26 Integration Suite: Automated Knowledge Maintenance and Production Hardening
 *
 * Verifies CRK-P26-T01 through T09 and the Phase 26 exit gate requirements.
 */

import { DatasetRefreshScheduler } from '../DatasetRefreshScheduler';
import { IncrementalUpdateService } from '../IncrementalUpdateService';
import { AtomicDatasetActivation } from '../AtomicDatasetActivation';
import { JobRecoveryService } from '../JobRecoveryService';
import { ReembeddingMigrationService } from '../ReembeddingMigrationService';
import { DatasetBackupPolicy } from '../DatasetBackupPolicy';
import { KnowledgeMaintenanceMetrics } from '../KnowledgeMaintenanceMetrics';
import { ReleaseCutoverOrchestrator } from '../../chat/ReleaseCutoverOrchestrator';
import { LegacyOrchestratorDeprecation } from '../../chat/LegacyOrchestratorDeprecation';
import { ChatRuntime } from '../../chat/ChatRuntime';
import { NormalizedChatRequest } from '../../../types/chat-runtime';

describe('Phase 26: Knowledge Maintenance and Production Hardening', () => {
  describe('CRK-P26-T01: Refresh Scheduler', () => {
    it('evaluates staleness and prioritizes overdue datasets by dependency order', () => {
      const scheduler = new DatasetRefreshScheduler();
      const now = Date.now();

      // Mark official docs refreshed 2 days ago (policy interval is 1 day)
      scheduler.markRefreshed('official-docs-ts', now - 2 * 24 * 60 * 60 * 1000);
      // Mark dev QA refreshed 10 minutes ago
      scheduler.markRefreshed('developer-qa-so', now - 10 * 60 * 1000);

      const candidates = scheduler.evaluateStaleness(now);
      const staleDocs = candidates.find((c) => c.datasetId === 'official-docs-ts');
      const freshQA = candidates.find((c) => c.datasetId === 'developer-qa-so');

      expect(staleDocs?.isStale).toBe(true);
      expect(freshQA?.isStale).toBe(false);

      const order = scheduler.getExecutionOrder(['developer-qa-so', 'official-docs-ts']);
      expect(order).toContain('official-docs-ts');
      expect(order).toContain('developer-qa-so');
    });
  });

  describe('CRK-P26-T02: Incremental Update Algorithm', () => {
    it('replaces only changed records and reuses existing chunks without re-embedding', () => {
      const updater = new IncrementalUpdateService();
      const existing = new Map();
      existing.set('doc-1', { id: 'doc-1', contentHash: 'hash-abc', chunkIds: ['c1', 'c2'] });

      const upstream = [
        { id: 'doc-1', contentHash: 'hash-abc', rawText: 'Unchanged content', license: 'MIT' },
        { id: 'doc-2', contentHash: 'hash-xyz', rawText: 'Brand new guide text here', license: 'MIT' },
      ];

      const result = updater.performIncrementalUpdate({
        datasetId: 'official-docs-ts',
        currentVersion: 'v1.0.0',
        newVersion: 'v1.1.0',
        upstreamRecords: upstream,
        existingRecords: existing,
      });

      expect(result.reusedRecords).toBe(1);
      expect(result.changedRecords).toBe(1);
      expect(result.reusedChunks).toBe(2);
      expect(result.embeddedChunks).toBeGreaterThan(0);
      expect(result.rollbackMetadataPreserved).toBe(true);
    });
  });

  describe('CRK-P26-T03: Atomic Dataset Activation', () => {
    it('prevents queries during non-READY states and executes atomic activation and rollback', () => {
      const activator = new AtomicDatasetActivation();
      activator.registerNewVersion('official-docs-ts', 'v1.0.0');

      // DOWNLOADING status is not queryable
      expect(activator.getActiveVersion('official-docs-ts')).toBeUndefined();

      activator.transitionState('official-docs-ts', 'v1.0.0', 'NORMALIZING');
      activator.transitionState('official-docs-ts', 'v1.0.0', 'INDEXING');
      activator.transitionState('official-docs-ts', 'v1.0.0', 'VERIFYING');

      // Activate v1.0.0
      activator.activateVersion('official-docs-ts', 'v1.0.0');
      expect(activator.getActiveVersion('official-docs-ts')).toBe('v1.0.0');

      // Now stage v1.1.0
      activator.registerNewVersion('official-docs-ts', 'v1.1.0');
      activator.transitionState('official-docs-ts', 'v1.1.0', 'VERIFYING');
      activator.activateVersion('official-docs-ts', 'v1.1.0');
      expect(activator.getActiveVersion('official-docs-ts')).toBe('v1.1.0');

      // Old version should be retired
      const oldState = activator.getVersionState('official-docs-ts', 'v1.0.0');
      expect(oldState?.status).toBe('RETIRED');

      // Perform rollback to v1.0.0
      activator.rollbackVersion('official-docs-ts', 'v1.0.0');
      expect(activator.getActiveVersion('official-docs-ts')).toBe('v1.0.0');
    });
  });

  describe('CRK-P26-T04: Interrupted Job Recovery', () => {
    it('detects stale running jobs, resumes from checkpoints, or cleans abandoned temp files', () => {
      const recovery = new JobRecoveryService(10 * 60 * 1000);
      const now = Date.now();

      const staleJob = {
        jobId: 'job-stale-1',
        datasetId: 'developer-qa-so',
        phase: 'INDEXING' as const,
        startedAt: now - 20 * 60 * 1000,
        lastCheckpoint: 'chk-5000',
        tempArtifactPaths: ['/tmp/stage1.bin', '/tmp/stage2.bin'],
      };

      const found = recovery.findStaleJobs([staleJob], now);
      expect(found).toHaveLength(1);

      const action = recovery.recoverJob(staleJob);
      expect(action.actionTaken).toBe('RESUMED_FROM_CHECKPOINT');
      expect(action.cleanedArtifactCount).toBe(2);
    });
  });

  describe('CRK-P26-T05: Re-embedding Migration Service', () => {
    it('plans non-destructive dual-index migration, validates retrieval, and commits pointer', () => {
      const migrator = new ReembeddingMigrationService();
      const plan = migrator.createMigrationPlan({
        datasetId: 'wikidata-core',
        sourceEmbedding: {
          provider: 'local-transformer',
          model: 'bge-small-en-v1.5',
          dimensions: 384,
          normalization: 'cosine',
          createdAt: 1700000000,
          version: 'v1.0.0',
        },
        targetEmbedding: {
          provider: 'local-transformer',
          model: 'bge-base-en-v1.5',
          dimensions: 768,
          normalization: 'cosine',
          createdAt: 1705000000,
          version: 'v2.0.0',
        },
        totalChunks: 5000,
      });

      expect(plan.status).toBe('EMBEDDING_PARALLEL');
      expect(plan.activeVersion).toBe('v1.0.0');

      const validated = migrator.validateRetrieval(plan.migrationId, {
        passed: true,
        score: 0.94,
        threshold: 0.85,
        sampleQueriesEvaluated: 100,
      });
      expect(validated).toBe(true);

      migrator.commitMigration(plan.migrationId);
      const updated = migrator.getPlan(plan.migrationId);
      expect(updated?.status).toBe('COMMITTED');
      expect(updated?.activeVersion).toBe('v2.0.0');
    });
  });

  describe('CRK-P26-T06: Dataset Backup Policy', () => {
    it('classifies custom/curated data for mandatory backup and reproducible caches for RTO', () => {
      const backup = new DatasetBackupPolicy();
      const mandatory = backup.getMandatoryBackupDatasets();
      const ids = mandatory.map((m) => m.datasetId);

      expect(ids).toContain('curated-local-docs');
      expect(ids).toContain('user-custom-packs');
      expect(ids).not.toContain('official-docs-ts');

      const localClassification = backup.classify('CURATED_LOCAL');
      expect(localClassification.requiresColdStorage).toBe(true);
      expect(localClassification.canRegenerateFromSource).toBe(false);

      const cacheClassification = backup.classify('REPRODUCIBLE_CACHE');
      expect(cacheClassification.requiresColdStorage).toBe(false);
      expect(cacheClassification.canRegenerateFromSource).toBe(true);
    });
  });

  describe('CRK-P26-T07: Maintenance Metrics and Alerts', () => {
    it('tracks metrics and emits alerts for repeated failures, disk thresholds, and drops', () => {
      const metrics = new KnowledgeMaintenanceMetrics();

      // Record 3 consecutive failures
      for (let i = 0; i < 3; i++) {
        metrics.recordJob({
          jobId: `j-${i}`,
          datasetId: 'dev-qa',
          status: 'FAILED',
          downloadBytes: 0,
          chunksIndexed: 0,
          durationMs: 120,
          duplicateCount: 0,
          timestamp: Date.now(),
        });
      }

      // Check disk threshold
      metrics.checkDiskThreshold(90, 8);
      // Check source count anomaly
      metrics.checkSourceCountAnomaly('dev-qa', 1000, 700);

      const alerts = metrics.getAlerts();
      const failureAlert = alerts.find((a) => a.code === 'REPEATED_REFRESH_FAILURE');
      const diskAlert = alerts.find((a) => a.code === 'DISK_THRESHOLD_EXCEEDED');
      const dropAlert = alerts.find((a) => a.code === 'ABNORMAL_SOURCE_COUNT_DROP');

      expect(failureAlert).toBeDefined();
      expect(diskAlert).toBeDefined();
      expect(dropAlert).toBeDefined();

      const summary = metrics.computeMetrics(2, 90, 8);
      expect(summary.totalJobsExecuted).toBe(3);
      expect(summary.failedJobs).toBe(3);
    });
  });

  describe('CRK-P26-T08 & T09: Release Cutover & Legacy Deprecation', () => {
    it('blocks cutover until all steps pass, enables canonical runtime default, and routes via shim', async () => {
      const cutover = new ReleaseCutoverOrchestrator();
      expect(cutover.evaluateCutoverDecision().canCutover).toBe(false);

      // Pass all prerequisite gates
      cutover.updateStep('shadowComparisonPassed', true);
      cutover.updateStep('goldenSuitePassed', true);
      cutover.updateStep('defaultPackAbEvidenceRecorded', true);
      cutover.updateStep('databaseMigrationsVerified', true);
      cutover.updateStep('rollbackFlagTested', true);
      cutover.updateStep('stagingGatePassed', true);
      cutover.updateStep('canaryUserBetaPassed', true);
      cutover.updateStep('diagnosticsInspected', true);

      const ready = cutover.evaluateCutoverDecision();
      expect(ready.canCutover).toBe(true);

      cutover.executeCutover();
      expect(cutover.getChecklist().canonicalRuntimeEnabledDefault).toBe(true);

      // Verify legacy deprecation delegate
      const mockRuntime = {
        execute: jest.fn().mockResolvedValue({
          requestId: 'req-cutover-1',
          response: 'Response from Canonical Runtime',
          model: {
            provider: 'openai',
            model: 'gpt-4o',
            policy: 'general-chat',
            fallbackUsed: false,
          },
          citations: [],
          toolResults: [],
          warnings: [],
          latencyMs: 120,
          traceId: 'trace-1',
          grounding: { attempted: true, sufficient: true, confidence: 0.95 },
        }),
      } as unknown as ChatRuntime;

      const deprecationWrapper = new LegacyOrchestratorDeprecation(mockRuntime);
      const req: NormalizedChatRequest = {
        requestId: 'req-cutover-1',
        sessionId: 'sess-1',
        message: 'test query',
        botProfileId: 'default',
        loadedFiles: [],
        loadedAudio: [],
        clientCapabilities: { streaming: false, citations: false, toolApproval: false },
        metadata: { origin: 'legacy-api' },
      };

      const result = await deprecationWrapper.dispatchLegacyRequest(req, 'legacy-client');
      expect(result.response).toBe('Response from Canonical Runtime');
      expect(deprecationWrapper.getDeprecationTelemetry().invocations).toBe(1);
      expect(deprecationWrapper.getDeprecationTelemetry().deprecatedPathsRouted).toContain('legacy-client');
    });
  });
});
