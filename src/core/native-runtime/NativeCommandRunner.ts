import { ChildProcess, spawn } from 'node:child_process';

export interface NativeCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface NativeCommandOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  onSpawn?: (child: ChildProcess) => void;
}

export async function runNativeCommand(
  executable: string,
  args: string[],
  options: NativeCommandOptions = {}
): Promise<NativeCommandResult> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    options.onSpawn?.(child);
    let stdout = '';
    let stderr = '';
    const append = (current: string, chunk: Buffer) => `${current}${chunk.toString('utf8')}`.slice(-2_000_000);
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Native command timed out after ${options.timeoutMs || 120_000}ms: ${executable}`));
    }, options.timeoutMs || 120_000);
    timeout.unref();

    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', code => {
      clearTimeout(timeout);
      resolve({ exitCode: code ?? -1, stdout, stderr, durationMs: Date.now() - startedAt });
    });
  });
}
