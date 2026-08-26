import { ReleaseTrainManifestBuilder } from '../release/ReleaseTrainManifestBuilder';
import { ProtocolVersionMatrix } from '../release/ProtocolVersionMatrix';
import { ReleaseArtifactBuilder } from '../release/ReleaseArtifactBuilder';
import { ControlledRolloutManager } from '../release/ControlledRolloutManager';
import { PostDeployValidationSuite } from '../release/PostDeployValidationSuite';
import { CapabilityMaintenanceScanner } from '../maintenance/CapabilityMaintenanceScanner';
import { EvaluationMaintenanceService } from '../maintenance/EvaluationMaintenanceService';
import { OperationalDrillsCoordinator } from '../maintenance/OperationalDrillsCoordinator';
import { CapabilityDeprecationManager } from '../maintenance/CapabilityDeprecationManager';

describe('Phase PX-22: Release Trains, Controlled Rollout, and Maintenance Baseline', () => {
  describe('PX22-T01: ReleaseTrainManifestBuilder', () => {
    it('builds release manifest with exact capability entries, profiles, and digests', () => {
      const builder = ReleaseTrainManifestBuilder.getInstance();
      expect(() => builder.buildManifest('f892a10b987c')).toThrow('40-character');
      const manifest = builder.buildManifest('f892a10b987c0000000000000000000000000000', [{
        capabilityId: 'context_economy',
        version: '1.0.0',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        profiles: ['local', 'hosted'],
        platforms: ['win32', 'linux', 'darwin'],
        includedAdapters: ['JsonShapeCompressor'],
        optionalDependencies: [],
        dbMigrations: [],
        externalBinariesNotBundled: [],
        featureFlagKey: 'enable_context_economy',
        defaultEnabled: false,
        knownLimitations: ['Certification pending']
      }]);

      expect(manifest.releaseVersion).toBe('1.0.0');
      expect(manifest.gitCommitSha).toHaveLength(40);
      expect(manifest.capabilities).toHaveLength(1);
      expect(manifest.totalSupportedCapabilities).toBe(0);
      expect(manifest.sha256Digest).toBeDefined();
    });
  });

  describe('PX22-T02: ProtocolVersionMatrix', () => {
    it('maintains independent version specifications and compatibility windows', () => {
      const matrix = ProtocolVersionMatrix.getInstance();
      const specs = matrix.listSpecs();
      expect(specs.length).toBeGreaterThanOrEqual(7);

      expect(matrix.isVersionCompatible('core_app', '1.0.0')).toBe(true);
      expect(matrix.isVersionCompatible('core_app', '0.5.0')).toBe(false);
      expect(matrix.isVersionCompatible('job_event_protocol', '0.9.0')).toBe(false); // deprecated
    });
  });

  describe('PX22-T03: ReleaseArtifactBuilder', () => {
    it('does not invent release artifacts, checksums, signatures, or an SBOM', () => {
      const builder = ReleaseArtifactBuilder.getInstance();
      const pkg = builder.generateReleasePackage('1.0.0');

      expect(pkg.version).toBe('1.0.0');
      expect(pkg.artifacts).toHaveLength(0);
      expect(pkg.certificationEligible).toBe(false);
      expect(pkg.overallDigest).toBeDefined();

      expect(pkg.releaseNotesSummary).toContain('draft');
    });
  });

  describe('PX22-T04: ControlledRolloutManager', () => {
    it('advances capabilities across 6 progressive rollout stages', () => {
      const manager = ControlledRolloutManager.getInstance();
      const state = manager.getOrCreateRolloutState('context_economy');
      expect(state.currentStage).toBe('internal_dev');

      const skipped = manager.advanceStage('context_economy', 'staging', 'evidence://staging');
      expect(skipped.success).toBe(false);
      const adv1 = manager.advanceStage('context_economy', 'clean_machine_local', 'evidence://clean-machine');
      expect(adv1.success).toBe(true);
      expect(adv1.state.rolloutPercentage).toBe(5);

      for (const stage of ['staging', 'opt_in_preview', 'broader_preview', 'production_supported'] as const) {
        expect(manager.advanceStage('context_economy', stage, `evidence://${stage}`).success).toBe(true);
      }
      expect(manager.getOrCreateRolloutState('context_economy').rolloutPercentage).toBe(100);
    });

    it('triggers immediate rollback to 0% traffic on critical incident', () => {
      const manager = ControlledRolloutManager.getInstance();
      const state = manager.triggerRollback('context_economy', 'security_violation', 'Boundary escape detected');

      expect(state.isRollbackActive).toBe(true);
      expect(state.currentStage).toBe('internal_dev');
      expect(state.rolloutPercentage).toBe(0);

      // Advancing while rollback is active is rejected
      const adv = manager.advanceStage('context_economy', 'staging');
      expect(adv.success).toBe(false);
      expect(adv.error).toContain('Cannot advance rollout while an active rollback trigger is unresolved');
    });
  });

  describe('PX22-T05: PostDeployValidationSuite', () => {
    it('fails closed without post-deploy probe evidence', async () => {
      const suite = PostDeployValidationSuite.getInstance();
      const report = await suite.runValidation('production');

      expect(report.passed).toBe(false);
      expect(report.totalChecks).toBeGreaterThanOrEqual(5);
      expect(report.passedChecks).toBe(0);
      expect(report.overallDigest).toBeDefined();
    });
  });

  describe('PX22-T06: CapabilityMaintenanceScanner', () => {
    it('fails closed until security, license, SBOM, provenance, and canary evidence exists', () => {
      const scanner = CapabilityMaintenanceScanner.getInstance();
      const report = scanner.runPreReleaseScan();

      expect(report.passed).toBe(false);
      expect(report.criticalCount).toBe(5);
    });
  });

  describe('PX22-T07: EvaluationMaintenanceService', () => {
    it('records version score history and detects performance/accuracy drift', () => {
      const service = EvaluationMaintenanceService.getInstance();
      service.recordVersionScore('mrr_retrieval_score', 'v0.9.0', 0.98);
      service.recordVersionScore('mrr_retrieval_score', 'v1.0.0', 0.99);

      const noDrift = service.detectDrift('mrr_retrieval_score', 0.985);
      expect(noDrift.hasDrift).toBe(false);

      const drift = service.detectDrift('mrr_retrieval_score', 0.85); // >5% drop
      expect(drift.hasDrift).toBe(true);
      expect(drift.deltaPercent).toBeLessThan(-5.0);
    });
  });

  describe('PX22-T08: OperationalDrillsCoordinator', () => {
    it('does not claim quarterly drills passed without external evidence', () => {
      const coordinator = OperationalDrillsCoordinator.getInstance();
      const drills = coordinator.runAllQuarterlyDrills('2026-Q3');

      expect(drills.length).toBe(9);
      for (const d of drills) {
        expect(d.passed).toBe(false);
        expect(d.evidenceReference).toBe('NOT_RUN');
        expect(d.sha256Digest).toBeDefined();
      }

      expect(coordinator.getDrillHistory().length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('PX22-T09: CapabilityDeprecationManager', () => {
    it('schedules deprecation with notice, export path guidance, and retention policy', () => {
      const manager = CapabilityDeprecationManager.getInstance();
      const notice = manager.scheduleDeprecation({
        capabilityId: 'legacy_custom_model_v1',
        reason: 'Upstream vendor endpoint permanently decommissioned',
        noticePeriodDays: 60,
        hardRemovalPeriodDays: 120,
        exportPathGuidance: 'Use /api/export/models to archive presets',
        migrationAlternative: 'local_model_adapter',
        dataRetentionPolicy: 'export_then_purge'
      });

      expect(notice.capabilityId).toBe('legacy_custom_model_v1');
      expect(notice.dataRetentionPolicy).toBe('export_then_purge');
      expect(notice.sha256Digest).toBeDefined();
      expect(manager.getDeprecationNotice('legacy_custom_model_v1')).toBeDefined();
    });
  });
});
