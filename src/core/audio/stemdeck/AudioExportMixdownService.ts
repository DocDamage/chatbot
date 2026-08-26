/**
 * Audio Export & Mixdown Service (PX11-T07)
 *
 * Implements stem exports, multitrack mixdown rendering, analysis JSON/CSV exports,
 * and cryptographic SHA-256 job manifests.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AudioTrackAnalysisResult, MixerChannel, StemArtifact } from './StemdeckTypes';
import { WaveformMixerEngine } from './WaveformMixerEngine';

export interface AudioExportPackageResult {
  success: boolean;
  outputDirectory: string;
  exportedFiles: Array<{ path: string; fileType: string; sha256: string; sizeBytes: number }>;
  manifestPath: string;
  error?: string;
}

export class AudioExportMixdownService {
  /**
   * Packages separated stems, rendered mixdown, and analysis report into an export directory.
   */
  public static exportStemPackage(
    outputDir: string,
    projectName: string,
    stems: StemArtifact[],
    mixerChannels?: Record<string, MixerChannel>,
    analysis?: AudioTrackAnalysisResult
  ): AudioExportPackageResult {
    try {
      if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,127}$/.test(projectName)) {
        throw new Error('Project name contains unsafe filename characters');
      }
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const exportedFiles: Array<{ path: string; fileType: string; sha256: string; sizeBytes: number }> = [];

      // 1. Copy stems to export directory
      for (const stem of stems) {
        const destFileName = `${projectName}_${stem.stemType}.wav`;
        const destPath = path.join(outputDir, destFileName);

        if (!fs.existsSync(stem.filePath)) throw new Error(`Stem file does not exist: ${stem.filePath}`);
        fs.copyFileSync(stem.filePath, destPath);

        const buf = fs.readFileSync(destPath);
        const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

        exportedFiles.push({
          path: destPath,
          fileType: 'audio/wav',
          sha256,
          sizeBytes: buf.length
        });
      }

      // 2. Render mixdown track if mixer channels provided
      if (mixerChannels) {
        const mixdownPath = path.join(outputDir, `${projectName}_mixdown.wav`);
        const mixdownBuf = this.renderMixdownBuffer(stems, mixerChannels);
        fs.writeFileSync(mixdownPath, mixdownBuf);

        const mixSha = crypto.createHash('sha256').update(mixdownBuf).digest('hex');
        exportedFiles.push({
          path: mixdownPath,
          fileType: 'audio/wav',
          sha256: mixSha,
          sizeBytes: mixdownBuf.length
        });
      }

      // 3. Export analysis JSON and CSV
      if (analysis) {
        const analysisJsonPath = path.join(outputDir, `${projectName}_analysis.json`);
        fs.writeFileSync(analysisJsonPath, JSON.stringify(analysis, null, 2), 'utf-8');
        const jsonBuf = fs.readFileSync(analysisJsonPath);
        exportedFiles.push({
          path: analysisJsonPath,
          fileType: 'application/json',
          sha256: crypto.createHash('sha256').update(jsonBuf).digest('hex'),
          sizeBytes: jsonBuf.length
        });

        const csvContent = `Metric,Value\nBPM,${analysis.bpm}\nKey,${analysis.key}\nIntegrated LUFS,${analysis.integratedLufs}\nTrue Peak dBFS,${analysis.truePeakDbfs}\nDynamic Range,${analysis.dynamicRangeScore}\n`;
        const analysisCsvPath = path.join(outputDir, `${projectName}_analysis.csv`);
        fs.writeFileSync(analysisCsvPath, csvContent, 'utf-8');
        const csvBuf = fs.readFileSync(analysisCsvPath);
        exportedFiles.push({
          path: analysisCsvPath,
          fileType: 'text/csv',
          sha256: crypto.createHash('sha256').update(csvBuf).digest('hex'),
          sizeBytes: csvBuf.length
        });
      }

      // 4. Create master job manifest
      const manifest = {
        projectName,
        exportedAt: new Date().toISOString(),
        stemCount: stems.length,
        analysisSummary: analysis ? { bpm: analysis.bpm, key: analysis.key, lufs: analysis.integratedLufs } : undefined,
        files: exportedFiles,
        notices: 'Stems extracted via local Demucs neural separator. Produced with user-verified audio rights.'
      };

      const manifestPath = path.join(outputDir, `${projectName}_manifest.json`);
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

      return {
        success: true,
        outputDirectory: outputDir,
        exportedFiles,
        manifestPath
      };
    } catch (err: any) {
      return {
        success: false,
        outputDirectory: outputDir,
        exportedFiles: [],
        manifestPath: '',
        error: `Export failed: ${err.message}`
      };
    }
  }

  private static renderMixdownBuffer(stems: StemArtifact[], channels: Record<string, MixerChannel>): Buffer {
    const effectiveGains = WaveformMixerEngine.computeEffectiveChannelGains(channels);
    const decoded = stems.map(stem => this.decodePcm16Wav(stem));
    if (decoded.length === 0) throw new Error('At least one PCM WAV stem is required for mixdown');
    const sampleRate = decoded[0].sampleRate;
    if (decoded.some(stem => stem.sampleRate !== sampleRate)) {
      throw new Error('All stems must use the same sample rate for mixdown');
    }
    const numSamples = Math.max(...decoded.map(stem => stem.frameCount));
    const blockAlign = 4; // 2 channels * 2 bytes
    const dataSize = numSamples * blockAlign;

    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF & fmt header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(2, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * blockAlign, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Sum synthesized channels with gains
    for (let i = 0; i < numSamples; i++) {
      let leftSum = 0;
      let rightSum = 0;

      for (const stem of decoded) {
        const gain = effectiveGains[stem.stemType] || { leftGain: 0, rightGain: 0 };
        if (i >= stem.frameCount) continue;
        const sampleOffset = stem.dataOffset + i * stem.channelCount * 2;
        const sourceLeft = stem.buffer.readInt16LE(sampleOffset);
        const sourceRight = stem.channelCount === 2
          ? stem.buffer.readInt16LE(sampleOffset + 2)
          : sourceLeft;
        leftSum += sourceLeft * gain.leftGain;
        rightSum += sourceRight * gain.rightGain;
      }

      const clampedL = Math.max(-32767, Math.min(32767, Math.round(leftSum)));
      const clampedR = Math.max(-32767, Math.min(32767, Math.round(rightSum)));

      const offset = 44 + i * blockAlign;
      buffer.writeInt16LE(clampedL, offset);
      buffer.writeInt16LE(clampedR, offset + 2);
    }

    return buffer;
  }

  private static decodePcm16Wav(stem: StemArtifact): {
    stemType: string;
    buffer: Buffer;
    sampleRate: number;
    channelCount: number;
    dataOffset: number;
    frameCount: number;
  } {
    const buffer = fs.readFileSync(stem.filePath);
    if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error(`Stem is not a valid WAV file: ${stem.filePath}`);
    }
    const audioFormat = buffer.readUInt16LE(20);
    const channelCount = buffer.readUInt16LE(22);
    const sampleRate = buffer.readUInt32LE(24);
    const bitsPerSample = buffer.readUInt16LE(34);
    if (audioFormat !== 1 || bitsPerSample !== 16 || (channelCount !== 1 && channelCount !== 2)) {
      throw new Error(`Stem must be mono or stereo 16-bit PCM WAV: ${stem.filePath}`);
    }

    let dataOffset = 12;
    let dataSize = 0;
    while (dataOffset + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', dataOffset, dataOffset + 4);
      const chunkSize = buffer.readUInt32LE(dataOffset + 4);
      if (chunkId === 'data') {
        dataOffset += 8;
        dataSize = Math.min(chunkSize, buffer.length - dataOffset);
        break;
      }
      dataOffset += 8 + chunkSize + (chunkSize % 2);
    }
    if (dataSize <= 0) throw new Error(`WAV stem has no data chunk: ${stem.filePath}`);

    return {
      stemType: stem.stemType,
      buffer,
      sampleRate,
      channelCount,
      dataOffset,
      frameCount: Math.floor(dataSize / (channelCount * 2))
    };
  }
}
