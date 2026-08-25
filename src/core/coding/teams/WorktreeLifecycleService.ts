/**
 * Isolated Worktree Lifecycle Service (CF-05)
 * Manages isolated worktree sandboxes for mutation workers (implementer, test_author).
 * Guarantees that concurrent workers cannot read/write outside their sandbox,
 * corrupt the primary checkout, or escape path containment.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../../observability/logger';
import { TaskEnvelope } from './TaskEnvelope';

export class WorktreeContainmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorktreeContainmentError';
  }
}

export interface WorktreeInstance {
  taskId: string;
  workerId: string;
  worktreePath: string;
  createdAt: number;
  maxDiskBytes: number;
  scopes: string[];
  isGitWorktree?: boolean;
}

export interface FileMutationRecord {
  path: string;
  operation: 'create' | 'modify' | 'delete';
  content?: string;
  previousContent?: string;
  hash: string;
}

export class WorktreeLifecycleService {
  private baseDir: string;
  private activeWorktrees = new Map<string, WorktreeInstance>();
  private baselines = new Map<string, Map<string, { content: string; hash: string }>>();
  private useNativeGit: boolean;

  constructor(options: { baseDir?: string; useNativeGit?: boolean } = {}) {
    this.baseDir = options.baseDir || path.join(process.cwd(), '.worktrees');
    this.useNativeGit = options.useNativeGit ?? false;
  }

  /**
   * Initialize a new isolated worktree for a task
   */
  async createWorktree(envelope: TaskEnvelope, workerId: string): Promise<WorktreeInstance> {
    if (this.activeWorktrees.has(envelope.taskId)) {
      return this.activeWorktrees.get(envelope.taskId)!;
    }

    const worktreePath = path.join(this.baseDir, `wt-${envelope.taskId}`);
    let isGitWorktree = false;

    if (this.useNativeGit) {
      try {
        const { execSync } = await import('child_process');
        if (!fs.existsSync(this.baseDir)) {
          fs.mkdirSync(this.baseDir, { recursive: true });
        }
        execSync(`git worktree add --detach "${worktreePath}" HEAD`, {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
        isGitWorktree = true;
      } catch (err) {
        logger.debug('Native git worktree creation fallback to directory sandbox', { taskId: envelope.taskId });
        if (!fs.existsSync(worktreePath)) {
          fs.mkdirSync(worktreePath, { recursive: true });
        }
      }
    } else {
      if (!fs.existsSync(worktreePath)) {
        fs.mkdirSync(worktreePath, { recursive: true });
      }
    }

    const instance: WorktreeInstance = {
      taskId: envelope.taskId,
      workerId,
      worktreePath,
      createdAt: Date.now(),
      maxDiskBytes: envelope.budget.maxDiskBytes ?? 50 * 1024 * 1024,
      scopes: envelope.authority.allowedScopes || ['*'],
      isGitWorktree
    };

    this.activeWorktrees.set(envelope.taskId, instance);

    const initialBaseline = new Map<string, { content: string; hash: string }>();
    if (isGitWorktree && fs.existsSync(worktreePath)) {
      const initialFiles = this.listFiles(envelope.taskId);
      for (const file of initialFiles) {
        try {
          const fullPath = path.join(worktreePath, file);
          const content = fs.readFileSync(fullPath, 'utf8');
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          initialBaseline.set(file, { content, hash });
        } catch {
          // Ignore files that cannot be represented in the text mutation baseline.
        }
      }
    }
    this.baselines.set(envelope.taskId, initialBaseline);

    logger.info('Created isolated worktree', { taskId: envelope.taskId, workerId, worktreePath, isGitWorktree });
    return instance;
  }

  /**
   * Safely resolve and validate a relative path within the worktree boundary.
   * Throws WorktreeContainmentError if the path escapes the worktree or violates task scope.
   */
  resolveSafePath(taskId: string, relativePath: string): string {
    const instance = this.activeWorktrees.get(taskId);
    if (!instance) {
      throw new WorktreeContainmentError(`No active worktree found for task ${taskId}`);
    }

    if (!relativePath || typeof relativePath !== 'string') {
      throw new WorktreeContainmentError('Target path must be a non-empty string');
    }

    // Reject null bytes
    if (relativePath.includes('\0')) {
      throw new WorktreeContainmentError('Null bytes are prohibited in paths');
    }

    const absolute = path.resolve(instance.worktreePath, relativePath);
    const rootRel = path.relative(instance.worktreePath, absolute);

    // Escape check
    if (rootRel.startsWith('..') || path.isAbsolute(rootRel)) {
      throw new WorktreeContainmentError(`Path escape attempt detected: '${relativePath}' is outside worktree boundary`);
    }

    // Git directory protection
    if (rootRel === '.git' || rootRel.startsWith(`.git${path.sep}`) || rootRel.startsWith('.git/')) {
      throw new WorktreeContainmentError('Direct mutation of .git metadata is prohibited');
    }

    // Scope check if specific scopes provided
    if (!this.matchesScope(rootRel, instance.scopes)) {
      throw new WorktreeContainmentError(
        `Path '${rootRel}' is not allowed by task envelope scope [${instance.scopes.join(', ')}]`
      );
    }

    // Resolve the target or its nearest existing parent. This catches writes to
    // a new file through a symlinked directory, not only existing targets.
    const realRoot = fs.realpathSync(instance.worktreePath);
    let existingAncestor = absolute;
    while (!fs.existsSync(existingAncestor) && existingAncestor !== instance.worktreePath) {
      existingAncestor = path.dirname(existingAncestor);
    }
    const realAncestor = fs.realpathSync(existingAncestor);
    const realRel = path.relative(realRoot, realAncestor);
    if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
      throw new WorktreeContainmentError(`Symlink escape detected pointing outside worktree boundary: ${relativePath}`);
    }

    return absolute;
  }

  /**
   * Write file inside isolated worktree
   */
  writeFile(taskId: string, relativePath: string, content: string | Buffer): void {
    const safePath = this.resolveSafePath(taskId, relativePath);
    const instance = this.activeWorktrees.get(taskId)!;

    // Check disk usage limits
    const currentSize = this.getWorktreeDiskUsage(instance.worktreePath);
    const incomingSize = typeof content === 'string' ? Buffer.byteLength(content) : content.length;
    const existingSize = fs.existsSync(safePath) && fs.statSync(safePath).isFile() ? fs.statSync(safePath).size : 0;
    if (currentSize - existingSize + incomingSize > instance.maxDiskBytes) {
      throw new WorktreeContainmentError(
        `Worktree disk budget exceeded: limit is ${instance.maxDiskBytes} bytes`
      );
    }

    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(safePath, content);
  }

  /**
   * Read file inside isolated worktree
   */
  readFile(taskId: string, relativePath: string): string {
    const safePath = this.resolveSafePath(taskId, relativePath);
    if (!fs.existsSync(safePath)) {
      throw new WorktreeContainmentError(`File not found: ${relativePath}`);
    }
    return fs.readFileSync(safePath, 'utf8');
  }

  /**
   * Delete file inside isolated worktree
   */
  deleteFile(taskId: string, relativePath: string): void {
    const safePath = this.resolveSafePath(taskId, relativePath);
    if (fs.existsSync(safePath)) {
      fs.unlinkSync(safePath);
    }
  }

  /**
   * Seed a baseline file into the isolated worktree
   */
  seedFile(taskId: string, relativePath: string, content: string | Buffer): void {
    this.writeFile(taskId, relativePath, content);
    const normalized = relativePath.replace(/\\/g, '/');
    const text = Buffer.isBuffer(content) ? content.toString('utf8') : content;
    this.baselines.get(taskId)?.set(normalized, {
      content: text,
      hash: crypto.createHash('sha256').update(text).digest('hex')
    });
  }

  /**
   * Seed multiple baseline files from the real workspace root into the isolated worktree
   */
  seedFromWorkspace(taskId: string, workspaceRoot: string, relativePaths: string[]): void {
    for (const rel of relativePaths) {
      const srcPath = path.resolve(workspaceRoot, rel);
      const sourceRel = path.relative(path.resolve(workspaceRoot), srcPath);
      if (sourceRel.startsWith('..') || path.isAbsolute(sourceRel)) {
        throw new WorktreeContainmentError(`Workspace seed path escapes source root: '${rel}'`);
      }
      if (fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
        const content = fs.readFileSync(srcPath);
        this.seedFile(taskId, rel, content);
      }
    }
  }

  /**
   * List files inside isolated worktree
   */
  listFiles(taskId: string): string[] {
    const instance = this.activeWorktrees.get(taskId);
    if (!instance || !fs.existsSync(instance.worktreePath)) {
      return [];
    }

    const files: string[] = [];
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(instance.worktreePath, full).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          files.push(rel);
        }
      }
    };

    walk(instance.worktreePath);
    return files.sort();
  }

  /**
   * Collect all file mutations made in the worktree
   */
  getMutations(taskId: string): FileMutationRecord[] {
    const instance = this.activeWorktrees.get(taskId);
    if (!instance || !fs.existsSync(instance.worktreePath)) {
      return [];
    }

    const files = this.listFiles(taskId);
    const baseline = this.baselines.get(taskId) || new Map();
    const mutations: FileMutationRecord[] = files.flatMap(file => {
      const fullPath = path.join(instance.worktreePath, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const previous = baseline.get(file);
      if (previous?.hash === hash) return [];
      return [{
        path: file,
        operation: previous ? 'modify' as const : 'create' as const,
        content,
        previousContent: previous?.content,
        hash
      }];
    });
    for (const [file, previous] of baseline.entries()) {
      if (!files.includes(file)) {
        mutations.push({
          path: file,
          operation: 'delete',
          previousContent: previous.content,
          hash: crypto.createHash('sha256').update('').digest('hex')
        });
      }
    }
    return mutations.sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Destroy and clean up worktree
   */
  cleanup(taskId: string): void {
    const instance = this.activeWorktrees.get(taskId);
    if (instance) {
      this.activeWorktrees.delete(taskId);
      this.baselines.delete(taskId);

      if (instance.isGitWorktree) {
        try {
          const { execSync } = require('child_process');
          execSync(`git worktree remove --force "${instance.worktreePath}"`, {
            cwd: process.cwd(),
            stdio: 'pipe'
          });
          execSync('git worktree prune', {
            cwd: process.cwd(),
            stdio: 'pipe'
          });
        } catch {
          // Fall back to filesystem deletion
        }
      }

      if (fs.existsSync(instance.worktreePath)) {
        try {
          fs.rmSync(instance.worktreePath, { recursive: true, force: true });
        } catch (err: any) {
          logger.warn('Failed to clean up worktree directory', { path: instance.worktreePath, error: err.message });
        }
      }
    }
  }

  /**
   * Clean up all active worktrees
   */
  cleanupAll(): void {
    for (const taskId of Array.from(this.activeWorktrees.keys())) {
      this.cleanup(taskId);
    }
  }

  private matchesScope(fileRel: string, scopes: string[]): boolean {
    if (scopes.includes('*') || scopes.length === 0) return true;
    const normalized = fileRel.replace(/\\/g, '/');
    return scopes.some(scope => {
      const normScope = scope.replace(/\\/g, '/');
      if (normScope === '*' || normScope === normalized) return true;
      if (normScope.endsWith('/**')) {
        const prefix = normScope.slice(0, -3);
        return normalized.startsWith(prefix);
      }
      const trimmedScope = normScope.replace(/\/$/, '');
      return normalized === trimmedScope || normalized.startsWith(`${trimmedScope}/`);
    });
  }

  private getWorktreeDiskUsage(dir: string): number {
    if (!fs.existsSync(dir)) return 0;
    let total = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += this.getWorktreeDiskUsage(full);
      } else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {
          // Ignore transient errors
        }
      }
    }
    return total;
  }
}
