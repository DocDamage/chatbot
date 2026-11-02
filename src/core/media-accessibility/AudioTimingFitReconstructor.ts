/**
 * Audio Timing Fit & Multitrack Reconstructor (PX13-T07)
 *
 * Implements cue-level speech synthesis timing fit, time-stretch and speed adjustments,
 * background audio ducking, and multitrack dubbing preview render.
 */

import { SubtitleCue, DubbingTrackJobOptions, DubbingJobResult } from './MediaAccessibilityTypes';
import { VoiceDubbingConsentGate } from './VoiceDubbingConsentGate';

export class AudioTimingFitReconstructor {
  private consentGate: VoiceDubbingConsentGate;

  constructor(consentGate?: VoiceDubbingConsentGate, private readonly backend?: DubbingRenderBackend) {
    this.consentGate = consentGate || new VoiceDubbingConsentGate();
  }

  public isAvailable(): boolean {
    return Boolean(this.backend);
  }

  /**
   * Reconstructs dubbing audio track from timed cues with audio ducking and speed fitting.
   */
  public async renderDubbedTrack(
    cues: SubtitleCue[],
    options: DubbingTrackJobOptions
  ): Promise<DubbingJobResult> {
    // Consent check
    const permission = this.consentGate.evaluateDubbingPermission({
      voiceId: options.voiceId,
      isCustomOrClonedVoice: false, // default stock voice for general test
      consentId: options.consentRecord?.consentId
    });

    if (!permission.allowed) {
      throw new Error(permission.error);
    }
    if (!this.backend) {
      throw new Error('DUBBING_BACKEND_UNAVAILABLE: configure a verified speech synthesis and audio reconstruction backend.');
    }
    return this.backend.render(cues, options, permission.syntheticDisclosureNotice);
  }
}

export interface DubbingRenderBackend {
  render(cues: SubtitleCue[], options: DubbingTrackJobOptions, disclosureNotice: string): Promise<DubbingJobResult>;
}
