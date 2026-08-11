import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import { CodingController } from '../coding/CodingController';
import { CodingAgent } from '../agents/CodingAgent';
import { LLMAdapter } from '../providers/LLMAdapter';
import { CodingEvalHarness, CodingEvalScore } from './CodingEvalHarness';

export interface CodingBenchmarkCase { id: string; family: string; language: string; fixture: string; prompt: string; expectedFiles: string[]; expectedSymbols?: string[]; visibleTests: string[]; hiddenChecks: string[]; hiddenTests?: string[]; requiredToolchain: string; expectedReviewFindings?: number; securitySensitive?: boolean; }
export interface CodingBenchmarkManifest { schemaVersion: number; suite: string; toolchainPolicy: string; cases: CodingBenchmarkCase[]; }
export interface CodingBenchmarkCheck { command: string; argv: string[]; status: 'passed' | 'failed' | 'unsupported' | 'timed_out'; exitCode: number | null; stdout: string; stderr: string; }
export interface CodingBenchmarkCaseResult { id: string; fixture: string; toolchain: string; toolchainAvailable: boolean; status: 'ready' | 'unsupported'; reason?: string; fixtureHash: string; checks?: CodingBenchmarkCheck[]; hiddenChecks?: CodingBenchmarkCheck[]; execution?: { executor: 'model-adapter'; worktree: 'isolated'; filesChanged: string[]; patchApplied: boolean; risks: string[] }; inspection?: { affectedFiles: string[]; affectedSymbols: string[]; selectedFiles: string[]; verificationStatus: string; reviewFindingCount: number }; score?: CodingEvalScore; }
export interface CodingBenchmarkReport { mode: 'baseline' | 'upgraded'; suite: string; generatedAt: string; cases: CodingBenchmarkCaseResult[]; }
export interface CodingBenchmarkRunnerOptions { modelAdapter?: LLMAdapter; model?: string; }

export class CodingBenchmarkRunner {
  constructor(private readonly fixturesRoot: string, private readonly options: CodingBenchmarkRunnerOptions = {}) {}

  loadManifest(manifestPath = path.join(this.fixturesRoot, '..', 'manifest.json')): CodingBenchmarkManifest {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as CodingBenchmarkManifest;
  }

  inspect(manifest: CodingBenchmarkManifest, mode: CodingBenchmarkReport['mode']): CodingBenchmarkReport {
    return {
      mode,
      suite: manifest.suite,
      generatedAt: new Date().toISOString(),
      cases: manifest.cases.map(testCase => {
        const fixturePath = path.join(this.fixturesRoot, testCase.fixture);
        const available = this.toolchainAvailable(testCase.requiredToolchain);
        return { id: testCase.id, fixture: testCase.fixture, toolchain: testCase.requiredToolchain, toolchainAvailable: available, status: available ? 'ready' : 'unsupported', reason: available ? undefined : `Toolchain unavailable: ${testCase.requiredToolchain}`, fixtureHash: this.hashFixture(fixturePath) };
      })
    };
  }

  async run(manifest: CodingBenchmarkManifest, mode: CodingBenchmarkReport['mode']): Promise<CodingBenchmarkReport> {
    const report = this.inspect(manifest, mode);
    const scorer = new CodingEvalHarness();
    for (const [index, testCase] of manifest.cases.entries()) {
      if (!report.cases[index].toolchainAvailable) { report.cases[index].checks = []; continue; }
      report.cases[index].checks = [];
      for (const command of testCase.visibleTests) report.cases[index].checks.push(await this.runCheck(command, path.join(this.fixturesRoot, testCase.fixture)));
      report.cases[index].hiddenChecks = [];
      for (const command of testCase.hiddenTests || []) report.cases[index].hiddenChecks.push(await this.runCheck(command, path.join(this.fixturesRoot, testCase.fixture)));
      if (mode === 'upgraded') {
        try {
          const controller = new CodingController(path.join(this.fixturesRoot, testCase.fixture));
          const result = await controller.inspectAndReport(testCase.prompt, { mode: 'plan', runVerification: false });
          const evidence = await controller.retrieveEvidence({ query: testCase.prompt });
          report.cases[index].inspection = {
            affectedFiles: result.task.affectedFiles,
            affectedSymbols: result.task.affectedSymbols,
            selectedFiles: [...new Set(evidence.map(item => item.path).filter((file): file is string => Boolean(file)))],
            verificationStatus: result.verification.status,
            reviewFindingCount: result.review.findings.length
          };
          if (this.options.modelAdapter) await this.executeModelCase(testCase, report.cases[index]);
        } catch (error: any) {
          report.cases[index].reason = `Repository inspection failed: ${error.message}`;
        }
      }
      const checks = report.cases[index].checks || [];
      const visibleChecksPassed = checks.length > 0 && checks.every(check => check.status === 'passed');
      const hiddenChecks = report.cases[index].hiddenChecks || [];
      const hiddenChecksPassed = hiddenChecks.length > 0 && hiddenChecks.every(check => check.status === 'passed');
      const inspection = report.cases[index].inspection;
      const execution = report.cases[index].execution;
      report.cases[index].score = scorer.score({ id: testCase.id, prompt: testCase.prompt, expectedFiles: testCase.expectedFiles, hiddenChecks: testCase.hiddenChecks, requiredVerification: true }, {
        selectedFiles: execution ? [...new Set([...(inspection?.selectedFiles || []), ...execution.filesChanged])] : inspection?.selectedFiles || [],
        selectedSymbols: inspection?.affectedSymbols || [],
        changedFiles: execution?.filesChanged || [],
        buildPassed: visibleChecksPassed,
        testsPassed: visibleChecksPassed,
        hiddenChecksPassed,
        securityFindings: inspection?.reviewFindingCount || 0,
        verificationClaimed: Boolean(execution),
        verificationRecorded: Boolean(execution && (checks.length > 0 || hiddenChecks.length > 0)),
        expectedSymbols: testCase.expectedSymbols,
        securitySensitive: testCase.securitySensitive,
        expectedReviewFindings: testCase.expectedReviewFindings
      });
    }
    return report;
  }

  private toolchainAvailable(executable: string): boolean {
    const command = this.resolveExecutable(executable);
    const result = spawnSync(command, ['--version'], { stdio: 'ignore', shell: false, windowsHide: true });
    return !result.error && result.status === 0;
  }

  private async runCheck(command: string, cwd: string): Promise<CodingBenchmarkCheck> {
    const plan = this.commandPlan(command);
    if (!plan) return { command, argv: [], status: 'unsupported', exitCode: null, stdout: '', stderr: 'No safe argv mapping exists for this fixture command' };
    return new Promise(resolve => {
      const child = spawnSync(plan.executable, plan.argv, { cwd, encoding: 'utf8', shell: false, timeout: 30000, windowsHide: true, maxBuffer: 256 * 1024 });
      if (child.error?.message.includes('ETIMEDOUT')) return resolve({ command, argv: plan.argv, status: 'timed_out', exitCode: null, stdout: child.stdout || '', stderr: child.stderr || child.error.message });
      if (child.error) return resolve({ command, argv: plan.argv, status: 'failed', exitCode: child.status, stdout: child.stdout || '', stderr: child.stderr || child.error.message });
      resolve({ command, argv: plan.argv, status: child.status === 0 ? 'passed' : 'failed', exitCode: child.status, stdout: child.stdout || '', stderr: child.stderr || '' });
    });
  }

  private async executeModelCase(testCase: CodingBenchmarkCase, result: CodingBenchmarkCaseResult): Promise<void> {
    if (!this.options.modelAdapter) return;
    const worktree = this.copyFixtureToTemp(path.join(this.fixturesRoot, testCase.fixture));
    try {
      const agent = new CodingAgent({ workspaceRoot: worktree });
      const generated = await agent.handle({ message: testCase.prompt, model: this.options.model, modelAdapter: this.options.modelAdapter, generatePatch: true, runVerification: false });
      if (!generated.structuredPatch) {
        result.reason = generated.risks.join('; ') || 'Model did not return a structured patch';
        return;
      }
      const authorizedOperations = generated.structuredPatch.operations.map(operation => ({ ...operation, authorized: true }));
      const reviewablePatch = agent.createStructuredPatch(authorizedOperations);
      if (reviewablePatch.conflicts.length) {
        result.execution = { executor: 'model-adapter', worktree: 'isolated', filesChanged: reviewablePatch.filesChanged, patchApplied: false, risks: reviewablePatch.conflicts.map(conflict => `${conflict.path}: ${conflict.reason}`) };
        return;
      }
      agent.applyStructuredPatch(reviewablePatch, 'implement');
      result.execution = { executor: 'model-adapter', worktree: 'isolated', filesChanged: reviewablePatch.filesChanged, patchApplied: true, risks: generated.risks };
      result.checks = [];
      for (const command of testCase.visibleTests) result.checks.push(await this.runCheck(command, worktree));
      result.hiddenChecks = [];
      for (const command of testCase.hiddenTests || []) result.hiddenChecks.push(await this.runCheck(command, worktree));
    } finally {
      fs.rmSync(worktree, { recursive: true, force: true });
    }
  }

  private copyFixtureToTemp(source: string): string {
    const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-benchmark-'));
    fs.cpSync(source, worktree, { recursive: true, filter: candidate => !['target', 'bin', 'obj', 'build', '.pytest_cache', '__pycache__', 'node_modules', '.gradle'].includes(path.basename(candidate)) });
    return worktree;
  }

  private commandPlan(command: string): { executable: string; argv: string[] } | undefined {
    const normalized = command.trim();
    if (normalized === 'cargo test') return { executable: process.platform === 'win32' ? 'cargo.exe' : 'cargo', argv: ['test'] };
    if (normalized === 'cargo test --lib') return { executable: process.platform === 'win32' ? 'cargo.exe' : 'cargo', argv: ['test', '--lib'] };
    if (normalized === 'cargo test --test hidden_validation') return { executable: process.platform === 'win32' ? 'cargo.exe' : 'cargo', argv: ['test', '--test', 'hidden_validation'] };
    if (normalized === 'go test ./...') return { executable: process.platform === 'win32' ? 'go.exe' : 'go', argv: ['test', './...'] };
    if (normalized === 'pytest') return { executable: process.platform === 'win32' ? 'python.exe' : 'python', argv: ['-m', 'pytest'] };
    if (normalized === 'pytest tests/test_cart.py') return { executable: process.platform === 'win32' ? 'python.exe' : 'python', argv: ['-m', 'pytest', 'tests/test_cart.py'] };
    if (normalized === 'pytest tests/hidden/test_cart_regression.py') return { executable: process.platform === 'win32' ? 'python.exe' : 'python', argv: ['-m', 'pytest', 'tests/hidden/test_cart_regression.py'] };
    if (normalized === 'dotnet test') return { executable: process.platform === 'win32' ? 'dotnet.exe' : 'dotnet', argv: ['test'] };
    if (normalized === 'dotnet run') return { executable: process.platform === 'win32' ? 'dotnet.exe' : 'dotnet', argv: ['run', '--no-restore'] };
    if (normalized === 'gradle test') return { executable: this.resolveExecutable('gradle'), argv: ['test'] };
    if (normalized === 'npm test') return { executable: process.execPath, argv: [process.env.npm_execpath || path.resolve(process.cwd(), 'node_modules/npm/bin/npm-cli.js'), 'test'] };
    if (normalized === 'shellcheck backup.sh') return { executable: this.resolveExecutable('shellcheck'), argv: ['backup.sh'] };
    if (normalized === 'cmake configure') return { executable: this.resolveExecutable('cmake'), argv: ['-S', '.', '-B', 'build'] };
    if (normalized === 'cmake build') return { executable: this.resolveExecutable('cmake'), argv: ['--build', 'build'] };
    if (normalized === 'make test') return { executable: this.resolveExecutable('make'), argv: ['test'] };
    if (normalized === 'meson setup') return { executable: this.resolveExecutable('meson'), argv: ['setup', 'build'] };
    if (normalized === 'meson test') return { executable: this.resolveExecutable('meson'), argv: ['test', '-C', 'build'] };
    if (normalized === 'cmake test') return { executable: this.resolveExecutable('ctest'), argv: ['--test-dir', 'build', '-C', 'Debug', '--output-on-failure'] };
    if (normalized === 'sqlite3 check') return { executable: this.resolveExecutable('sqlite3'), argv: [':memory:', '.read schema.sql', '.read query.sql'] };
    if (normalized === 'powershell test') return { executable: this.resolveExecutable('pwsh'), argv: ['-NoProfile', '-File', 'test-runner.ps1'] };
    if (normalized === 'docker build') return { executable: this.resolveExecutable('docker'), argv: ['build', '--pull=false', '--tag', 'codex-polyglot-fixture:local', '.'] };
    if (normalized === 'node hidden-check.mjs') return { executable: process.execPath, argv: ['hidden-check.mjs'] };
    return undefined;
  }

  private resolveExecutable(executable: string): string {
    if (process.platform !== 'win32') return executable;
    if (executable === 'node') return 'node.exe';
    if (['npm', 'pnpm', 'yarn'].includes(executable)) return `${executable}.cmd`;
    if (executable === 'gradle') return 'gradle.cmd';
    if (executable === 'shellcheck') return 'shellcheck.exe';
    return `${executable}.exe`;
  }

  private hashFixture(directory: string): string {
    const files: string[] = [];
    const walk = (current: string) => {
      if (!fs.existsSync(current)) return;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory() && !['target', 'bin', 'obj', 'build', '.pytest_cache', '__pycache__', 'node_modules', '.gradle'].includes(entry.name)) walk(absolute);
        else if (entry.isFile()) files.push(path.relative(directory, absolute).replace(/\\/g, '/'));
      }
    };
    walk(directory);
    return crypto.createHash('sha256').update(files.sort().map(file => `${file}\0`).join('')).update(files.sort().map(file => fs.readFileSync(path.join(directory, file))).join('')).digest('hex');
  }
}
