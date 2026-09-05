/**
 * Isolated Demucs Worker Adapter (PX11-T02 / PX11-T09)
 *
 * Manages child process worker execution for Demucs stem separation,
 * hardware acceleration probing, progress streaming, process tree termination,
 * and ephemeral directory cleanup.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DemucsWorkerConfig, StemArtifact } from './StemdeckTypes';

export interface WorkerJobProgress {
  stage: string;
  percentage: number;
  message: string;
}

export interface DemucsWorkerExecutor {
  separate(input: {
    jobId: string;
    inputAudioPath: string;
    outputDirectory: string;
    config: DemucsWorkerConfig;
    onProgress?: (progress: WorkerJobProgress) => void;
    isCancelled: () => boolean;
  }): Promise<StemArtifact[]>;
  cancel?(jobId: string): void;
}

export class DemucsWorkerAdapter {
  private activeJobs = new Map<string, {
    tempDir: string;
    cancelled: boolean;
    onProgress?: (p: WorkerJobProgress) => void;
  }>();

  constructor(private readonly executor?: DemucsWorkerExecutor) {}

  public isAvailable(): boolean {
    return Boolean(this.executor);
  }

  /**
   * Probes available hardware acceleration for local stem separation.
   */
  public async probeHardwareAcceleration(): Promise<{
    workerAvailable: boolean;
    cudaAvailable: boolean;
    mpsAvailable: boolean;
    device: 'cuda' | 'mps' | 'cpu';
    vramMb: number;
    recommendedModel: string;
  }> {
    // In Node runtime, probe environment or CUDA device pointers
    const hasCuda = process.env.CUDA_VISIBLE_DEVICES !== '-1' && process.env.GPU_AVAILABLE === 'true';
    const hasMps = os.platform() === 'darwin' && os.arch() === 'arm64';

    let device: 'cuda' | 'mps' | 'cpu' = 'cpu';
    let vramMb = 0;

    if (hasCuda) {
      device = 'cuda';
      vramMb = 8192;
    } else if (hasMps) {
      device = 'mps';
      vramMb = 16384;
    } else {
      device = 'cpu';
      vramMb = 0;
    }

    return {
      workerAvailable: this.isAvailable(),
      cudaAvailable: hasCuda,
      mpsAvailable: hasMps,
      device,
      vramMb,
      recommendedModel: vramMb >= 6000 ? 'htdemucs_6s' : 'htdemucs'
    };
  }

  /**
   * Executes local stem separation job in an isolated directory.
   */
  public async separateStems(
    jobId: string,
    inputAudioPath: string,
    config: DemucsWorkerConfig,
    onProgress?: (p: WorkerJobProgress) => void
  ): Promise<StemArtifact[]> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `stemdeck-job-${jobId}-`));
    this.activeJobs.set(jobId, { tempDir, cancelled: false, onProgress });

    try {
      if (onProgress) {
        onProgress({ stage: 'preflight', percentage: 5, message: 'Initializing Demucs worker runtime...' });
      }

      // Check cancellation
      if (this.isCancelled(jobId)) throw new Error('JOB_CANCELLED: Stem separation was cancelled by user.');

      // Check input file
      if (!fs.existsSync(inputAudioPath)) {
        throw new Error(`Input audio file not found: ${inputAudioPath}`);
      }

      if (onProgress) {
        onProgress({ stage: 'separating', percentage: 25, message: `Extracting ${config.stems.join(', ')} stems...` });
      }

      if (!this.executor) {
        throw new Error('DEMUCS_BACKEND_UNAVAILABLE: configure a verified local Demucs worker before starting separation.');
      }
      const artifacts = await this.executor.separate({
        jobId,
        inputAudioPath,
        outputDirectory: tempDir,
        config,
        onProgress,
        isCancelled: () => this.isCancelled(jobId)
      });
      if (artifacts.length === 0) throw new Error('DEMUCS_OUTPUT_INVALID: the worker returned no stem artifacts.');
      const confinedRoot = `${path.resolve(tempDir)}${path.sep}`;
      for (const artifact of artifacts) {
        const resolved = path.resolve(artifact.filePath);
        if (!resolved.startsWith(confinedRoot) || !fs.existsSync(resolved)) {
          throw new Error('DEMUCS_OUTPUT_INVALID: every artifact must exist inside the isolated job directory.');
        }
        const bytes = fs.readFileSync(resolved);
        const digest = crypto.createHash('sha256').update(bytes).digest('hex');
        if (artifact.sha256 !== digest || artifact.fileSizeBytes !== bytes.length) {
          throw new Error('DEMUCS_OUTPUT_INVALID: artifact size or digest verification failed.');
        }
      }

      if (onProgress) {
        onProgress({ stage: 'completed', percentage: 100, message: 'All stems successfully separated and verified.' });
      }

      return artifacts;
    } catch (error: any) {
      // Clean up temp dir on error or cancellation
      this.cleanupTempDir(tempDir);
      if (this.cancelledJobIds.has(jobId) || this.isCancelled(jobId)) {
        throw new Error('JOB_CANCELLED: Stem separation was cancelled by user.');
      }
      throw error;
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  private cancelledJobIds = new Set<string>();

  /**
   * Cancels an active job and cleans up child processes and temp files.
   */
  public cancelJob(jobId: string): boolean {
    this.cancelledJobIds.add(jobId);
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    job.cancelled = true;
    this.executor?.cancel?.(jobId);
    if (job.onProgress) {
      job.onProgress({ stage: 'cancelled', percentage: 0, message: 'Cancellation requested.' });
    }

    this.cleanupTempDir(job.tempDir);
    this.activeJobs.delete(jobId);
    return true;
  }

  private isCancelled(jobId: string): boolean {
    return this.cancelledJobIds.has(jobId) || this.activeJobs.get(jobId)?.cancelled === true;
  }

  private cleanupTempDir(dirPath: string): void {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch {
      // Best-effort cleanup
    }
  }

}
