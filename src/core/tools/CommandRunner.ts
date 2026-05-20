import { spawn } from 'child_process';
import { logger } from '../observability/logger';

export interface CommandRunResult {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  error?: string;
}

export interface CommandRunnerOptions {
  allowedCommands?: string[];
  timeoutMs?: number;
  maxBufferBytes?: number;
}

export class CommandRunner {
  private allowedCommands: Set<string>;
  private timeoutMs: number;
  private maxBufferBytes: number;

  constructor(
    private readonly cwd: string = process.cwd(),
    options: CommandRunnerOptions = {}
  ) {
    this.allowedCommands = new Set(options.allowedCommands || [
      'npm run type-check',
      'npm run lint',
      'npm test',
      'npm test -- --runInBand',
      'npm run build'
    ]);
    this.timeoutMs = options.timeoutMs || 120000;
    this.maxBufferBytes = options.maxBufferBytes || 1024 * 1024;
  }

  isAllowed(command: string): boolean {
    return this.allowedCommands.has(command.trim());
  }

  async run(command: string): Promise<CommandRunResult> {
    const normalized = command.trim();
    const start = Date.now();

    if (!this.isAllowed(normalized)) {
      return {
        success: false,
        command: normalized,
        stdout: '',
        stderr: '',
        exitCode: null,
        durationMs: Date.now() - start,
        error: `Command not allowed: ${normalized}`
      };
    }

    const [rawExecutable, ...args] = this.splitCommand(normalized);
    const executable = this.resolveExecutable(rawExecutable);

    return new Promise(resolve => {
      let stdout = '';
      let stderr = '';
      let settled = false;

      const child = spawn(executable, args, {
        cwd: this.cwd,
        shell: false,
        windowsHide: true,
        env: process.env
      });

      const finish = (result: CommandRunResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        finish({
          success: false,
          command: normalized,
          stdout,
          stderr,
          exitCode: null,
          durationMs: Date.now() - start,
          error: `Command timed out after ${this.timeoutMs}ms`
        });
      }, this.timeoutMs);

      child.stdout?.on('data', chunk => {
        stdout = this.appendBounded(stdout, chunk.toString());
      });

      child.stderr?.on('data', chunk => {
        stderr = this.appendBounded(stderr, chunk.toString());
      });

      child.on('error', error => {
        clearTimeout(timeout);
        logger.warn('Command execution failed', { command: normalized, error: error.message });
        finish({
          success: false,
          command: normalized,
          stdout,
          stderr,
          exitCode: null,
          durationMs: Date.now() - start,
          error: error.message
        });
      });

      child.on('close', code => {
        clearTimeout(timeout);
        finish({
          success: code === 0,
          command: normalized,
          stdout,
          stderr,
          exitCode: code,
          durationMs: Date.now() - start,
          error: code === 0 ? undefined : `Command exited with code ${code}`
        });
      });
    });
  }

  private appendBounded(current: string, next: string): string {
    const combined = current + next;
    if (Buffer.byteLength(combined) <= this.maxBufferBytes) {
      return combined;
    }
    return combined.slice(-this.maxBufferBytes);
  }

  private splitCommand(command: string): string[] {
    return command.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(part => part.replace(/^"|"$/g, '')) || [];
  }

  private resolveExecutable(executable: string): string {
    if (process.platform === 'win32' && executable === 'npm') {
      return 'npm.cmd';
    }
    return executable;
  }
}
