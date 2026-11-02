import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveWorkspacePath } from './localPathGuard';

describe('resolveWorkspacePath', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-path-'));
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('allows in-root paths and rejects lexical and linked escapes', () => {
    const inside = path.join(workspaceRoot, 'inside.txt');
    fs.writeFileSync(inside, 'inside');
    expect(resolveWorkspacePath(workspaceRoot, 'inside.txt', { mustExist: true, kind: 'file' }))
      .toBe(inside);
    expect(() => resolveWorkspacePath(workspaceRoot, '../outside.txt')).toThrow(/workspace root/i);

    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-outside-'));
    const linkedDir = path.join(workspaceRoot, 'linked-outside');
    try {
      fs.writeFileSync(path.join(outsideDir, 'escaped.txt'), 'outside');
      fs.symlinkSync(outsideDir, linkedDir, process.platform === 'win32' ? 'junction' : 'dir');
      expect(() => resolveWorkspacePath(workspaceRoot, 'linked-outside/escaped.txt', { mustExist: true }))
        .toThrow(/link outside/i);
    } finally {
      fs.rmSync(linkedDir, { recursive: true, force: true });
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});
