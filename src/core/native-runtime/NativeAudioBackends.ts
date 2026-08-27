import { ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DemucsWorkerExecutor } from '../audio/stemdeck/DemucsWorkerAdapter';
import { DemucsWorkerConfig, StemArtifact, StemType } from '../audio/stemdeck/StemdeckTypes';
import { runNativeCommand } from './NativeCommandRunner';

function walkAudioFiles(root: string, extension: '.wav' | '.mp3'): string[] {
  if (!fs.existsSync(root)) return [];
  const output: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...walkAudioFiles(full, extension));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) output.push(full);
  }
  return output;
}

async function probeAudio(ffprobePath: string, filePath: string): Promise<{ durationSeconds: number; sampleRate: number; channels: number }> {
  const result = await runNativeCommand(ffprobePath, [
    '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels:format=duration', '-of', 'json', filePath
  ], { timeoutMs: 30_000 });
  if (result.exitCode !== 0) throw new Error(`Unable to inspect Demucs artifact: ${result.stderr.trim()}`);
  const payload = JSON.parse(result.stdout);
  return {
    durationSeconds: Number(payload.format?.duration || 0),
    sampleRate: Number(payload.streams?.[0]?.sample_rate || 0),
    channels: Number(payload.streams?.[0]?.channels || 0)
  };
}

export class DemucsCliExecutor implements DemucsWorkerExecutor {
  private readonly children = new Map<string, ChildProcess>();

  constructor(private readonly demucsPath: string, private readonly ffmpegPath: string, private readonly ffprobePath: string) {}

  public async separate(input: {
    jobId: string;
    inputAudioPath: string;
    outputDirectory: string;
    config: DemucsWorkerConfig;
    onProgress?: (progress: { stage: string; percentage: number; message: string }) => void;
    isCancelled: () => boolean;
  }): Promise<StemArtifact[]> {
    const device = input.config.device === 'auto'
      ? (process.env.GPU_AVAILABLE === 'true' ? 'cuda' : 'cpu')
      : input.config.device;
    const args = ['-n', input.config.modelName, '-o', input.outputDirectory, '-d', device, '--mp3', '--mp3-bitrate', '320'];
    if (input.config.shifts !== undefined) args.push('--shifts', String(input.config.shifts));
    if (input.config.overlap !== undefined) args.push('--overlap', String(input.config.overlap));
    args.push(input.inputAudioPath);
    input.onProgress?.({ stage: 'model_loading', percentage: 15, message: `Loading ${input.config.modelName} on ${device}.` });
    const result = await runNativeCommand(this.demucsPath, args, {
      timeoutMs: 60 * 60_000,
      onSpawn: child => this.children.set(input.jobId, child),
      env: this.demucsEnvironment()
    });
    this.children.delete(input.jobId);
    if (input.isCancelled()) throw new Error('JOB_CANCELLED: Stem separation was cancelled by user.');
    if (result.exitCode !== 0) throw new Error(`Demucs separation failed: ${result.stderr.trim() || result.stdout.trim()}`);

    input.onProgress?.({ stage: 'verifying', percentage: 85, message: 'Inspecting and hashing separated stems.' });
    const requested = new Set(input.config.stems);
    const mp3Paths = walkAudioFiles(input.outputDirectory, '.mp3').filter(file => requested.has(path.basename(file, '.mp3') as StemType));
    const stemPaths: string[] = [];
    for (const mp3Path of mp3Paths) {
      const wavPath = path.join(input.outputDirectory, `${path.basename(mp3Path, '.mp3')}.wav`);
      const conversion = await runNativeCommand(this.ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-i', mp3Path, '-c:a', 'pcm_s16le', wavPath]);
      if (conversion.exitCode !== 0) throw new Error(`Demucs artifact conversion failed: ${conversion.stderr.trim()}`);
      stemPaths.push(wavPath);
    }
    if (stemPaths.length === 0) throw new Error('Demucs completed without producing any requested stem files.');

    const artifacts: StemArtifact[] = [];
    for (const filePath of stemPaths) artifacts.push(await this.createArtifact(filePath, path.basename(filePath, '.wav') as StemType));

    if (input.config.twoStems === 'vocals') {
      const backingSources = artifacts.filter(artifact => artifact.stemType !== 'vocals');
      if (backingSources.length > 0) {
        const complementPath = path.join(input.outputDirectory, 'complement.wav');
        const ffmpegInputs = backingSources.flatMap(artifact => ['-i', artifact.filePath]);
        const mix = await runNativeCommand(this.ffmpegPath, [
          '-y', '-hide_banner', '-loglevel', 'error', ...ffmpegInputs,
          '-filter_complex', `amix=inputs=${backingSources.length}:duration=longest:normalize=0`,
          '-c:a', 'pcm_s16le', complementPath
        ], { timeoutMs: 10 * 60_000 });
        if (mix.exitCode !== 0) throw new Error(`Backing-track reconstruction failed: ${mix.stderr.trim()}`);
        artifacts.push(await this.createArtifact(complementPath, 'complement'));
      }
    }
    return artifacts;
  }

  public cancel(jobId: string): void {
    this.children.get(jobId)?.kill('SIGKILL');
    this.children.delete(jobId);
  }

  private demucsEnvironment(): NodeJS.ProcessEnv {
    const sharedLibraries = process.env.FFMPEG_SHARED_DLL_DIR;
    if (!sharedLibraries) return process.env;
    if (!fs.existsSync(sharedLibraries) || !fs.statSync(sharedLibraries).isDirectory()) {
      throw new Error(`FFMPEG_SHARED_DLL_DIR does not identify a directory: ${sharedLibraries}`);
    }
    const entries = fs.readdirSync(sharedLibraries);
    if (process.platform === 'win32' && !entries.some(entry => /^avcodec-\d+\.dll$/i.test(entry))) {
      throw new Error(`FFMPEG_SHARED_DLL_DIR contains no FFmpeg shared libraries: ${sharedLibraries}`);
    }
    return {
      ...process.env,
      PATH: [sharedLibraries, process.env.PATH || process.env.Path || ''].filter(Boolean).join(path.delimiter)
    };
  }

  private async createArtifact(filePath: string, stemType: StemArtifact['stemType']): Promise<StemArtifact> {
    const bytes = fs.readFileSync(filePath);
    const metadata = await probeAudio(this.ffprobePath, filePath);
    return {
      stemType,
      filePath,
      ...metadata,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      fileSizeBytes: bytes.length
    };
  }
}
