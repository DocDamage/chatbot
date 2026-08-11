import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { EditOperation } from '../types';
import { isSensitiveWorkspacePath } from '../security/WorkspacePathPolicy';

export class PatchConflictDetector {
  constructor(private readonly workspaceRoot: string) {}

  check(operation: EditOperation): { ok: true } | { ok: false; reason: string } {
    const absolute = this.safe(operation.path);
    const exists = fs.existsSync(absolute);
    if (operation.operation === 'create' && exists) return { ok: false, reason: 'File already exists' };
    if (operation.operation !== 'create' && !exists) return { ok: false, reason: 'File does not exist' };
    if (operation.expectedHash && exists && this.hash(fs.readFileSync(absolute)) !== operation.expectedHash) return { ok: false, reason: 'File changed since the expected hash was captured' };
    if (operation.expectedContent !== undefined && exists && fs.readFileSync(absolute, 'utf8') !== operation.expectedContent) return { ok: false, reason: 'File content no longer matches the edit precondition' };
    return { ok: true };
  }

  safe(file: string): string {
    const root = path.resolve(this.workspaceRoot);
    const absolute = path.resolve(root, file);
    const relative = path.relative(root, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Path is outside workspace: ${file}`);
    if (relative === '.git' || relative.startsWith(`.git${path.sep}`)) throw new Error('Git metadata cannot be edited');
    if (isSensitiveWorkspacePath(relative)) throw new Error('Sensitive credential paths cannot be edited');
    const rootReal = fs.realpathSync(root);
    const existing = fs.existsSync(absolute) ? absolute : path.dirname(absolute);
    const realTarget = fs.realpathSync(existing);
    if (realTarget !== rootReal && !realTarget.startsWith(`${rootReal}${path.sep}`)) throw new Error('Path resolves through a symlink outside the workspace');
    return absolute;
  }

  hash(content: Buffer | string): string { return crypto.createHash('sha256').update(content).digest('hex'); }
}
