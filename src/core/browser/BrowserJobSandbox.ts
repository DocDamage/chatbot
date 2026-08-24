/**
 * Browser Job Sandbox & Profile Lifecycle Manager (CF-06)
 *
 * Provides isolated browser profile directories and download sandboxes per job.
 * Enforces download quotas, path traversal restrictions, and clean lifecycle teardown.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BrowserSecurityError } from './AuthorizedBrowserJob';

export interface SandboxPaths {
  profileDir: string;
  downloadDir: string;
  screenshotsDir: string;
}

export class BrowserJobSandbox {
  private readonly jobId: string;
  private readonly baseSandboxDir: string;
  private readonly maxDownloadBytes: number;
  private paths: SandboxPaths;
  private isDestroyed = false;

  constructor(jobId: string, options?: { baseDir?: string; maxDownloadBytes?: number }) {
    this.jobId = jobId;
    this.baseSandboxDir = options?.baseDir || path.resolve(process.cwd(), 'temp', 'browser-sandboxes');
    this.maxDownloadBytes = options?.maxDownloadBytes ?? 25 * 1024 * 1024; // 25MB

    const jobRoot = path.join(this.baseSandboxDir, this.jobId);
    this.paths = {
      profileDir: path.join(jobRoot, 'profile'),
      downloadDir: path.join(jobRoot, 'downloads'),
      screenshotsDir: path.join(jobRoot, 'screenshots')
    };
  }

  /**
   * Initialize isolated directories for profile, downloads, and screenshots
   */
  public async initialize(): Promise<SandboxPaths> {
    if (this.isDestroyed) {
      throw new BrowserSecurityError(`Cannot initialize destroyed sandbox for job ${this.jobId}`);
    }

    fs.mkdirSync(this.paths.profileDir, { recursive: true });
    fs.mkdirSync(this.paths.downloadDir, { recursive: true });
    fs.mkdirSync(this.paths.screenshotsDir, { recursive: true });

    return this.paths;
  }

  /**
   * Get sandbox paths
   */
  public getPaths(): SandboxPaths {
    return this.paths;
  }

  /**
   * Save a downloaded or captured buffer with containment and size checks
   */
  public saveDownload(filename: string, data: Buffer): string {
    if (this.isDestroyed) {
      throw new BrowserSecurityError('Sandbox has already been destroyed.');
    }

    // Path traversal check
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
      throw new BrowserSecurityError(`Download filename '${filename}' attempts path traversal or contains forbidden characters.`);
    }

    const safeName = path.basename(filename);
    if (!safeName || safeName === '.' || safeName === '..') {
      throw new BrowserSecurityError(`Invalid download filename '${filename}'`);
    }

    const targetPath = path.join(this.paths.downloadDir, safeName);
    const resolved = path.resolve(targetPath);

    if (!resolved.startsWith(path.resolve(this.paths.downloadDir))) {
      throw new BrowserSecurityError(`Download path '${filename}' attempts to escape sandbox.`);
    }

    // Check size limit
    const currentSize = this.getDownloadDirectorySize();
    if (currentSize + data.byteLength > this.maxDownloadBytes) {
      throw new BrowserSecurityError(`Download exceeds maximum allowed budget of ${this.maxDownloadBytes} bytes.`);
    }

    fs.writeFileSync(resolved, data);
    return resolved;
  }

  /**
   * Calculate total size of all downloaded files
   */
  public getDownloadDirectorySize(): number {
    if (!fs.existsSync(this.paths.downloadDir)) {
      return 0;
    }
    let total = 0;
    const files = fs.readdirSync(this.paths.downloadDir);
    for (const f of files) {
      const p = path.join(this.paths.downloadDir, f);
      try {
        const stat = fs.statSync(p);
        if (stat.isFile()) {
          total += stat.size;
        }
      } catch {
        // ignore concurrent read issues
      }
    }
    return total;
  }

  /**
   * Clean up all sandbox directories and files
   */
  public async cleanup(): Promise<void> {
    this.isDestroyed = true;
    const jobRoot = path.join(this.baseSandboxDir, this.jobId);
    if (fs.existsSync(jobRoot)) {
      try {
        fs.rmSync(jobRoot, { recursive: true, force: true });
      } catch (err: any) {
        // Fallback retry if locked
        try {
          await new Promise(r => setTimeout(r, 100));
          if (fs.existsSync(jobRoot)) {
            fs.rmSync(jobRoot, { recursive: true, force: true });
          }
        } catch {
          // Log or silently finish
        }
      }
    }
  }
}
