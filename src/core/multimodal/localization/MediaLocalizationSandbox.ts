/**
 * Media Localization Workspace Sandbox (CF-07)
 *
 * Manages isolated ephemeral directories for intermediate audio extraction,
 * subtitle files (SRT/VTT), vocal separation, and final localized media exports.
 * Enforces disk budgets and containment without escaping workspace boundaries.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MediaSandboxPaths {
  root: string;
  audio: string;
  vocals: string;
  subtitles: string;
  chunks: string;
  output: string;
}

export class MediaLocalizationSandbox {
  private readonly jobId: string;
  private readonly baseDir: string;
  private readonly maxDiskBytes: number;
  private paths: MediaSandboxPaths;
  private isDestroyed = false;

  constructor(jobId: string, options?: { baseDir?: string; maxDiskBytes?: number }) {
    this.jobId = jobId;
    this.baseDir = options?.baseDir || path.resolve(process.cwd(), 'temp', 'media-localization');
    this.maxDiskBytes = options?.maxDiskBytes ?? 1024 * 1024 * 1024; // 1GB default

    const jobRoot = path.join(this.baseDir, this.jobId);
    this.paths = {
      root: jobRoot,
      audio: path.join(jobRoot, 'audio'),
      vocals: path.join(jobRoot, 'vocals'),
      subtitles: path.join(jobRoot, 'subtitles'),
      chunks: path.join(jobRoot, 'chunks'),
      output: path.join(jobRoot, 'output')
    };
  }

  /**
   * Initialize all workspace directories
   */
  public async initialize(): Promise<MediaSandboxPaths> {
    if (this.isDestroyed) {
      throw new Error(`Cannot initialize destroyed sandbox for job '${this.jobId}'`);
    }

    fs.mkdirSync(this.paths.root, { recursive: true });
    fs.mkdirSync(this.paths.audio, { recursive: true });
    fs.mkdirSync(this.paths.vocals, { recursive: true });
    fs.mkdirSync(this.paths.subtitles, { recursive: true });
    fs.mkdirSync(this.paths.chunks, { recursive: true });
    fs.mkdirSync(this.paths.output, { recursive: true });

    return this.paths;
  }

  public getPaths(): MediaSandboxPaths {
    return this.paths;
  }

  /**
   * Write an intermediate artifact with containment and budget checks
   */
  public saveArtifact(category: keyof Omit<MediaSandboxPaths, 'root'>, filename: string, data: Buffer | string): string {
    if (this.isDestroyed) {
      throw new Error('Media sandbox has been destroyed.');
    }

    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
      throw new Error(`Invalid artifact filename '${filename}': Path traversal is prohibited.`);
    }

    const safeName = path.basename(filename);
    const targetDir = this.paths[category];
    const targetPath = path.join(targetDir, safeName);
    const resolved = path.resolve(targetPath);

    if (!resolved.startsWith(path.resolve(targetDir))) {
      throw new Error(`Artifact path '${filename}' attempts to escape media sandbox.`);
    }

    const byteLength = Buffer.isBuffer(data) ? data.byteLength : Buffer.byteLength(data, 'utf8');
    const currentSize = this.getTotalDiskUsage();

    if (currentSize + byteLength > this.maxDiskBytes) {
      throw new Error(`Media localization exceeds disk budget of ${this.maxDiskBytes} bytes.`);
    }

    fs.writeFileSync(resolved, data);
    return resolved;
  }

  /**
   * Calculate total disk usage inside the sandbox
   */
  public getTotalDiskUsage(): number {
    return this.calculateDirectorySize(this.paths.root);
  }

  private calculateDirectorySize(dirPath: string): number {
    if (!fs.existsSync(dirPath)) return 0;
    let total = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          total += this.calculateDirectorySize(full);
        } else if (entry.isFile()) {
          const stat = fs.statSync(full);
          total += stat.size;
        }
      }
    } catch {
      // Ignore transient access errors
    }
    return total;
  }

  /**
   * Cleanup and remove all ephemeral media files
   */
  public async cleanup(): Promise<void> {
    this.isDestroyed = true;
    if (fs.existsSync(this.paths.root)) {
      try {
        fs.rmSync(this.paths.root, { recursive: true, force: true });
      } catch {
        // Fallback retry
        try {
          await new Promise(r => setTimeout(r, 100));
          if (fs.existsSync(this.paths.root)) {
            fs.rmSync(this.paths.root, { recursive: true, force: true });
          }
        } catch {
          // Finished
        }
      }
    }
  }
}
