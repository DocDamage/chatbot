import fs from 'fs/promises';
import path from 'path';

export const supportedAudioExtensions = new Set(['.wav', '.mp3', '.flac', '.aiff', '.aif', '.ogg', '.m4a', '.mid', '.midi']);

export interface AudioFileEntry {
  path: string;
  name: string;
  extension: string;
  size: number;
  modifiedTime: string;
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

export class AudioLibraryService {
  constructor(private readonly workspaceRoot = process.cwd()) {}

  async listAudioFiles(root = '.', q = ''): Promise<AudioFileEntry[]> {
    const absoluteRoot = this.resolveSafe(root);
    const files = await this.walk(absoluteRoot, 1000);
    const lower = q.toLowerCase();
    const entries: AudioFileEntry[] = [];
    for (const file of files) {
      const relative = this.relative(file);
      if (lower && !relative.toLowerCase().includes(lower)) continue;
      const stats = await fs.stat(file);
      entries.push({
        path: relative,
        name: path.basename(relative),
        extension: path.extname(relative).toLowerCase(),
        size: stats.size,
        modifiedTime: stats.mtime.toISOString()
      });
    }
    return entries;
  }

  async getMetadata(workspacePath: string): Promise<AudioMetadata> {
    const absolute = this.resolveSafe(workspacePath);
    this.assertAudio(absolute);
    const stats = await fs.stat(absolute);
    const extension = path.extname(absolute).toLowerCase();
    return {
      path: this.relative(absolute),
      name: path.basename(absolute),
      extension,
      format: extension.replace('.', ''),
      size: stats.size,
      modifiedTime: stats.mtime.toISOString(),
      ffmpegAvailable: false,
      notice: 'FFmpeg metadata probing is unavailable; showing filesystem metadata only.'
    };
  }

  getPreviewPath(workspacePath: string): string {
    const absolute = this.resolveSafe(workspacePath);
    this.assertAudio(absolute);
    return absolute;
  }

  async loadIntoChat(items: string[]) {
    return Promise.all(items.map(item => this.getMetadata(item)));
  }

  private async walk(root: string, maxFiles: number): Promise<string[]> {
    const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage', '.next', 'build', '.worktrees']);
    const files: string[] = [];
    const visit = async (current: string) => {
      if (files.length >= maxFiles) return;
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles || ignored.has(entry.name)) continue;
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) await visit(absolute);
        if (entry.isFile() && supportedAudioExtensions.has(path.extname(entry.name).toLowerCase())) files.push(absolute);
      }
    };
    await visit(root);
    return files;
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
}
