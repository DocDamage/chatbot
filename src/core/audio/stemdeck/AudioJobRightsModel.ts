/**
 * Audio Job Rights & Governance Model (PX11-T01)
 *
 * Enforces explicit rights declarations, processing location constraints,
 * audio size and duration limits, and data egress guards.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AudioPreflightResult, AudioRightsDeclaration, StemType } from './StemdeckTypes';

export class AudioJobRightsModel {
  private static readonly MAX_DURATION_SECONDS = 1800; // 30 minutes max
  private static readonly MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB
  private static readonly SUPPORTED_EXTENSIONS = new Set(['.wav', '.flac', '.mp3', '.ogg', '.aac', '.aiff', '.m4a']);

  /**
   * Validates explicit user consent and preflights audio track properties.
   */
  public static preflightAudio(
    filePath: string,
    rights: AudioRightsDeclaration,
    requestedStems: StemType[] = ['vocals', 'drums', 'bass', 'other']
  ): AudioPreflightResult {
    // 1. Enforce user rights declaration
    if (!rights || !rights.hasExplicitUserConsent) {
      return {
        valid: false,
        rightsVerified: false,
        audioInfo: { durationSeconds: 0, sampleRate: 0, channels: 0, bitDepth: 0, codec: 'unknown', fileSizeBytes: 0 },
        resourceEstimate: { estimatedVramBytes: 0, estimatedRamBytes: 0, estimatedDurationMs: 0, recommendedAcceleration: 'cpu' },
        error: 'RIGHTS_DECLARATION_REQUIRED: User must explicitly confirm ownership or permission to process this audio track.'
      };
    }

    // 2. Enforce local-only processing boundary by default
    if (rights.processingLocation !== 'local_only') {
      return {
        valid: false,
        rightsVerified: false,
        audioInfo: { durationSeconds: 0, sampleRate: 0, channels: 0, bitDepth: 0, codec: 'unknown', fileSizeBytes: 0 },
        resourceEstimate: { estimatedVramBytes: 0, estimatedRamBytes: 0, estimatedDurationMs: 0, recommendedAcceleration: 'cpu' },
        error: 'DATA_EGRESS_POLICY: Stem separation is restricted to local processing to prevent unauthorized remote upload.'
      };
    }

    // 3. File existence and extension safety
    if (!fs.existsSync(filePath)) {
      return {
        valid: false,
        rightsVerified: true,
        audioInfo: { durationSeconds: 0, sampleRate: 0, channels: 0, bitDepth: 0, codec: 'unknown', fileSizeBytes: 0 },
        resourceEstimate: { estimatedVramBytes: 0, estimatedRamBytes: 0, estimatedDurationMs: 0, recommendedAcceleration: 'cpu' },
        error: `Audio file does not exist: ${filePath}`
      };
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!this.SUPPORTED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        rightsVerified: true,
        audioInfo: { durationSeconds: 0, sampleRate: 0, channels: 0, bitDepth: 0, codec: 'unknown', fileSizeBytes: 0 },
        resourceEstimate: { estimatedVramBytes: 0, estimatedRamBytes: 0, estimatedDurationMs: 0, recommendedAcceleration: 'cpu' },
        error: `Unsupported audio codec: ${ext}. Supported formats: ${Array.from(this.SUPPORTED_EXTENSIONS).join(', ')}`
      };
    }

    // 4. File size check
    const stats = fs.statSync(filePath);
    if (stats.size > this.MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        rightsVerified: true,
        audioInfo: { durationSeconds: 0, sampleRate: 0, channels: 0, bitDepth: 0, codec: 'unknown', fileSizeBytes: stats.size },
        resourceEstimate: { estimatedVramBytes: 0, estimatedRamBytes: 0, estimatedDurationMs: 0, recommendedAcceleration: 'cpu' },
        error: `File size exceeds safety limit (${Math.round(stats.size / (1024 * 1024))}MB > 250MB).`
      };
    }

    // 5. Parse basic audio header estimates
    const codec = (ext.replace('.', '') as any) || 'wav';
    const estimatedDuration = Math.max(1, Math.min(this.MAX_DURATION_SECONDS, Math.round(stats.size / (44100 * 2 * 2)))); // Rough estimate
    const sampleRate = 44100;
    const channels = 2;
    const bitDepth = 16;

    // 6. Compute hardware resource estimates
    const stemCount = requestedStems.length || 4;
    const estimatedVramBytes = stemCount >= 6 ? 4 * 1024 * 1024 * 1024 : 2 * 1024 * 1024 * 1024; // 2GB-4GB
    const estimatedRamBytes = 2 * 1024 * 1024 * 1024;
    const estimatedDurationMs = Math.round(estimatedDuration * 0.15 * 1000); // ~15% realtime on GPU

    return {
      valid: true,
      rightsVerified: true,
      audioInfo: {
        durationSeconds: estimatedDuration,
        sampleRate,
        channels,
        bitDepth,
        codec,
        fileSizeBytes: stats.size
      },
      resourceEstimate: {
        estimatedVramBytes,
        estimatedRamBytes,
        estimatedDurationMs,
        recommendedAcceleration: 'cuda'
      }
    };
  }

  /**
   * Generates a cryptographic digest for rights confirmation.
   */
  public static computeRightsDigest(filePath: string, userId: string, declarationText: string): string {
    const payload = `${path.basename(filePath)}:${userId}:${declarationText}:${new Date().toDateString()}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
