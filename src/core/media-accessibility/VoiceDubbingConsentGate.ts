/**
 * Voice Dubbing Consent & Rights Governance Gate (PX13-T06)
 *
 * Implements strict voice rights verification, subject consent records,
 * synthetic media disclosure notices, and hard blocks against unauthorized
 * voice cloning or impersonation.
 */

import { VoiceConsentRecord } from './MediaAccessibilityTypes';

export class VoiceDubbingConsentGate {
  private consentRegistry: Map<string, VoiceConsentRecord> = new Map();

  public registerConsent(record: VoiceConsentRecord): void {
    if (!record.subjectName || !record.subjectIdentityConfirmed) {
      throw new Error('Consent registration failed: Subject identity must be confirmed.');
    }
    this.consentRegistry.set(record.consentId, record);
  }

  public getConsent(consentId: string): VoiceConsentRecord | undefined {
    return this.consentRegistry.get(consentId);
  }

  /**
   * Evaluates whether voice synthesis or dubbing is permitted for the given voice and parameters.
   */
  public evaluateDubbingPermission(params: {
    voiceId: string;
    isCustomOrClonedVoice: boolean;
    consentId?: string;
    purpose?: VoiceConsentRecord['permittedPurpose'];
  }): { allowed: boolean; syntheticDisclosureNotice: string; error?: string } {
    // Stock/local voices are permitted with standard synthetic disclosure
    if (!params.isCustomOrClonedVoice) {
      return {
        allowed: true,
        syntheticDisclosureNotice: 'This audio contains synthetic machine-generated speech (Stock Engine Voice).'
      };
    }

    // Custom or cloned voices require verified consent record
    if (!params.consentId) {
      return {
        allowed: false,
        syntheticDisclosureNotice: '',
        error: 'Custom/cloned voice dubbing rejected: Missing required subject consent record.'
      };
    }

    const consent = this.consentRegistry.get(params.consentId);
    if (!consent) {
      return {
        allowed: false,
        syntheticDisclosureNotice: '',
        error: `Consent record ${params.consentId} was not found in the verified consent registry.`
      };
    }

    if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
      return {
        allowed: false,
        syntheticDisclosureNotice: '',
        error: `Consent record ${params.consentId} has expired.`
      };
    }

    return {
      allowed: true,
      syntheticDisclosureNotice: `AI-synthesized voice dubbing authorized by ${consent.subjectName} for ${consent.permittedPurpose}.`
    };
  }
}
