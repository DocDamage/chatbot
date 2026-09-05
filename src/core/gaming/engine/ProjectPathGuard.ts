import fs from 'node:fs';
import path from 'node:path';
import { GameEngineError } from './GameEngineTypes';

export function resolveProjectPath(projectRoot: string, requestedPath: string): string {
  const resolvedRoot = path.resolve(projectRoot);
  const resolvedPath = path.resolve(resolvedRoot, requestedPath);
  if (isOutside(resolvedRoot, resolvedPath)) {
    throw new GameEngineError(
      'OUT_OF_BOUNDS_PATH',
      `Path '${requestedPath}' is outside the connected engine project`,
      { requestedPath, projectRoot: resolvedRoot }
    );
  }

  if (fs.existsSync(resolvedRoot)) {
    const realRoot = fs.realpathSync.native(resolvedRoot);
    let existingAncestor = resolvedPath;
    while (!fs.existsSync(existingAncestor) && existingAncestor !== resolvedRoot) {
      existingAncestor = path.dirname(existingAncestor);
    }
    if (isOutside(realRoot, fs.realpathSync.native(existingAncestor))) {
      throw new GameEngineError(
        'OUT_OF_BOUNDS_PATH',
        `Path '${requestedPath}' resolves through a link outside the connected engine project`,
        { requestedPath, projectRoot: resolvedRoot }
      );
    }
  }

  return resolvedPath;
}

function isOutside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative.startsWith('..') || path.isAbsolute(relative);
}
