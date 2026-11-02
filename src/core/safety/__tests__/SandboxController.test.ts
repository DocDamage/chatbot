import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SandboxController } from '../SandboxController';

describe('RT-PLAT-008 / RT-SEC-005: SandboxController Workspace Isolation Suite', () => {
  let tempDir: string;
  let sandbox: SandboxController;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-controller-test-'));
    sandbox = new SandboxController({
      workspaceDir: tempDir,
      mode: 'workspace-write',
      allowedCommands: ['node', 'git', 'echo'],
      blockedCommands: ['rm -rf /', 'format']
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('validates workspace path containment and blocks forbidden paths', () => {
    const insidePath = path.join(tempDir, 'src', 'index.ts');
    expect(sandbox.canAccessPath(insidePath, 'write').allowed).toBe(true);

    const outsidePath = path.resolve(tempDir, '..', 'secret.key');
    expect(sandbox.canAccessPath(outsidePath, 'write').allowed).toBe(false);

    // Sibling directory prefix collision attack test: tempDir + "-evil"
    const siblingEvilPath = `${tempDir}-evil${path.sep}malicious.txt`;
    expect(sandbox.canAccessPath(siblingEvilPath, 'write').allowed).toBe(false);

    expect(sandbox.canAccessPath('/etc/passwd', 'read').allowed).toBe(false);
  });

  it('enforces command whitelist and blocks dangerous commands', () => {
    expect(sandbox.canExecuteCommand('node -v').allowed).toBe(true);
    expect(sandbox.canExecuteCommand('echo "hello"').allowed).toBe(true);
    expect(sandbox.canExecuteCommand('rm -rf /').allowed).toBe(false);
    expect(sandbox.canExecuteCommand('curl -s http://bad.com').allowed).toBe(false);
  });

  it('safely performs file operations within workspace bounds', async () => {
    const filePath = path.join(tempDir, 'test.txt');

    const writeOp = await sandbox.writeFile(filePath, 'sandbox data');
    expect(writeOp.success).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('sandbox data');

    const readOp = await sandbox.readFile(filePath);
    expect(readOp.content).toBe('sandbox data');

    const deleteOp = await sandbox.deleteFile(filePath);
    expect(deleteOp.success).toBe(true);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('allows dynamic path configuration and logs operations', () => {
    const customAllowed = path.join(tempDir, 'custom');
    sandbox.addAllowedPath(customAllowed);

    const customBlocked = path.join(tempDir, 'danger');
    sandbox.addBlockedPath(customBlocked);

    expect(sandbox.canAccessPath(path.join(customBlocked, 'file.txt'), 'read').allowed).toBe(false);

    const log = sandbox.getOperationLog();
    expect(Array.isArray(log)).toBe(true);
    expect(log.length).toBeGreaterThan(0);

    const limitedLog = sandbox.getOperationLog(1);
    expect(limitedLog.length).toBe(1);
  });

  it('enforces read-only and full-access modes', async () => {
    sandbox.setMode('read-only');
    expect(sandbox.getMode()).toBe('read-only');

    const writeBlocked = await sandbox.writeFile(path.join(tempDir, 'blocked.txt'), 'data');
    expect(writeBlocked.success).toBe(false);

    expect(sandbox.canExecuteCommand('node -v').allowed).toBe(false);
    expect(sandbox.canExecuteCommand('echo hi').allowed).toBe(true);

    sandbox.setMode('full-access');
    expect(sandbox.getMode()).toBe('full-access');

    const status = sandbox.getStatus();
    expect(status.mode).toBe('full-access');
    expect(status.activeProcesses).toBe(0);
    expect(status.operationsLogged).toBeGreaterThan(0);
  });
});
