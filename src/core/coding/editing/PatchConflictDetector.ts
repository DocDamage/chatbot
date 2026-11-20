import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { EditOperation } from '../types';
import { isSensitiveWorkspacePath } from '../security/WorkspacePathPolicy';
import { WorkspaceFilePolicy } from '../security/WorkspaceFilePolicy';

export class PatchConflictDetector {
  constructor(private readonly workspaceRoot: string, private readonly filePolicy?: WorkspaceFilePolicy) {}

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
    if (isSensitiveWorkspacePath(relative, this.filePolicy?.kind)) throw new Error('Sensitive credential paths cannot be edited');
    if (this.filePolicy && !this.filePolicy.canEditText(relative.replace(/\\/g, '/'))) throw new Error('File role requires a dedicated operation; generic text editing is forbidden');
    if (this.filePolicy) {
      let current = root;
      for (const part of relative.split(path.sep)) {
        current = path.join(current, part);
        if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Project text edits cannot traverse links');
      }
    }
    const rootReal = fs.realpathSync(root);
    let existing = absolute;
    while (!fs.existsSync(existing) && existing !== path.dirname(existing)) existing = path.dirname(existing);
    const realTarget = fs.realpathSync(existing);
    if (realTarget !== rootReal && !realTarget.startsWith(`${rootReal}${path.sep}`)) throw new Error('Path resolves through a symlink outside the workspace');
    return absolute;
  }

  hash(content: Buffer | string): string { return crypto.createHash('sha256').update(content).digest('hex'); }
}
