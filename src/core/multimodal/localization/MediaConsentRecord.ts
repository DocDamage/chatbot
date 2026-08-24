/**
 * Media Consent Record & Rights Verification (CF-07)
 *
 * Enforces consent, copyright/source-rights confirmation, and voice-cloning restrictions.
 * Stores legal and verification attestations without retaining unnecessary biometric data.
 */

import * as crypto from 'crypto';

export interface MediaConsentRecord {
  readonly consentId: string;
  readonly jobId: string;
  readonly rightsholderId: string;
  readonly rightsholderName: string;
  readonly sourceRightsConfirmed: boolean;
  readonly voiceCloningAuthorized: boolean;
  readonly syntheticMediaDisclosureConfirmed: boolean;
  readonly dataRetentionDays: number;
  readonly operatorApproval: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly consentDigest: string;
}

export interface CreateConsentRecordOptions {
  consentId?: string;
  jobId: string;
  rightsholderId: string;
  rightsholderName: string;
  sourceRightsConfirmed: boolean;
  voiceCloningAuthorized: boolean;
  syntheticMediaDisclosureConfirmed: boolean;
  dataRetentionDays?: number;
  operatorApproval: string;
  ttlDays?: number;
}

export class MediaConsentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaConsentError';
  }
}

export class UnauthorizedVoiceCloningError extends MediaConsentError {
  constructor(rightsholderId: string) {
    super(`Voice cloning and reference-voice synthesis are strictly prohibited without verified rightsholder authorization (Rightsholder ID: '${rightsholderId}').`);
    this.name = 'UnauthorizedVoiceCloningError';
  }
}

export class ConsentDigestMismatchError extends MediaConsentError {
  constructor(consentId: string) {
    super(`Cryptographic consent digest mismatch for record '${consentId}'. Attestation may have been modified.`);
    this.name = 'ConsentDigestMismatchError';
  }
}

/**
 * Deterministically compute the SHA-256 digest of a MediaConsentRecord
 */
export function computeConsentDigest(data: {
  consentId: string;
  jobId: string;
  rightsholderId: string;
  rightsholderName: string;
  sourceRightsConfirmed: boolean;
  voiceCloningAuthorized: boolean;
  syntheticMediaDisclosureConfirmed: boolean;
  dataRetentionDays: number;
  operatorApproval: string;
  createdAt: string;
  expiresAt: string;
}): string {
  const normalized = {
    consentId: data.consentId,
    jobId: data.jobId,
    rightsholderId: data.rightsholderId,
    rightsholderName: data.rightsholderName,
    sourceRightsConfirmed: data.sourceRightsConfirmed,
    voiceCloningAuthorized: data.voiceCloningAuthorized,
    syntheticMediaDisclosureConfirmed: data.syntheticMediaDisclosureConfirmed,
    dataRetentionDays: data.dataRetentionDays,
    operatorApproval: data.operatorApproval,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt
  };

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Create a new verified MediaConsentRecord
 */
export function createMediaConsentRecord(options: CreateConsentRecordOptions): MediaConsentRecord {
  if (!/^[A-Za-z0-9._-]+$/.test(options.jobId)) {
    throw new MediaConsentError('Job ID may contain only letters, numbers, dots, underscores, and hyphens.');
  }
  if (!options.sourceRightsConfirmed) {
    throw new MediaConsentError('Source rights and copyright permissions must be explicitly confirmed.');
  }

  if (!options.syntheticMediaDisclosureConfirmed) {
    throw new MediaConsentError('Synthetic media disclosure confirmation is mandatory for media localization jobs.');
  }

  if (!options.operatorApproval || options.operatorApproval.trim() === '') {
    throw new MediaConsentError('Operator approval signoff is required.');
  }

  const consentId = options.consentId || `consent-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const createdAt = new Date().toISOString();
  const ttlDays = options.ttlDays ?? 30;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  const dataRetentionDays = options.dataRetentionDays ?? Math.min(ttlDays, 30);

  const consentDigest = computeConsentDigest({
    consentId,
    jobId: options.jobId,
    rightsholderId: options.rightsholderId,
    rightsholderName: options.rightsholderName,
    sourceRightsConfirmed: options.sourceRightsConfirmed,
    voiceCloningAuthorized: options.voiceCloningAuthorized,
    syntheticMediaDisclosureConfirmed: options.syntheticMediaDisclosureConfirmed,
    dataRetentionDays,
    operatorApproval: options.operatorApproval,
    createdAt,
    expiresAt
  });

  return {
    consentId,
    jobId: options.jobId,
    rightsholderId: options.rightsholderId,
    rightsholderName: options.rightsholderName,
    sourceRightsConfirmed: options.sourceRightsConfirmed,
    voiceCloningAuthorized: options.voiceCloningAuthorized,
    syntheticMediaDisclosureConfirmed: options.syntheticMediaDisclosureConfirmed,
    dataRetentionDays,
    operatorApproval: options.operatorApproval,
    createdAt,
    expiresAt,
    consentDigest
  };
}

/**
 * Verify cryptographic validity and expiration of a MediaConsentRecord
 */
export function verifyMediaConsentRecord(record: MediaConsentRecord): boolean {
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    return false;
  }

  const expected = computeConsentDigest({
    consentId: record.consentId,
    jobId: record.jobId,
    rightsholderId: record.rightsholderId,
    rightsholderName: record.rightsholderName,
    sourceRightsConfirmed: record.sourceRightsConfirmed,
    voiceCloningAuthorized: record.voiceCloningAuthorized,
    syntheticMediaDisclosureConfirmed: record.syntheticMediaDisclosureConfirmed,
    dataRetentionDays: record.dataRetentionDays,
    operatorApproval: record.operatorApproval,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt
  });

  return expected === record.consentDigest;
}

/**
 * Validate that voice cloning is explicitly authorized and consent is active
 */
export function validateConsentForVoiceCloning(record?: MediaConsentRecord): void {
  if (!record) {
    throw new MediaConsentError('MediaConsentRecord is missing. Voice synthesis requires verified consent.');
  }

  if (!verifyMediaConsentRecord(record)) {
    throw new ConsentDigestMismatchError(record.consentId);
  }

  if (!record.voiceCloningAuthorized) {
    throw new UnauthorizedVoiceCloningError(record.rightsholderId);
  }
}
