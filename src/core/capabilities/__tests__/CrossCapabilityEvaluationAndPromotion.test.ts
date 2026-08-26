import { CapabilityEvaluationRegistry } from '../evaluation/CapabilityEvaluationRegistry';
import { ContextRepositoryCertificationSuite } from '../evaluation/ContextRepositoryCertificationSuite';
import { MemoryAgentCertificationSuite } from '../evaluation/MemoryAgentCertificationSuite';
import { LocalModelCertificationSuite } from '../evaluation/LocalModelCertificationSuite';
import { GameAssetCertificationSuite } from '../evaluation/GameAssetCertificationSuite';
import { MediaVoiceCertificationSuite } from '../evaluation/MediaVoiceCertificationSuite';
import { WritingStudyWebCertificationSuite } from '../evaluation/WritingStudyWebCertificationSuite';
import { CrossCapabilityScenarioCertification } from '../evaluation/CrossCapabilityScenarioCertification';
import { CleanMachineDeviceCertification } from '../evaluation/CleanMachineDeviceCertification';
import { ManualAccessibilityCertification } from '../evaluation/ManualAccessibilityCertification';
import { LicenseSbomCertification } from '../evaluation/LicenseSbomCertification';
import { CrossCapabilityPromotionLedger } from '../promotion/CrossCapabilityPromotionLedger';

describe('Phase PX-21: Evaluation, Cross-Capability Certification, and Promotion', () => {
  describe('PX21-T01: CapabilityEvaluationRegistry', () => {
    it('registers evaluation declarations across capabilities with required thresholds', () => {
      const registry = CapabilityEvaluationRegistry.getInstance();
      const evals = registry.list();
      expect(evals.length).toBeGreaterThanOrEqual(7);

      const contextEval = registry.get('eval-context-reversible');
      expect(contextEval?.requiredThreshold).toBe(0.98);
      expect(contextEval?.unsupportedClaims.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PX21-T02: ContextRepositoryCertificationSuite', () => {
    it('fails closed until exact-commit context and repository evidence is supplied', async () => {
      const suite = ContextRepositoryCertificationSuite.getInstance();
      const result = await suite.runCertification();
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.checks.length).toBe(3);
    });
  });

  describe('PX21-T03: MemoryAgentCertificationSuite', () => {
    it('fails closed until memory and agent runtime evidence is supplied', async () => {
      const suite = MemoryAgentCertificationSuite.getInstance();
      const result = await suite.runCertification();
      expect(result.passed).toBe(false);
      expect(result.checks.length).toBe(2);
    });
  });

  describe('PX21-T04: LocalModelCertificationSuite', () => {
    it('fails closed until real local-provider and hardware evidence is supplied', async () => {
      const suite = LocalModelCertificationSuite.getInstance();
      const result = await suite.runCertification();
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe('PX21-T05: GameAssetCertificationSuite', () => {
    it('fails closed until real-editor and asset evidence is supplied', async () => {
      const suite = GameAssetCertificationSuite.getInstance();
      const result = await suite.runCertification();
      expect(result.passed).toBe(false);
    });
  });

  describe('PX21-T06: MediaVoiceCertificationSuite', () => {
    it('fails closed until real media worker and device evidence is supplied', async () => {
      const suite = MediaVoiceCertificationSuite.getInstance();
      const result = await suite.runCertification();
      expect(result.passed).toBe(false);
    });
  });

  describe('PX21-T07: WritingStudyWebCertificationSuite', () => {
    it('fails closed until browser and fixture evidence is supplied', async () => {
      const suite = WritingStudyWebCertificationSuite.getInstance();
      const result = await suite.runCertification();
      expect(result.passed).toBe(false);
    });
  });

  describe('PX21-T08: CrossCapabilityScenarioCertification', () => {
    it('does not invent successful cross-capability scenario evidence', async () => {
      const suite = CrossCapabilityScenarioCertification.getInstance();
      const result = await suite.runAllScenarios();
      expect(result.passed).toBe(false);
      expect(result.totalScenarios).toBe(8);
      expect(result.passedScenarios).toBe(0);
      expect(result.overallDigest).toBeDefined();

      for (const sc of result.scenarios) {
        expect(sc.permissionBoundariesVerified).toBe(false);
        expect(sc.artifactLineagePreserved).toBe(false);
      }
    });
  });

  describe('PX21-T09: CleanMachineDeviceCertification', () => {
    it('requires external clean-machine evidence', async () => {
      const suite = CleanMachineDeviceCertification.getInstance();
      const result = await suite.runCertification();
      expect(result.passed).toBe(false);
      expect(result.totalChecks).toBeGreaterThanOrEqual(5);
    });
  });

  describe('PX21-T10: ManualAccessibilityCertification', () => {
    it('requires signed manual accessibility evidence', () => {
      const suite = ManualAccessibilityCertification.getInstance();
      const result = suite.getCertificationResults();
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.checks.length).toBe(5);
    });
  });

  describe('PX21-T11: LicenseSbomCertification', () => {
    it('fails closed without an actual SBOM and clean-room evidence', () => {
      const suite = LicenseSbomCertification.getInstance();
      const report = suite.generateCertificationReport();
      expect(report.passed).toBe(false);
      expect(report.blockedLicensesDetected.length).toBe(0);
      expect(report.cleanRoomDeclarationsVerified).toBe(false);
      expect(report.sbomComponents).toHaveLength(0);
    });
  });

  describe('PX21-T12: CrossCapabilityPromotionLedger', () => {
    it('records only explicit promotion records with exact commits and evidence', () => {
      const ledger = CrossCapabilityPromotionLedger.getInstance();
      const decisions = ledger.listDecisions();
      expect(decisions).toHaveLength(0);

      expect(() => ledger.recordDecision({
        recordId: 'invalid', capabilityId: 'invalid', capabilityName: 'Invalid',
        maturity: 'PRODUCTION_PREVIEW', sourceCommit: 'f892a10b987c', evaluationRunId: 'eval',
        supportedProfiles: ['local'], supportedPlatforms: ['win32'], knownLimitations: [],
        rollbackCondition: 'rollback', owner: 'owner', reviewDate: '2026-08-25', nextScheduledReview: '2026-11-25'
      })).toThrow(/40-character Git commit/i);

      const newRecord = ledger.recordDecision({
        recordId: 'promo-rec-web-studio',
        capabilityId: 'web_studio',
        capabilityName: 'Web Studio',
        maturity: 'PRODUCTION_PREVIEW',
        sourceCommit: 'f892a10b987c0000000000000000000000000000',
        evaluationRunId: 'eval-run-px21-005',
        supportedProfiles: ['local', 'hosted'],
        supportedPlatforms: ['win32', 'linux', 'darwin'],
        knownLimitations: ['Sandbox iframe restricted from direct host network probing'],
        rollbackCondition: 'Rollback if iframe breakout occurs',
        owner: 'Web Studio Team (@web-ops)',
        reviewDate: '2026-08-25',
        nextScheduledReview: '2026-11-25'
      });

      expect(newRecord.sha256Digest).toBeDefined();
      expect(ledger.getDecision('web_studio')?.maturity).toBe('PRODUCTION_PREVIEW');
    });
  });
});
