import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export type FileSearchKind = 'name' | 'content' | 'both';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface FileReadResult {
  path: string;
  content: string;
  language: string;
  size: number;
  startLine: number;
  endLine: number;
  checksum: string;
  modifiedTime: string;
}

const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'coverage', '.next', 'build', '.worktrees']);
const secretNames = new Set(['.env', '.env.local', '.env.development', '.env.production']);
const previewExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.css', '.html', '.yml', '.yaml']);

export class FileExplorerService {
  constructor(
    private readonly workspaceRoot = process.cwd(),
    private readonly maxBytes = 256 * 1024,
    private readonly maxLines = 500
  ) {}

  async getTree(root = '.', maxDepth = 4): Promise<FileTreeNode> {
    const absolute = this.resolveSafe(root);
    const stats = await fs.stat(absolute);
    if (!stats.isDirectory()) {
      throw new Error('Tree root must be a directory');
    }
    return this.buildTree(absolute, Math.max(0, maxDepth));
  }

  async search(query: string, kind: FileSearchKind = 'both'): Promise<Array<{ path: string; type: 'file'; match: string }>> {
    const lower = query.toLowerCase();
    const files = await this.listFiles(this.workspaceRoot, 1000);
    const results: Array<{ path: string; type: 'file'; match: string }> = [];
    for (const file of files) {
      const relative = this.relative(file);
      if ((kind === 'name' || kind === 'both') && relative.toLowerCase().includes(lower)) {
        results.push({ path: relative, type: 'file', match: 'name' });
        continue;
      }
      if ((kind === 'content' || kind === 'both') && this.isPreviewable(relative)) {
        const content = await fs.readFile(file, 'utf8').catch(() => '');
        if (content.toLowerCase().includes(lower)) {
          results.push({ path: relative, type: 'file', match: 'content' });
        }
      }
      if (results.length >= 50) break;
    }
    return results;
  }

  async readFile(workspacePath: string, startLine?: number, endLine?: number): Promise<FileReadResult> {
    const absolute = this.resolveSafe(workspacePath);
    this.assertNotSecret(absolute);
    const stats = await fs.stat(absolute);
    if (!stats.isFile()) throw new Error('Path is not a file');
    if (stats.size > this.maxBytes) throw new Error('File exceeds preview size limit');
    if (!this.isPreviewable(workspacePath)) throw new Error('File type is not previewable');

    const content = await fs.readFile(absolute, 'utf8');
    const lines = content.split(/\r?\n/);
    const start = Math.max(1, startLine || 1);
    const end = Math.min(lines.length, endLine || Math.min(lines.length, start + this.maxLines - 1));
    if (end - start + 1 > this.maxLines) throw new Error('Line range exceeds preview limit');
    const selected = lines.slice(start - 1, end).join('\n');

    return {
      path: this.relative(absolute),
      content: selected,
      language: this.languageFor(workspacePath),
      size: stats.size,
      startLine: start,
      endLine: end,
      checksum: crypto.createHash('sha1').update(content).digest('hex'),
      modifiedTime: stats.mtime.toISOString()
    };
  }

  async metadata(workspacePath: string) {
    const absolute = this.resolveSafe(workspacePath);
    const stats = await fs.stat(absolute);
    const relative = this.relative(absolute);
    return {
      path: relative,
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      extension: path.extname(relative),
      modifiedTime: stats.mtime.toISOString(),
      previewable: stats.isFile() && this.isPreviewable(relative) && !this.isSecretPath(relative)
    };
  }

  async loadIntoChat(items: Array<{ path: string; startLine?: number; endLine?: number }>) {
    return Promise.all(items.map(item => this.readFile(item.path, item.startLine, item.endLine)));
  }

  private async buildTree(absolute: string, depth: number): Promise<FileTreeNode> {
    const stats = await fs.stat(absolute);
    const node: FileTreeNode = {
      name: path.basename(absolute) || path.basename(this.workspaceRoot),
      path: this.relative(absolute) || '.',
      type: stats.isDirectory() ? 'directory' : 'file'
    };
    if (!stats.isDirectory() || depth === 0) return node;
    const entries = await fs.readdir(absolute, { withFileTypes: true });
    node.children = [];
    for (const entry of entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name)).slice(0, 200)) {
      if (this.shouldIgnore(entry.name)) continue;
      node.children.push(await this.buildTree(path.join(absolute, entry.name), depth - 1));
    }
    return node;
  }

  private async listFiles(root: string, maxFiles: number): Promise<string[]> {
    const results: string[] = [];
    const walk = async (current: string) => {
      if (results.length >= maxFiles) return;
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxFiles || this.shouldIgnore(entry.name)) continue;
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) await walk(absolute);
        else if (!this.isSecretPath(this.relative(absolute))) results.push(absolute);
      }
    };
    await walk(root);
    return results;
  }

  private resolveSafe(workspacePath: string): string {
    const absolute = path.resolve(this.workspaceRoot, workspacePath || '.');
    const root = path.resolve(this.workspaceRoot);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
      throw new Error('Path resolves outside workspace');
    }
    return absolute;
  }

  private assertNotSecret(absolute: string): void {
    if (this.isSecretPath(this.relative(absolute))) {
      throw new Error('Secret files are not previewable');
    }
  }

  private shouldIgnore(name: string): boolean {
    return ignoredDirs.has(name) || secretNames.has(name);
  }

  private isSecretPath(workspacePath: string): boolean {
    return workspacePath.split(/[\\/]/).some(part => secretNames.has(part) || /^\.env/.test(part));
  }

  private isPreviewable(workspacePath: string): boolean {
    return previewExtensions.has(path.extname(workspacePath).toLowerCase());
  }

  private languageFor(workspacePath: string): string {
    const ext = path.extname(workspacePath).replace('.', '');
    return ext || 'text';
  }

  private relative(absolute: string): string {
    return path.relative(this.workspaceRoot, absolute).replace(/\\/g, '/');
  }
}
