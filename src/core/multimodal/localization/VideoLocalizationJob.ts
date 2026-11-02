/**
 * Video Localization Job Contract & Provenance (CF-07)
 *
 * Implements consent-bound video dubbing and localization job contracts,
 * deterministic replay metadata, resource budgets, and synthetic media disclosures.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import { MediaConsentRecord } from './MediaConsentRecord';

export type LocalizationStage =
  | 'preflight'
  | 'validate_media'
  | 'extract_audio'
  | 'separate_vocals'
  | 'transcribe_align'
  | 'review_transcript'
  | 'translate'
  | 'synthesize_voice'
  | 'fit_timing'
  | 'reconstruct_mix'
  | 'lip_sync'
  | 'finalize_export';

export type LocalizationJobStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface LocalizationBudget {
  maxDurationSeconds: number;
  maxResolution: '720p' | '1080p' | '4k';
  maxFileSizeBytes: number;
  maxDiskBytes: number;
  timeoutMs: number;
}

export const DEFAULT_LOCALIZATION_BUDGET: LocalizationBudget = {
  maxDurationSeconds: 600, // 10 minutes
  maxResolution: '1080p',
  maxFileSizeBytes: 200 * 1024 * 1024, // 200MB
  maxDiskBytes: 1024 * 1024 * 1024,    // 1GB
  timeoutMs: 300000                     // 5 minutes
};

export interface SyntheticMediaDisclosure {
  readonly isSynthetic: true;
  readonly notice: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly modelsUsed: {
    stt: string;
    translation: string;
    tts: string;
  };
  readonly generatedAt: string;
}

export interface LocalizationProvenance {
  jobId: string;
  consentId: string;
  sourceFileHash: string;
  sourceLanguage: string;
  targetLanguage: string;
  replaySeed: string;
  configDigest: string;
  providers: {
    stt: string;
    translation: string;
    translationIsLocal: boolean;
    tts: string;
    lipSyncOptional?: string;
  };
  disclosure: SyntheticMediaDisclosure;
  exportedAt?: string;
}

export interface LocalizationStageResult {
  stage: LocalizationStage;
  durationMs: number;
  success: boolean;
  artifacts?: Record<string, string>;
  warnings?: string[];
  error?: string;
}

export interface VideoLocalizationJob {
  readonly jobId: string;
  readonly title: string;
  readonly sourceFilePath: string;
  readonly sourceFileHash: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly consentRecord: MediaConsentRecord;
  readonly voiceSettings: {
    useVoiceCloning: boolean;
    referenceAudioPath?: string;
    targetVoiceId?: string;
    speechRate?: number;
  };
  readonly translationSettings: {
    provider: 'local_offline' | 'google_translate' | 'custom_llm';
    dataEgressWarningAcknowledged: boolean;
  };
  readonly lipSyncEnabled: boolean;
  readonly budget: LocalizationBudget;
  readonly replaySeed: string;
  readonly createdAt: string;
  readonly jobDigest: string;

  status: LocalizationJobStatus;
  currentStage: LocalizationStage;
  stageResults: Partial<Record<LocalizationStage, LocalizationStageResult>>;
  provenance?: LocalizationProvenance;
  outputFilePath?: string;
  error?: string;
}

export interface CreateLocalizationJobOptions {
  jobId?: string;
  title: string;
  sourceFilePath: string;
  sourceFileHash?: string;
  sourceLanguage: string;
  targetLanguage: string;
  consentRecord: MediaConsentRecord;
  voiceSettings?: {
    useVoiceCloning?: boolean;
    referenceAudioPath?: string;
    targetVoiceId?: string;
    speechRate?: number;
  };
  translationSettings?: {
    provider?: 'local_offline' | 'google_translate' | 'custom_llm';
    dataEgressWarningAcknowledged?: boolean;
  };
  lipSyncEnabled?: boolean;
  budget?: Partial<LocalizationBudget>;
  replaySeed?: string;
}

export class LocalizationJobValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalizationJobValidationError';
  }
}

/**
 * Compute the deterministic SHA-256 digest of job parameters
 */
export function computeLocalizationJobDigest(data: {
  jobId: string;
  title: string;
  sourceFilePath: string;
  sourceFileHash: string;
  sourceLanguage: string;
  targetLanguage: string;
  consentDigest: string;
  voiceSettings: Record<string, any>;
  translationSettings: Record<string, any>;
  lipSyncEnabled: boolean;
  budget: LocalizationBudget;
  replaySeed: string;
  createdAt: string;
}): string {
  const normalized = {
    jobId: data.jobId,
    title: data.title,
    sourceFilePath: data.sourceFilePath,
    sourceFileHash: data.sourceFileHash,
    sourceLanguage: data.sourceLanguage,
    targetLanguage: data.targetLanguage,
    consentDigest: data.consentDigest,
    voiceSettings: data.voiceSettings,
    translationSettings: data.translationSettings,
    lipSyncEnabled: data.lipSyncEnabled,
    budget: data.budget,
    replaySeed: data.replaySeed,
    createdAt: data.createdAt
  };

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Create a new VideoLocalizationJob instance with consent verification
 */
export function createVideoLocalizationJob(options: CreateLocalizationJobOptions): VideoLocalizationJob {
  if (!options.sourceFilePath) {
    throw new LocalizationJobValidationError('Source file path is required.');
  }

  if (!options.consentRecord) {
    throw new LocalizationJobValidationError('MediaConsentRecord is mandatory for all localization jobs.');
  }

  const jobId = options.jobId || `locjob-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  if (!/^[A-Za-z0-9._-]+$/.test(jobId)) {
    throw new LocalizationJobValidationError('Job ID may contain only letters, numbers, dots, underscores, and hyphens.');
  }
  if (options.consentRecord.jobId !== jobId) {
    throw new LocalizationJobValidationError(`Consent record '${options.consentRecord.consentId}' is bound to job '${options.consentRecord.jobId}', not '${jobId}'.`);
  }

  const voiceSettings = {
    useVoiceCloning: options.voiceSettings?.useVoiceCloning ?? false,
    referenceAudioPath: options.voiceSettings?.referenceAudioPath,
    targetVoiceId: options.voiceSettings?.targetVoiceId || 'default-voice',
    speechRate: options.voiceSettings?.speechRate ?? 1.0
  };

  if (voiceSettings.useVoiceCloning && !options.consentRecord.voiceCloningAuthorized) {
    throw new LocalizationJobValidationError('Voice cloning requested but not authorized in consent record.');
  }

  const translationSettings = {
    provider: options.translationSettings?.provider ?? 'local_offline',
    dataEgressWarningAcknowledged: options.translationSettings?.dataEgressWarningAcknowledged ?? false
  };

  // If using external provider like google_translate, data egress warning must be acknowledged
  if (translationSettings.provider === 'google_translate' && !translationSettings.dataEgressWarningAcknowledged) {
    throw new LocalizationJobValidationError('External translation provider requires explicit data egress warning acknowledgement.');
  }

  const sourceFileHash = options.sourceFileHash || (fs.existsSync(options.sourceFilePath)
    ? crypto.createHash('sha256').update(fs.readFileSync(options.sourceFilePath)).digest('hex')
    : undefined);
  if (!sourceFileHash || !/^[a-fA-F0-9]{64}$/.test(sourceFileHash)) {
    throw new LocalizationJobValidationError('A verified 64-character SHA-256 sourceFileHash is required when the source file is not locally readable.');
  }
  const replaySeed = options.replaySeed || crypto.randomBytes(8).toString('hex');
  const createdAt = new Date().toISOString();

  const budget: LocalizationBudget = {
    ...DEFAULT_LOCALIZATION_BUDGET,
    ...options.budget
  };

  const jobDigest = computeLocalizationJobDigest({
    jobId,
    title: options.title,
    sourceFilePath: options.sourceFilePath,
    sourceFileHash,
    sourceLanguage: options.sourceLanguage,
    targetLanguage: options.targetLanguage,
    consentDigest: options.consentRecord.consentDigest,
    voiceSettings,
    translationSettings,
    lipSyncEnabled: options.lipSyncEnabled ?? false,
    budget,
    replaySeed,
    createdAt
  });

  return {
    jobId,
    title: options.title,
    sourceFilePath: options.sourceFilePath,
    sourceFileHash,
    sourceLanguage: options.sourceLanguage,
    targetLanguage: options.targetLanguage,
    consentRecord: options.consentRecord,
    voiceSettings,
    translationSettings,
    lipSyncEnabled: options.lipSyncEnabled ?? false,
    budget,
    replaySeed,
    createdAt,
    jobDigest,
    status: 'queued',
    currentStage: 'preflight',
    stageResults: {}
  };
}

/**
 * Verify cryptographic integrity of a VideoLocalizationJob
 */
export function verifyVideoLocalizationJobIntegrity(job: VideoLocalizationJob): boolean {
  const expected = computeLocalizationJobDigest({
    jobId: job.jobId,
    title: job.title,
    sourceFilePath: job.sourceFilePath,
    sourceFileHash: job.sourceFileHash,
    sourceLanguage: job.sourceLanguage,
    targetLanguage: job.targetLanguage,
    consentDigest: job.consentRecord.consentDigest,
    voiceSettings: job.voiceSettings,
    translationSettings: job.translationSettings,
    lipSyncEnabled: job.lipSyncEnabled,
    budget: job.budget,
    replaySeed: job.replaySeed,
    createdAt: job.createdAt
  });

  return expected === job.jobDigest;
}
