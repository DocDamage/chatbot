import fs from 'fs/promises';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

export const supportedAudioExtensions = new Set(['.wav', '.mp3', '.flac', '.aiff', '.aif', '.ogg', '.m4a', '.mid', '.midi']);

export interface AudioFileEntry {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedTime: string;
}

export interface AudioListOptions {
  limit?: number;
  offset?: number;
  maxFiles?: number;
  cacheTtlMs?: number;
}

export interface AudioListResult {
  files: AudioFileEntry[];
  nextOffset?: number;
  totalIndexed: number;
  scannedFiles: number;
  truncated: boolean;
  cached: boolean;
}

export interface AudioMetadata extends AudioFileEntry {
  format: string;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  tags?: Record<string, string>;
  ffmpegAvailable: boolean;
  notice?: string;
}

export interface AudioProbeResult {
  duration?: number;
  sampleRate?: number;
  channels?: number;
  tags?: Record<string, string>;
}

export interface AudioWaveformResult {
  path: string;
  points: number[];
  sampleRate?: number;
  channels?: number;
  duration?: number;
  available: boolean;
  source: 'wav-pcm' | 'unsupported';
  notice?: string;
}

export interface AudioAnalysisResult {
  path: string;
  available: boolean;
  source: 'wav-pcm' | 'unsupported';
  format: string;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  peakAmplitude?: number;
  rmsAmplitude?: number;
  channelPeaks?: number[];
  estimatedTempo?: null;
  notice?: string;
}

export type AudioMetadataProbe = (absolutePath: string) => Promise<AudioProbeResult>;

interface AudioIndexEntry {
  root: string;
  createdAt: number;
  maxFiles: number;
  files: AudioFileEntry[];
  scannedFiles: number;
  truncated: boolean;
}

interface DecodedWav {
  samples: number[][];
  sampleRate: number;
  channels: number;
  duration: number;
  source: 'wav-pcm';
}

export class AudioLibraryService {
  private readonly indexCache = new Map<string, AudioIndexEntry>();

  constructor(
    private readonly workspaceRoot = process.cwd(),
    private readonly metadataProbe: AudioMetadataProbe = AudioLibraryService.ffprobeMetadata
  ) {}

  async listAudioFiles(root = '.', q = '', options: AudioListOptions = {}): Promise<AudioListResult> {
    const limit = this.clamp(options.limit ?? 50, 1, 200);
    const offset = Math.max(0, options.offset ?? 0);
    const maxFiles = this.clamp(options.maxFiles ?? 1000, 1, 10000);
    const cacheTtlMs = Math.max(0, options.cacheTtlMs ?? 30000);
    const index = await this.getIndex(root, maxFiles, cacheTtlMs);
    const lower = q.toLowerCase();
    const matching = lower
      ? index.files.filter(file => file.path.toLowerCase().includes(lower))
      : index.files;
    const files = matching.slice(offset, offset + limit);
    const nextOffset = offset + files.length < matching.length ? offset + files.length : undefined;

    return {
      files,
      nextOffset,
      totalIndexed: matching.length,
      scannedFiles: index.scannedFiles,
      truncated: index.truncated,
      cached: index.cached
    };
  }

  invalidateCache(root = '.'): void {
    const absoluteRoot = this.resolveSafe(root);
    this.indexCache.delete(absoluteRoot);
  }

  private async getIndex(root = '.', maxFiles: number, cacheTtlMs: number): Promise<AudioIndexEntry & { cached: boolean }> {
    const absoluteRoot = this.resolveSafe(root);
    const cached = this.indexCache.get(absoluteRoot);
    const now = Date.now();
    if (cached && cached.maxFiles >= maxFiles && now - cached.createdAt <= cacheTtlMs) {
      return { ...cached, cached: true };
    }

    const walkResult = await this.walk(absoluteRoot, maxFiles);
    const entries: AudioFileEntry[] = [];
    for (const file of walkResult.files) {
      const relative = this.relative(file);
      const stats = await fs.stat(file);
      entries.push({
        path: relative,
        name: path.basename(relative),
        extension: path.extname(relative).toLowerCase(),
        size: stats.size,
        modifiedTime: stats.mtime.toISOString()
      });
    }
    const index: AudioIndexEntry = {
      root: absoluteRoot,
      createdAt: now,
      maxFiles,
      files: entries,
      scannedFiles: walkResult.scannedFiles,
      truncated: walkResult.truncated
    };
    this.indexCache.set(absoluteRoot, index);
    return { ...index, cached: false };
  }

  async getMetadata(workspacePath: string): Promise<AudioMetadata> {
    const absolute = this.resolveSafe(workspacePath);
    this.assertAudio(absolute);
    const stats = await fs.stat(absolute);
    const extension = path.extname(absolute).toLowerCase();
    const baseMetadata: AudioMetadata = {
      path: this.relative(absolute),
      name: path.basename(absolute),
      extension,
      format: extension.replace('.', ''),
      size: stats.size,
      modifiedTime: stats.mtime.toISOString(),
      ffmpegAvailable: false,
      notice: 'FFmpeg metadata probing is unavailable; showing filesystem metadata only.'
    };

    try {
      const probed = await this.metadataProbe(absolute);
      return {
        ...baseMetadata,
        ...probed,
        ffmpegAvailable: true,
        notice: undefined
      };
    } catch {
      return baseMetadata;
    }
  }

  getPreviewPath(workspacePath: string): string {
    const absolute = this.resolveSafe(workspacePath);
    this.assertAudio(absolute);
    return absolute;
  }

  async loadIntoChat(items: string[]) {
    return Promise.all(items.map(item => this.getMetadata(item)));
  }

  async getWaveform(workspacePath: string, pointCount = 128): Promise<AudioWaveformResult> {
    const absolute = this.resolveSafe(workspacePath);
    this.assertAudio(absolute);
    const relativePath = this.relative(absolute);

    try {
      const decoded = await this.decodeWavPcm(absolute);
      return {
        path: relativePath,
        points: this.buildWaveformPoints(decoded, this.clamp(pointCount, 16, 1024)),
        sampleRate: decoded.sampleRate,
        channels: decoded.channels,
        duration: decoded.duration,
        available: true,
        source: decoded.source,
      };
    } catch (error: any) {
      return {
        path: relativePath,
        points: [],
        available: false,
        source: 'unsupported',
        notice: error?.message || 'Waveform extraction is not available for this file.',
      };
    }
  }

  async analyzeAudio(workspacePath: string): Promise<AudioAnalysisResult> {
    const absolute = this.resolveSafe(workspacePath);
    this.assertAudio(absolute);
    const relativePath = this.relative(absolute);
    const format = path.extname(absolute).toLowerCase().replace('.', '');

    try {
      const decoded = await this.decodeWavPcm(absolute);
      const flattened = decoded.samples.flat();
      const peakAmplitude = flattened.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
      const rmsAmplitude = flattened.length > 0
        ? Math.sqrt(flattened.reduce((sum, sample) => sum + sample * sample, 0) / flattened.length)
        : 0;
      const channelPeaks = decoded.samples.map(channel =>
        channel.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0)
      );

      return {
        path: relativePath,
        available: true,
        source: decoded.source,
        format,
        duration: decoded.duration,
        sampleRate: decoded.sampleRate,
        channels: decoded.channels,
        peakAmplitude: Number(peakAmplitude.toFixed(6)),
        rmsAmplitude: Number(rmsAmplitude.toFixed(6)),
        channelPeaks: channelPeaks.map(value => Number(value.toFixed(6))),
        estimatedTempo: null,
        notice: 'Tempo detection is not implemented; analysis covers deterministic PCM amplitude statistics.',
      };
    } catch (error: any) {
      const metadata = await this.getMetadata(workspacePath);
      return {
        path: relativePath,
        available: false,
        source: 'unsupported',
        format,
        duration: metadata.duration,
        sampleRate: metadata.sampleRate,
        channels: metadata.channels,
        estimatedTempo: null,
        notice: error?.message || 'Audio analysis is not available for this file.',
      };
    }
  }

  private async walk(root: string, maxFiles: number): Promise<{ files: string[]; scannedFiles: number; truncated: boolean }> {
    const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage', '.next', 'build', '.worktrees']);
    const files: string[] = [];
    let scannedFiles = 0;
    let truncated = false;
    const visit = async (current: string) => {
      if (scannedFiles >= maxFiles) {
        truncated = true;
        return;
      }
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (scannedFiles >= maxFiles) {
          truncated = true;
          return;
        }
        if (ignored.has(entry.name)) continue;
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) await visit(absolute);
        if (entry.isFile()) {
          scannedFiles += 1;
          if (supportedAudioExtensions.has(path.extname(entry.name).toLowerCase())) files.push(absolute);
        }
      }
    };
    await visit(root);
    return { files, scannedFiles, truncated };
  }

  private resolveSafe(workspacePath: string): string {
    const absolute = path.resolve(this.workspaceRoot, workspacePath || '.');
    const root = path.resolve(this.workspaceRoot);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
      throw new Error('Path resolves outside workspace');
    }
    return absolute;
  }

  private assertAudio(absolute: string): void {
    if (!supportedAudioExtensions.has(path.extname(absolute).toLowerCase())) {
      throw new Error('Unsupported audio file type');
    }
  }

  private relative(absolute: string): string {
    return path.relative(this.workspaceRoot, absolute).replace(/\\/g, '/');
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.floor(value)));
  }

  private async decodeWavPcm(absolutePath: string): Promise<DecodedWav> {
    if (path.extname(absolutePath).toLowerCase() !== '.wav') {
      throw new Error('Only PCM WAV waveform extraction is currently supported.');
    }

    const buffer = await fs.readFile(absolutePath);
    if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('Invalid WAV container.');
    }

    let offset = 12;
    let audioFormat = 0;
    let channels = 0;
    let sampleRate = 0;
    let bitsPerSample = 0;
    let dataStart = -1;
    let dataSize = 0;

    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const chunkStart = offset + 8;
      if (chunkStart + chunkSize > buffer.length) break;

      if (chunkId === 'fmt ') {
        audioFormat = buffer.readUInt16LE(chunkStart);
        channels = buffer.readUInt16LE(chunkStart + 2);
        sampleRate = buffer.readUInt32LE(chunkStart + 4);
        bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
      }

      if (chunkId === 'data') {
        dataStart = chunkStart;
        dataSize = chunkSize;
      }

      offset = chunkStart + chunkSize + (chunkSize % 2);
    }

    if (!channels || !sampleRate || !bitsPerSample || dataStart < 0 || dataSize <= 0) {
      throw new Error('WAV metadata or sample data is missing.');
    }
    if (audioFormat !== 1 && audioFormat !== 3) {
      throw new Error('Only PCM or 32-bit float WAV files are supported.');
    }

    const bytesPerSample = bitsPerSample / 8;
    if (!Number.isInteger(bytesPerSample) || bytesPerSample <= 0) {
      throw new Error('Unsupported WAV bit depth.');
    }

    const frameCount = Math.floor(dataSize / (bytesPerSample * channels));
    const samples = Array.from({ length: channels }, () => [] as number[]);
    for (let frame = 0; frame < frameCount; frame++) {
      for (let channel = 0; channel < channels; channel++) {
        const sampleOffset = dataStart + (frame * channels + channel) * bytesPerSample;
        samples[channel].push(this.readNormalizedSample(buffer, sampleOffset, bitsPerSample, audioFormat));
      }
    }

    return {
      samples,
      sampleRate,
      channels,
      duration: frameCount / sampleRate,
      source: 'wav-pcm',
    };
  }

  private readNormalizedSample(buffer: Buffer, offset: number, bitsPerSample: number, audioFormat: number): number {
    if (audioFormat === 3 && bitsPerSample === 32) {
      return Math.max(-1, Math.min(1, buffer.readFloatLE(offset)));
    }

    if (bitsPerSample === 8) {
      return (buffer.readUInt8(offset) - 128) / 128;
    }
    if (bitsPerSample === 16) {
      return buffer.readInt16LE(offset) / 32768;
    }
    if (bitsPerSample === 24) {
      return buffer.readIntLE(offset, 3) / 8388608;
    }
    if (bitsPerSample === 32) {
      return buffer.readInt32LE(offset) / 2147483648;
    }

    throw new Error('Unsupported WAV bit depth.');
  }

  private buildWaveformPoints(decoded: DecodedWav, pointCount: number): number[] {
    const frameCount = decoded.samples[0]?.length || 0;
    if (frameCount === 0) return [];

    const points: number[] = [];
    for (let point = 0; point < pointCount; point++) {
      const start = Math.floor((point / pointCount) * frameCount);
      const end = Math.max(start + 1, Math.floor(((point + 1) / pointCount) * frameCount));
      let peak = 0;

      for (let frame = start; frame < end; frame++) {
        for (let channel = 0; channel < decoded.channels; channel++) {
          peak = Math.max(peak, Math.abs(decoded.samples[channel][frame] || 0));
        }
      }

      points.push(Number(peak.toFixed(6)));
    }

    return points;
  }

  private static ffprobeMetadata(absolutePath: string): Promise<AudioProbeResult> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(absolutePath, (error, data) => {
        if (error) {
          reject(error);
          return;
        }
        const audioStream = data.streams.find(stream => stream.codec_type === 'audio');
        resolve({
          duration: typeof data.format.duration === 'number' ? data.format.duration : undefined,
          sampleRate: audioStream?.sample_rate ? Number(audioStream.sample_rate) : undefined,
          channels: audioStream?.channels,
          tags: data.format.tags as Record<string, string> | undefined
        });
      });
    });
  }
}
