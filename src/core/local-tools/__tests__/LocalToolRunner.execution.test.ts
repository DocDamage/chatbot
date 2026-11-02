import fs from 'fs';
import os from 'os';
import path from 'path';
import { LocalToolRunner, cancelLocalToolRun } from '../LocalToolRunner';

describe('RT-NATIVE-002 / RT-TOOL-002: LocalToolRunner Process Execution and Sandbox Suite', () => {
  let tempDir: string;
  let runner: LocalToolRunner;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-tool-runner-test-'));
    runner = new LocalToolRunner();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('validates executable path existence, null bytes, and arg constraints', async () => {
    // 1. Missing executable path
    await expect(runner.run({
      runId: 'run-1',
      executablePath: '   ',
      args: [],
      cwd: tempDir,
      riskLevel: 'low'
    })).rejects.toThrow('Executable path is required');

    // 2. Null byte in path
    await expect(runner.run({
      runId: 'run-2',
      executablePath: `node\0evil`,
      args: [],
      cwd: tempDir,
      riskLevel: 'low'
    })).rejects.toThrow('contains a null byte');

    // 3. Non-existent path
    await expect(runner.run({
      runId: 'run-3',
      executablePath: path.join(tempDir, 'non-existent-binary'),
      args: [],
      cwd: tempDir,
      riskLevel: 'low'
    })).rejects.toThrow('Executable does not exist');

    // 4. Argument constraints
    const realNode = process.execPath;
    await expect(runner.run({
      runId: 'run-4',
      executablePath: realNode,
      args: [`arg\0null`],
      cwd: tempDir,
      riskLevel: 'low'
    })).rejects.toThrow('argument contains a null byte');

    await expect(runner.run({
      runId: 'run-5',
      executablePath: realNode,
      args: ['a'.repeat(9000)],
      cwd: tempDir,
      riskLevel: 'low'
    })).rejects.toThrow('argument is too long');
  });

  it('executes a command successfully, saves output artifacts, and records duration', async () => {
    const runId = 'run-success-test';
    const result = await runner.run({
      runId,
      executablePath: process.execPath,
      args: ['-e', 'console.log("Hello from local tool"); console.error("Standard warning");'],
      cwd: tempDir,
      riskLevel: 'low',
      outputRoot: tempDir
    });

    expect(result.status).toBe('completed');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Hello from local tool');
    expect(result.stderr).toContain('Standard warning');
    expect(fs.existsSync(result.stdoutPath)).toBe(true);
    expect(fs.existsSync(result.stderrPath)).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('handles non-zero exit codes, timeouts, and cancellation', async () => {
    // 1. Non-zero exit code
    const failRes = await runner.run({
      runId: 'run-fail-test',
      executablePath: process.execPath,
      args: ['-e', 'process.exit(42);'],
      cwd: tempDir,
      riskLevel: 'low',
      outputRoot: tempDir
    });
    expect(failRes.status).toBe('failed');
    expect(failRes.exitCode).toBe(42);
    expect(failRes.error).toContain('exited with code 42');

    // 2. Timeout handling
    const timeoutRes = await runner.run({
      runId: 'run-timeout-test',
      executablePath: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 50000);'],
      cwd: tempDir,
      riskLevel: 'low',
      timeoutMs: 100,
      outputRoot: tempDir
    });
    expect(timeoutRes.status).toBe('timed_out');
    expect(timeoutRes.error).toContain('timed out after 100ms');

    // 3. Cancellation test
    const cancelPromise = runner.run({
      runId: 'run-cancel-test',
      executablePath: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 30000);'],
      cwd: tempDir,
      riskLevel: 'high',
      outputRoot: tempDir
    });

    // Allow process to spawn
    await new Promise(r => setTimeout(r, 50));
    const wasCancelled = cancelLocalToolRun('run-cancel-test');
    expect(wasCancelled).toBe(true);

    const cancelRes = await cancelPromise;
    expect(cancelRes.status === 'cancelled' || cancelRes.status === 'failed').toBe(true);

    // Cancel non-existent run
    expect(cancelLocalToolRun('non-existent-run')).toBe(false);
  });
});
