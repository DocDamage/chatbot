import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const activeRuns = new Map<string, ChildProcess>();

type LocalToolRunFinishInput = Omit<
  LocalToolRunResult,
  'stdout' | 'stderr' | 'stdoutPath' | 'stderrPath' | 'durationMs' | 'outputFiles'
>;

export function cancelLocalToolRun(runId: string): boolean {
  const child = activeRuns.get(runId);
  if (!child) return false;
  child.kill('SIGTERM');
  const killTimer = setTimeout(() => {
    if (activeRuns.has(runId)) {
      child.kill('SIGKILL');
    }
  }, 5000);
  killTimer.unref?.();
  return true;
}

export interface LocalToolRunRequest {
  runId: string;
  executablePath: string;
  args: string[];
  cwd: string;
  riskLevel: string;
  outputRoot?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface LocalToolRunResult {
  runId: string;
  status: 'completed' | 'failed' | 'timed_out' | 'cancelled';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutPath: string;
  stderrPath: string;
  outputFiles: string[];
  durationMs: number;
  error?: string;
}

export class LocalToolRunner {
  async run(request: LocalToolRunRequest): Promise<LocalToolRunResult> {
    const startedAt = Date.now();
    const outputRoot = request.outputRoot || path.join(process.cwd(), 'data', 'local-tool-runs');
    const runDir = path.join(outputRoot, request.runId);
    fs.mkdirSync(runDir, { recursive: true });

    const stdoutPath = path.join(runDir, 'stdout.txt');
    const stderrPath = path.join(runDir, 'stderr.txt');
    const maxOutputBytes = request.maxOutputBytes || 1024 * 1024;
    const timeoutMs = request.timeoutMs || this.timeoutForRisk(request.riskLevel);

    this.validateExecutablePath(request.executablePath);
    this.validateArgs(request.args);

    return new Promise(resolve => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      let cancelRequested = false;

      const finish = (result: LocalToolRunFinishInput) => {
        if (settled) return;
        settled = true;
        activeRuns.delete(request.runId);
        const durationMs = Date.now() - startedAt;
        fs.writeFileSync(stdoutPath, stdout, 'utf8');
        fs.writeFileSync(stderrPath, stderr, 'utf8');
        resolve({
          ...result,
          stdout,
          stderr,
          stdoutPath,
          stderrPath,
          outputFiles: this.listOutputFiles(runDir),
          durationMs
        });
      };

      const child = spawn(request.executablePath, request.args, {
        cwd: request.cwd,
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          CHATBOT_LOCAL_TOOL_RUN_ID: request.runId,
          CHATBOT_LOCAL_TOOL_OUTPUT_DIR: runDir
        }
      });

      activeRuns.set(request.runId, child);
      child.on('exit', (_code, signal) => {
        if (signal === 'SIGTERM' || signal === 'SIGKILL') cancelRequested = true;
      });

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        finish({
          runId: request.runId,
          status: 'timed_out',
          exitCode: null,
          error: `Local tool timed out after ${timeoutMs}ms`
        });
      }, timeoutMs);

      child.stdout?.on('data', chunk => {
        stdout = this.appendBounded(stdout, chunk.toString(), maxOutputBytes);
      });

      child.stderr?.on('data', chunk => {
        stderr = this.appendBounded(stderr, chunk.toString(), maxOutputBytes);
      });

      child.on('error', error => {
        clearTimeout(timeout);
        finish({
          runId: request.runId,
          status: 'failed',
          exitCode: null,
          error: error.message
        });
      });

      child.on('close', code => {
        clearTimeout(timeout);
        if (cancelRequested) {
          finish({
            runId: request.runId,
            status: 'cancelled',
            exitCode: code,
            error: 'Local tool run was cancelled'
          });
          return;
        }
        finish({
          runId: request.runId,
          status: code === 0 ? 'completed' : 'failed',
          exitCode: code,
          error: code === 0 ? undefined : `Local tool exited with code ${code}`
        });
      });
    });
  }

  private validateExecutablePath(executablePath: string): void {
    if (!executablePath.trim()) {
      throw new Error('Executable path is required');
    }
    if (executablePath.includes('\0')) {
      throw new Error('Executable path contains a null byte');
    }
    if (!fs.existsSync(executablePath)) {
      throw new Error(`Executable does not exist: ${executablePath}`);
    }
  }

  private validateArgs(args: string[]): void {
    if (args.length > 200) {
      throw new Error('Too many arguments for local tool run');
    }
    for (const arg of args) {
      if (arg.includes('\0')) {
        throw new Error('Local tool argument contains a null byte');
      }
      if (arg.length > 8192) {
        throw new Error('Local tool argument is too long');
      }
    }
  }

  private timeoutForRisk(riskLevel: string): number {
    switch (riskLevel) {
      case 'high':
        return 10 * 60 * 1000;
      case 'medium':
        return 5 * 60 * 1000;
      default:
        return 2 * 60 * 1000;
    }
  }

  private appendBounded(current: string, next: string, maxBytes: number): string {
    const combined = current + next;
    if (Buffer.byteLength(combined) <= maxBytes) return combined;
    return combined.slice(-maxBytes);
  }

  private listOutputFiles(runDir: string): string[] {
    return fs.readdirSync(runDir)
      .filter(file => fs.statSync(path.join(runDir, file)).isFile())
      .map(file => path.join(runDir, file));
  }
}
