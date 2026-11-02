/**
 * Waveform Cache & Multitrack Mixer Engine (PX11-T05)
 *
 * Generates bounded waveform peak/RMS envelopes, synchronizes timeline playback,
 * and renders multitrack mixdowns with per-stem gain, mute, solo, and pan parameters.
 */

import * as fs from 'fs';
import { MixerChannel, MultitrackMixerState, StemType, WaveformSummary } from './StemdeckTypes';

export class WaveformMixerEngine {
  /**
   * Generates a compact waveform peak and RMS envelope (e.g. 128 or 256 points).
   */
  public static generateWaveformSummary(
    filePathOrBuffer: string | Buffer,
    stemType: StemType | 'original' | 'mixdown' = 'original',
    pointCount = 128
  ): WaveformSummary {
    let buffer: Buffer;
    if (typeof filePathOrBuffer === 'string') {
      buffer = fs.existsSync(filePathOrBuffer) ? fs.readFileSync(filePathOrBuffer) : Buffer.alloc(0);
    } else {
      buffer = filePathOrBuffer;
    }

    const peaksMin: number[] = [];
    const peaksMax: number[] = [];
    const rms: number[] = [];

    if (buffer.length <= 44) {
      // Return empty envelope
      for (let i = 0; i < pointCount; i++) {
        peaksMin.push(0);
        peaksMax.push(0);
        rms.push(0);
      }
      return { stemType, pointCount, peaksMin, peaksMax, rms, durationSeconds: 0 };
    }

    const audioData = buffer.subarray(44);
    const totalSamples = Math.floor(audioData.length / 2); // 16-bit mono/stereo samples
    const samplesPerPoint = Math.max(1, Math.floor(totalSamples / pointCount));

    for (let p = 0; p < pointCount; p++) {
      let minVal = 0;
      let maxVal = 0;
      let sumSq = 0;
      let count = 0;

      const startIdx = p * samplesPerPoint;
      const endIdx = Math.min(totalSamples, startIdx + samplesPerPoint);

      for (let s = startIdx; s < endIdx; s++) {
        const offset = s * 2;
        if (offset + 1 < audioData.length) {
          const val = audioData.readInt16LE(offset) / 32768.0; // Normalized -1.0 to 1.0
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
          sumSq += val * val;
          count++;
        }
      }

      peaksMin.push(Math.round(minVal * 100) / 100);
      peaksMax.push(Math.round(maxVal * 100) / 100);
      rms.push(count > 0 ? Math.round(Math.sqrt(sumSq / count) * 100) / 100 : 0);
    }

    const durationSeconds = Math.max(1, Math.round(totalSamples / (44100 * 2)));

    return {
      stemType,
      pointCount,
      peaksMin,
      peaksMax,
      rms,
      durationSeconds
    };
  }

  /**
   * Initializes a default multitrack mixer state.
   */
  public static createDefaultMixerState(sessionId: string, stems: Array<StemType | 'complement'>): MultitrackMixerState {
    const channels: Record<string, MixerChannel> = {};

    for (const stem of stems) {
      channels[stem] = {
        stemType: stem,
        gainDb: 0.0, // Unity gain
        pan: 0.0, // Center
        mute: false,
        solo: false,
        monitor: true
      };
    }

    return {
      sessionId,
      channels,
      masterVolumeDb: 0.0,
      playbackPositionSeconds: 0.0,
      timelineDurationSeconds: 120.0
    };
  }

  /**
   * Computes effective channel amplitudes given solo/mute states and gain dB.
   */
  public static computeEffectiveChannelGains(channels: Record<string, MixerChannel>): Record<string, { leftGain: number; rightGain: number }> {
    const anySolo = Object.values(channels).some(c => c.solo);
    const result: Record<string, { leftGain: number; rightGain: number }> = {};

    for (const [key, ch] of Object.entries(channels)) {
      if (ch.mute || (anySolo && !ch.solo)) {
        result[key] = { leftGain: 0.0, rightGain: 0.0 };
        continue;
      }

      // Convert dB to linear amplitude: 10^(dB/20)
      const linearGain = Math.pow(10, ch.gainDb / 20);

      // Constant-power panning law
      // Pan from -1.0 (Left) to +1.0 (Right)
      const panNorm = (ch.pan + 1.0) / 2.0; // 0.0 to 1.0
      const leftGain = linearGain * Math.cos((panNorm * Math.PI) / 2);
      const rightGain = linearGain * Math.sin((panNorm * Math.PI) / 2);

      result[key] = {
        leftGain: Math.round(leftGain * 1000) / 1000,
        rightGain: Math.round(rightGain * 1000) / 1000
      };
    }

    return result;
  }
}
