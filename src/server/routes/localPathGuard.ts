import fs from 'node:fs';
import path from 'node:path';
import { ValidationError } from '../../utils/errors';

export function resolveWorkspacePath(
  workspaceRoot: string,
  requestedPath: string,
  options: { label?: string; mustExist?: boolean; kind?: 'file' | 'directory' } = {}
): string {
  if (typeof requestedPath !== 'string' || !requestedPath.trim()) {
    throw new ValidationError(`${options.label || 'path'} is required`);
  }

  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedPath = path.resolve(resolvedRoot, requestedPath);
  if (isOutside(resolvedRoot, resolvedPath)) {
    throw new ValidationError(`${options.label || 'path'} must stay within the configured workspace root`);
  }

  if (fs.existsSync(resolvedRoot)) {
    const realRoot = fs.realpathSync.native(resolvedRoot);
    let existingAncestor = resolvedPath;
    while (!fs.existsSync(existingAncestor) && existingAncestor !== resolvedRoot) {
      existingAncestor = path.dirname(existingAncestor);
    }
    if (isOutside(realRoot, fs.realpathSync.native(existingAncestor))) {
      throw new ValidationError(`${options.label || 'path'} resolves through a link outside the configured workspace root`);
    }
  }

  if (options.mustExist && !fs.existsSync(resolvedPath)) {
    throw new ValidationError(`${options.label || 'path'} does not exist`);
  }
  if (options.kind && fs.existsSync(resolvedPath)) {
    const stats = fs.statSync(resolvedPath);
    if (options.kind === 'file' && !stats.isFile()) {
      throw new ValidationError(`${options.label || 'path'} must identify a file`);
    }
    if (options.kind === 'directory' && !stats.isDirectory()) {
      throw new ValidationError(`${options.label || 'path'} must identify a directory`);
    }
  }

  return resolvedPath;
}

function isOutside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative.startsWith('..') || path.isAbsolute(relative);
}
