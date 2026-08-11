import { spawn } from 'child_process';
import { BuildCommandPlan } from '../repository/BuildSystemDetector';

export interface CapabilityRun { command: string; argv: string[]; exitCode: number | null; stdout: string; stderr: string; durationMs: number; status: 'passed' | 'failed' | 'timed_out' | 'blocked'; reason?: string; }

export class CommandCapabilityRunner {
  constructor(private readonly cwd: string, private readonly timeoutMs = 120000, private readonly maxOutputBytes = 1024 * 1024) {}

  async run(plan: BuildCommandPlan): Promise<CapabilityRun> {
    const start = Date.now();
    if (!plan.supported) return { command: plan.executable, argv: plan.argv, exitCode: null, stdout: '', stderr: '', durationMs: 0, status: 'blocked', reason: plan.reason || 'Command is not authorized by detected project state' };
    return new Promise(resolve => {
      const child = spawn(this.resolveExecutable(plan.executable), plan.argv, { cwd: this.cwd, shell: false, windowsHide: true, env: process.env });
      let stdout = ''; let stderr = ''; let settled = false;
      const append = (current: string, value: string) => { const next = current + value; return Buffer.byteLength(next) > this.maxOutputBytes ? next.slice(-this.maxOutputBytes) : next; };
      const finish = (result: CapabilityRun) => { if (settled) return; settled = true; clearTimeout(timeout); resolve(result); };
      const timeout = setTimeout(() => { this.stopProcessTree(child.pid); finish({ command: plan.executable, argv: plan.argv, exitCode: null, stdout, stderr, durationMs: Date.now() - start, status: 'timed_out', reason: `Timed out after ${this.timeoutMs}ms` }); }, this.timeoutMs);
      child.stdout?.on('data', chunk => { stdout = append(stdout, chunk.toString()); });
      child.stderr?.on('data', chunk => { stderr = append(stderr, chunk.toString()); });
      child.on('error', error => finish({ command: plan.executable, argv: plan.argv, exitCode: null, stdout, stderr, durationMs: Date.now() - start, status: 'failed', reason: error.message }));
      child.on('close', code => finish({ command: plan.executable, argv: plan.argv, exitCode: code, stdout, stderr, durationMs: Date.now() - start, status: code === 0 ? 'passed' : 'failed' }));
    });
  }

  private resolveExecutable(executable: string): string { return process.platform === 'win32' && ['npm', 'pnpm', 'yarn'].includes(executable) ? `${executable}.cmd` : executable; }

  private stopProcessTree(pid: number | undefined): void {
    if (!pid) return;
    if (process.platform === 'win32') spawn('taskkill.exe', ['/pid', String(pid), '/t', '/f'], { shell: false, windowsHide: true });
    else spawn('kill', ['-TERM', `-${pid}`], { shell: false, windowsHide: true });
  }
}
