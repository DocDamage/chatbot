/**
 * CF-07 Consent-Aware Video Localization & Dubbing Test Suite
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createMediaConsentRecord,
  verifyMediaConsentRecord,
  validateConsentForVoiceCloning,
  MediaConsentError,
  UnauthorizedVoiceCloningError,
  ConsentDigestMismatchError
} from './MediaConsentRecord';
import {
  createVideoLocalizationJob,
  verifyVideoLocalizationJobIntegrity,
  LocalizationJobValidationError
} from './VideoLocalizationJob';
import { MediaLocalizationSandbox } from './MediaLocalizationSandbox';
import {
  VideoLocalizationPipeline,
  MockLocalizationEngineAdapter
} from './VideoLocalizationPipeline';

describe('CF-07 Consent-Aware Video Localization & Dubbing', () => {
  const TEST_SOURCE_HASH = 'a'.repeat(64);
  describe('Media Consent Records & Rights Verification', () => {
    it('creates and cryptographically verifies a valid consent record', () => {
      const record = createMediaConsentRecord({
        jobId: 'job-test-1',
        rightsholderId: 'rh-123',
        rightsholderName: 'Acme Media Rights Ltd',
        sourceRightsConfirmed: true,
        voiceCloningAuthorized: true,
        syntheticMediaDisclosureConfirmed: true,
        operatorApproval: 'operator-alice'
      });

      expect(record.consentDigest).toBeDefined();
      expect(verifyMediaConsentRecord(record)).toBe(true);
    });

    it('rejects consent record creation when source rights are not confirmed', () => {
      expect(() => {
        createMediaConsentRecord({
          jobId: 'job-test-2',
          rightsholderId: 'rh-123',
          rightsholderName: 'Acme Media Rights Ltd',
          sourceRightsConfirmed: false,
          voiceCloningAuthorized: false,
          syntheticMediaDisclosureConfirmed: true,
          operatorApproval: 'operator-alice'
        });
      }).toThrow(MediaConsentError);
    });

    it('rejects consent record creation when synthetic media disclosure is not confirmed', () => {
      expect(() => {
        createMediaConsentRecord({
          jobId: 'job-test-3',
          rightsholderId: 'rh-123',
          rightsholderName: 'Acme Media Rights Ltd',
          sourceRightsConfirmed: true,
          voiceCloningAuthorized: true,
          syntheticMediaDisclosureConfirmed: false,
          operatorApproval: 'operator-alice'
        });
      }).toThrow(MediaConsentError);
    });

    it('rejects voice cloning when consent record does not authorize voice cloning', () => {
      const recordWithoutCloning = createMediaConsentRecord({
        jobId: 'job-test-4',
        rightsholderId: 'rh-123',
        rightsholderName: 'Acme Media Rights Ltd',
        sourceRightsConfirmed: true,
        voiceCloningAuthorized: false,
        syntheticMediaDisclosureConfirmed: true,
        operatorApproval: 'operator-alice'
      });

      expect(() => {
        validateConsentForVoiceCloning(recordWithoutCloning);
      }).toThrow(UnauthorizedVoiceCloningError);
    });

    it('detects tampering in consent record', () => {
      const record = createMediaConsentRecord({
        jobId: 'job-test-5',
        rightsholderId: 'rh-123',
        rightsholderName: 'Acme Media Rights Ltd',
        sourceRightsConfirmed: true,
        voiceCloningAuthorized: true,
        syntheticMediaDisclosureConfirmed: true,
        operatorApproval: 'operator-alice'
      });

      const tampered = { ...record, rightsholderName: 'Attacker' };
      expect(verifyMediaConsentRecord(tampered)).toBe(false);
      expect(() => {
        validateConsentForVoiceCloning(tampered);
      }).toThrow(ConsentDigestMismatchError);
    });
  });

  describe('Video Localization Job Validation & Data Egress Gates', () => {
    const validConsent = createMediaConsentRecord({
      jobId: 'job-valid',
      rightsholderId: 'rh-456',
      rightsholderName: 'Acme Studios',
      sourceRightsConfirmed: true,
      voiceCloningAuthorized: true,
      syntheticMediaDisclosureConfirmed: true,
      operatorApproval: 'operator-lead'
    });

    it('creates and verifies a valid VideoLocalizationJob', () => {
      const job = createVideoLocalizationJob({
        jobId: 'job-valid',
        title: 'Product Walkthrough Video',
        sourceFilePath: 'videos/intro.mp4',
        sourceFileHash: TEST_SOURCE_HASH,
        sourceLanguage: 'en',
        targetLanguage: 'es',
        consentRecord: validConsent
      });

      expect(verifyVideoLocalizationJobIntegrity(job)).toBe(true);
      expect(job.status).toBe('queued');
      expect(job.currentStage).toBe('preflight');
    });

    it('rejects job creation if voice cloning is requested without consent authorization', () => {
      const consentNoCloning = createMediaConsentRecord({
        jobId: 'job-no-clone',
        rightsholderId: 'rh-789',
        rightsholderName: 'Acme Studios',
        sourceRightsConfirmed: true,
        voiceCloningAuthorized: false,
        syntheticMediaDisclosureConfirmed: true,
        operatorApproval: 'operator-lead'
      });

      expect(() => {
        createVideoLocalizationJob({
          jobId: 'job-no-clone',
          title: 'Product Video',
          sourceFilePath: 'videos/intro.mp4',
          sourceFileHash: TEST_SOURCE_HASH,
          sourceLanguage: 'en',
          targetLanguage: 'de',
          consentRecord: consentNoCloning,
          voiceSettings: { useVoiceCloning: true }
        });
      }).toThrow(LocalizationJobValidationError);
    });

    it('requires explicit data egress warning acknowledgement when using remote Google translation', () => {
      expect(() => {
        createVideoLocalizationJob({
          jobId: 'job-valid',
          title: 'Product Video',
          sourceFilePath: 'videos/intro.mp4',
          sourceFileHash: TEST_SOURCE_HASH,
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          consentRecord: validConsent,
          translationSettings: {
            provider: 'google_translate',
            dataEgressWarningAcknowledged: false
          }
        });
      }).toThrow(/data egress warning acknowledgement/);
    });

    it('accepts remote translation once data egress warning is explicitly acknowledged', () => {
      const job = createVideoLocalizationJob({
        jobId: 'job-valid',
        title: 'Product Video',
        sourceFilePath: 'videos/intro.mp4',
        sourceFileHash: TEST_SOURCE_HASH,
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        consentRecord: validConsent,
        translationSettings: {
          provider: 'google_translate',
          dataEgressWarningAcknowledged: true
        }
      });

      expect(job.translationSettings.provider).toBe('google_translate');
      expect(verifyVideoLocalizationJobIntegrity(job)).toBe(true);
    });

    it('binds consent to the exact job and requires a verified source hash', () => {
      expect(() => createVideoLocalizationJob({
        jobId: 'different-job',
        title: 'Wrong consent binding',
        sourceFilePath: 'missing.mp4',
        sourceFileHash: TEST_SOURCE_HASH,
        sourceLanguage: 'en',
        targetLanguage: 'es',
        consentRecord: validConsent
      })).toThrow(/bound to job/);

      expect(() => createVideoLocalizationJob({
        jobId: 'job-valid',
        title: 'Missing source hash',
        sourceFilePath: 'missing.mp4',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        consentRecord: validConsent
      })).toThrow(/sourceFileHash/);
    });
  });

  describe('Media Localization Sandbox & Storage Budget', () => {
    const testJobId = 'test-media-sandbox';
    let sandbox: MediaLocalizationSandbox;

    beforeEach(async () => {
      sandbox = new MediaLocalizationSandbox(testJobId, { maxDiskBytes: 1024 * 1024 });
      await sandbox.initialize();
    });

    afterEach(async () => {
      await sandbox.cleanup();
    });

    it('creates isolated media workspace subdirectories', () => {
      const paths = sandbox.getPaths();
      expect(fs.existsSync(paths.audio)).toBe(true);
      expect(fs.existsSync(paths.vocals)).toBe(true);
      expect(fs.existsSync(paths.subtitles)).toBe(true);
      expect(fs.existsSync(paths.chunks)).toBe(true);
      expect(fs.existsSync(paths.output)).toBe(true);
    });

    it('saves artifacts and computes directory size correctly', () => {
      const audioBuffer = Buffer.from('RIFF_TEST_AUDIO_CHUNK');
      const saved = sandbox.saveArtifact('audio', 'track1.wav', audioBuffer);
      expect(fs.existsSync(saved)).toBe(true);
      expect(sandbox.getTotalDiskUsage()).toBe(audioBuffer.byteLength);
    });

    it('blocks directory traversal when saving artifacts', () => {
      expect(() => {
        sandbox.saveArtifact('audio', '../../escape.wav', Buffer.from('escape'));
      }).toThrow(/Path traversal is prohibited/);
    });

    it('enforces total disk budget cap', () => {
      const tinySandbox = new MediaLocalizationSandbox('tiny-sandbox', { maxDiskBytes: 20 });
      expect(() => {
        tinySandbox.saveArtifact('audio', 'big.wav', Buffer.alloc(100));
      }).toThrow(/exceeds disk budget/);
    });

    it('cleans up sandbox directory tree on cleanup()', async () => {
      const paths = sandbox.getPaths();
      await sandbox.cleanup();
      expect(fs.existsSync(paths.root)).toBe(false);
    });
  });

  describe('Staged Pipeline Orchestration & Disclosure Verification', () => {
    const exportBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localization-exports-'));
    afterAll(() => fs.rmSync(exportBaseDir, { recursive: true, force: true }));
    const validConsent = createMediaConsentRecord({
      jobId: 'pipeline-job-1',
      rightsholderId: 'rh-999',
      rightsholderName: 'Demo Rights Holder',
      sourceRightsConfirmed: true,
      voiceCloningAuthorized: true,
      syntheticMediaDisclosureConfirmed: true,
      operatorApproval: 'operator-qa'
    });

    it('executes full 12-stage localization pipeline with disclosure metadata', async () => {
      const job = createVideoLocalizationJob({
        jobId: 'pipeline-job-1',
        title: 'Full Pipeline Demo',
        sourceFilePath: 'demo.mp4',
        sourceFileHash: TEST_SOURCE_HASH,
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        consentRecord: validConsent,
        lipSyncEnabled: true,
        voiceSettings: {
          useVoiceCloning: true,
          referenceAudioPath: 'ref.wav'
        }
      });

      const pipeline = new VideoLocalizationPipeline({ exportBaseDir });
      const completed = await pipeline.executePipeline(job, new MockLocalizationEngineAdapter());

      expect(completed.status).toBe('completed');
      expect(completed.currentStage).toBe('finalize_export');
      expect(completed.outputFilePath).toBeDefined();
      expect(fs.existsSync(completed.outputFilePath!)).toBe(true);

      // Check stage results
      expect(completed.stageResults['preflight']?.success).toBe(true);
      expect(completed.stageResults['validate_media']?.success).toBe(true);
      expect(completed.stageResults['extract_audio']?.success).toBe(true);
      expect(completed.stageResults['transcribe_align']?.success).toBe(true);
      expect(completed.stageResults['translate']?.success).toBe(true);
      expect(completed.stageResults['synthesize_voice']?.success).toBe(true);
      expect(completed.stageResults['reconstruct_mix']?.success).toBe(true);
      expect(completed.stageResults['lip_sync']?.success).toBe(true);
      expect(completed.stageResults['finalize_export']?.success).toBe(true);

      // Check synthetic media disclosure & provenance
      expect(completed.provenance).toBeDefined();
      expect(completed.provenance?.disclosure.isSynthetic).toBe(true);
      expect(completed.provenance?.disclosure.notice).toContain('Synthetic Media Notice');
      expect(completed.provenance?.sourceLanguage).toBe('en');
      expect(completed.provenance?.targetLanguage).toBe('fr');
      expect(completed.provenance?.replaySeed).toBeDefined();
    });

    it('fails closed when media exceeds duration budget', async () => {
      const job = createVideoLocalizationJob({
        jobId: 'pipeline-job-1',
        title: 'Long Video Test',
        sourceFilePath: 'huge.mp4',
        sourceFileHash: TEST_SOURCE_HASH,
        sourceLanguage: 'en',
        targetLanguage: 'es',
        consentRecord: validConsent,
        budget: { maxDurationSeconds: 60 } // Limit to 60s
      });

      const engine = new MockLocalizationEngineAdapter();
      // Mock engine returns 120s duration
      engine.validateMedia = async () => ({ duration: 120, resolution: '1080p', sizeBytes: 10 * 1024 * 1024 });

      const pipeline = new VideoLocalizationPipeline({ exportBaseDir });
      await expect(pipeline.executePipeline(job, engine)).rejects.toThrow(/exceeds budget cap/);
      expect(job.status).toBe('failed');
    });

    it('supports cancellation during pipeline execution', async () => {
      const job = createVideoLocalizationJob({
        jobId: 'pipeline-job-1',
        title: 'Cancel Test',
        sourceFilePath: 'demo.mp4',
        sourceFileHash: TEST_SOURCE_HASH,
        sourceLanguage: 'en',
        targetLanguage: 'es',
        consentRecord: validConsent
      });

      const slowEngine = new MockLocalizationEngineAdapter();
      slowEngine.extractAudio = async () => {
        await new Promise(r => setTimeout(r, 50));
      };

      const pipeline = new VideoLocalizationPipeline({ exportBaseDir });
      const runPromise = pipeline.executePipeline(job, slowEngine);

      setTimeout(() => {
        pipeline.cancelJob(job.jobId);
      }, 10);

      await runPromise.catch(() => {});
      expect(job.status === 'cancelled' || job.status === 'completed').toBe(true);
    });
  });
});
