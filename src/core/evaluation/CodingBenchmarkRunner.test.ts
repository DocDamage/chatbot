import fs from 'fs';
import os from 'os';
import path from 'path';
import { CodingBenchmarkCase, CodingBenchmarkRunner } from './CodingBenchmarkRunner';
import { LLMAdapter } from '../providers/LLMAdapter';

describe('CodingBenchmarkRunner', () => {
  it('loads the fixed polyglot fixture manifest and records unsupported tools honestly', () => {
    const root = path.resolve(process.cwd(), 'evals/coding/fixtures');
    const report = new CodingBenchmarkRunner(root).inspect(new CodingBenchmarkRunner(root).loadManifest(), 'baseline');
    expect(report.cases.length).toBeGreaterThanOrEqual(8);
    expect(report.cases.every(testCase => testCase.fixtureHash.length > 0)).toBe(true);
    expect(report.cases.some(testCase => testCase.status === 'unsupported' || testCase.status === 'ready')).toBe(true);
  });

  it('applies a model structured patch in an isolated worktree and runs hidden checks', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-benchmark-runner-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node test-runner.mjs' } }));
      fs.writeFileSync(path.join(root, 'test-runner.mjs'), "import fs from 'node:fs'; process.exit(fs.existsSync('generated.ts') ? 0 : 1);\n");
      fs.writeFileSync(path.join(root, 'hidden-check.mjs'), "import fs from 'node:fs'; process.exit(fs.readFileSync('generated.ts', 'utf8') === 'export const ready = true;\\n' ? 0 : 1);\n");
      const testCase: CodingBenchmarkCase = {
        id: 'model-executor', family: 'web', language: 'typescript', fixture: '.', prompt: 'create generated.ts',
        expectedFiles: ['generated.ts'], visibleTests: ['npm test'], hiddenChecks: ['created-file-regression'], hiddenTests: ['node hidden-check.mjs'], requiredToolchain: 'node'
      };
      const adapter: LLMAdapter = {
        generate: async () => ({ content: JSON.stringify({ operations: [{ operation: 'create', path: 'generated.ts', content: 'export const ready = true;\n', reason: 'Create the requested module', authorized: false }] }), model: 'fixture-coder' }),
        estimateCost: () => 0,
        getModelName: () => 'fixture-coder'
      };
      const report = await new CodingBenchmarkRunner(root, { modelAdapter: adapter, model: 'fixture-coder' }).run({ schemaVersion: 1, suite: 'runner-test', toolchainPolicy: 'test', cases: [testCase] }, 'upgraded');
      expect(report.cases[0].execution).toEqual(expect.objectContaining({ patchApplied: true, worktree: 'isolated' }));
      expect(report.cases[0].checks?.every(check => check.status === 'passed')).toBe(true);
      expect(report.cases[0].hiddenChecks?.every(check => check.status === 'passed')).toBe(true);
      expect(report.cases[0].score?.passed).toBe(true);
      expect(fs.existsSync(path.join(root, 'generated.ts'))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('retains preflight checks when the live provider is unavailable', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-benchmark-provider-failure-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node test-runner.mjs' } }));
      fs.writeFileSync(path.join(root, 'test-runner.mjs'), 'process.exit(0);\n');
      const testCase: CodingBenchmarkCase = {
        id: 'provider-failure', family: 'web', language: 'typescript', fixture: '.', prompt: 'create generated.ts',
        expectedFiles: ['generated.ts'], visibleTests: ['npm test'], hiddenChecks: [], hiddenTests: [], requiredToolchain: 'node'
      };
      const adapter: LLMAdapter = {
        generate: async () => { throw new Error('provider unavailable'); },
        estimateCost: () => 0,
        getModelName: () => 'fixture-coder'
      };
      const report = await new CodingBenchmarkRunner(root, { modelAdapter: adapter, model: 'fixture-coder' }).run({ schemaVersion: 1, suite: 'runner-test', toolchainPolicy: 'test', cases: [testCase] }, 'upgraded');
      expect(report.cases[0].execution).toBeUndefined();
      expect(report.cases[0].checks?.every(check => check.status === 'passed')).toBe(true);
      expect(report.cases[0].reason).toContain('provider unavailable');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolves polyglot command plans consistently across host platforms', () => {
    const runner = new CodingBenchmarkRunner(process.cwd()) as any;
    const originalPlatform = process.platform;
    const commands = [
      'cargo test',
      'cargo test --lib',
      'cargo test --test hidden_validation',
      'go test ./...',
      'pytest',
      'pytest tests/test_cart.py',
      'pytest tests/hidden/test_cart_regression.py',
      'dotnet test',
      'dotnet run',
      'gradle test',
      'shellcheck backup.sh',
      'cmake configure',
      'cmake build',
      'make test',
      'meson setup',
      'meson test',
      'cmake test',
      'sqlite3 check',
      'powershell test',
      'docker build',
      'node hidden-check.mjs',
      'npm test'
    ];

    try {
      Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' });
      expect(runner.commandPlan('cargo test').executable).toBe('cargo.exe');
      expect(runner.commandPlan('npm test').executable).toBe(process.execPath);
      expect(runner.resolveExecutable('node')).toBe('node.exe');
      expect(runner.resolveExecutable('npm')).toBe('npm.cmd');
      expect(runner.resolveExecutable('gradle')).toBe('gradle.cmd');
      expect(runner.resolveExecutable('shellcheck')).toBe('shellcheck.exe');
      expect(runner.resolveExecutable('cmake')).toBe('cmake.exe');
      expect(commands.every(command => runner.commandPlan(command))).toBe(true);

      Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' });
      expect(runner.commandPlan('cargo test').executable).toBe('cargo');
      expect(runner.resolveExecutable('node')).toBe('node');
      Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' });
      expect(runner.resolveExecutable('cargo')).toBe('cargo');
      expect(runner.commandPlan('cargo test').executable).toBe('cargo');
      expect(runner.commandPlan('invalid-unknown-cmd')).toBeUndefined();
    } finally {
      Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform });
    }
  });

  it('handles model generating no patch or patch with conflicts', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-benchmark-conflicts-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node test-runner.mjs' } }));
      fs.writeFileSync(path.join(root, 'test-runner.mjs'), 'process.exit(0);\n');
      const testCase: CodingBenchmarkCase = {
        id: 'no-patch-case', family: 'web', language: 'typescript', fixture: '.', prompt: 'do something',
        expectedFiles: ['generated.ts'], visibleTests: ['npm test'], hiddenChecks: [], requiredToolchain: 'node'
      };

      // 1. Model returns empty / invalid structured patch
      const noPatchAdapter: LLMAdapter = {
        generate: async () => ({ content: 'Not a JSON patch', model: 'fixture-coder' }),
        estimateCost: () => 0,
        getModelName: () => 'fixture-coder'
      };
      const noPatchReport = await new CodingBenchmarkRunner(root, { modelAdapter: noPatchAdapter }).run({ schemaVersion: 1, suite: 'runner-test', toolchainPolicy: 'test', cases: [testCase] }, 'upgraded');
      expect(noPatchReport.cases[0].execution).toBeUndefined();

      // 2. Model returns patch with conflict (e.g. modify non-existent file)
      const conflictAdapter: LLMAdapter = {
        generate: async () => ({
          content: JSON.stringify({
            operations: [{ operation: 'modify', path: 'does-not-exist.ts', targetContent: 'abc', replacementContent: 'def', reason: 'Modify missing', authorized: false }]
          }),
          model: 'fixture-coder'
        }),
        estimateCost: () => 0,
        getModelName: () => 'fixture-coder'
      };
      const conflictReport = await new CodingBenchmarkRunner(root, { modelAdapter: conflictAdapter }).run({ schemaVersion: 1, suite: 'runner-test', toolchainPolicy: 'test', cases: [testCase] }, 'upgraded');
      expect(conflictReport.cases[0].execution?.patchApplied).toBe(false);
      expect(conflictReport.cases[0].execution?.risks.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
