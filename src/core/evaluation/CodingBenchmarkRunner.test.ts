import fs from 'fs';
import os from 'os';
import path from 'path';
import { CodingBenchmarkCase, CodingBenchmarkRunner } from './CodingBenchmarkRunner';
import { CodingAgent } from '../agents/CodingAgent';
import { LLMAdapter } from '../providers/LLMAdapter';

jest.mock('child_process', () => {
  const actual = jest.requireActual<typeof import('child_process')>('child_process');
  return { ...actual, spawnSync: jest.fn((...args: Parameters<typeof actual.spawnSync>) => actual.spawnSync(...args)) };
});

describe('CodingBenchmarkRunner', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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
      expect(commands.every(command => runner.commandPlan(command))).toBe(true);
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

      // 2. A model targeting an uncaptured, nonexistent path is refused before application.
      const conflictAdapter: LLMAdapter = {
        generate: async () => ({
          content: JSON.stringify({
            operations: [{ operation: 'modify', path: 'does-not-exist.ts', content: 'def', expectedContent: 'abc', reason: 'Modify missing', authorized: false }]
          }),
          model: 'fixture-coder'
        }),
        estimateCost: () => 0,
        getModelName: () => 'fixture-coder'
      };
      const conflictReport = await new CodingBenchmarkRunner(root, { modelAdapter: conflictAdapter }).run({ schemaVersion: 1, suite: 'runner-test', toolchainPolicy: 'test', cases: [testCase] }, 'upgraded');
      expect(conflictReport.cases[0].execution).toBeUndefined();
      expect(conflictReport.cases[0].reason).toMatch(/file|scope|patch|content|missing/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports unavailable toolchains and empty verification plans without inventing a passing score', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-benchmark-empty-'));
    try {
      const unavailable: CodingBenchmarkCase = {
        id: 'unavailable', family: 'fixture', language: 'text', fixture: 'missing', prompt: 'nothing',
        expectedFiles: [], visibleTests: [], hiddenChecks: [], requiredToolchain: 'definitely-not-installed-benchmark-tool'
      };
      const empty: CodingBenchmarkCase = {
        id: 'empty-checks', family: 'fixture', language: 'text', fixture: '.', prompt: 'nothing',
        expectedFiles: [], visibleTests: [], hiddenChecks: [], requiredToolchain: 'node'
      };

      const report = await new CodingBenchmarkRunner(root).run({ schemaVersion: 1, suite: 'empty', toolchainPolicy: 'test', cases: [unavailable, empty] }, 'baseline');

      expect(report.cases[0]).toEqual(expect.objectContaining({ status: 'unsupported', checks: [] }));
      expect(report.cases[0].reason).toContain('Toolchain unavailable');
      expect(report.cases[1].checks).toEqual([]);
      expect(report.cases[1].hiddenChecks).toEqual([]);
      expect(report.cases[1].score).toEqual(expect.objectContaining({ passed: false }));
      expect(report.cases[1].score?.failures).toEqual(expect.arrayContaining([
        'build_or_visible_tests_failed',
        'hidden_regression_failed',
        'required_verification_missing'
      ]));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('records unsupported, timed-out, and startup-failed checks with honest process evidence', async () => {
    const runner = new CodingBenchmarkRunner(process.cwd()) as any;

    await expect(runner.runCheck('not-a-supported-fixture-command', process.cwd())).resolves.toEqual({
      command: 'not-a-supported-fixture-command', argv: [], status: 'unsupported', exitCode: null, stdout: '',
      stderr: 'No safe argv mapping exists for this fixture command'
    });

    const mockedSpawnSync = require('child_process').spawnSync as jest.Mock;
    mockedSpawnSync
      .mockReturnValueOnce({ error: new Error('ETIMEDOUT'), status: null, stdout: 'partial output', stderr: '' } as any)
      .mockReturnValueOnce({ error: new Error('ENOENT'), status: null, stdout: '', stderr: 'missing executable' } as any)
      .mockReturnValueOnce({ error: new Error('ETIMEDOUT'), status: null, stdout: '', stderr: '' } as any)
      .mockReturnValueOnce({ error: new Error('ENOENT'), status: null, stdout: '', stderr: '' } as any);

    await expect(runner.runCheck('node hidden-check.mjs', process.cwd())).resolves.toEqual(expect.objectContaining({
      status: 'timed_out', exitCode: null, stdout: 'partial output', stderr: 'ETIMEDOUT'
    }));
    await expect(runner.runCheck('node hidden-check.mjs', process.cwd())).resolves.toEqual(expect.objectContaining({
      status: 'failed', exitCode: null, stdout: '', stderr: 'missing executable'
    }));
    await expect(runner.runCheck('node hidden-check.mjs', process.cwd())).resolves.toEqual(expect.objectContaining({
      status: 'timed_out', exitCode: null, stdout: '', stderr: 'ETIMEDOUT'
    }));
    await expect(runner.runCheck('node hidden-check.mjs', process.cwd())).resolves.toEqual(expect.objectContaining({
      status: 'failed', exitCode: null, stdout: '', stderr: 'ENOENT'
    }));
  });

  it('leaves a no-adapter execution untouched and reports an empty-risk model rejection', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-benchmark-no-adapter-'));
    try {
      const testCase: CodingBenchmarkCase = {
        id: 'no-adapter', family: 'fixture', language: 'text', fixture: '.', prompt: 'nothing',
        expectedFiles: [], visibleTests: [], hiddenChecks: [], requiredToolchain: 'node'
      };
      const noAdapterResult: Record<string, unknown> = {};
      await (new CodingBenchmarkRunner(root) as any).executeModelCase(testCase, noAdapterResult);
      expect(noAdapterResult).toEqual({});

      jest.spyOn(CodingAgent.prototype, 'handle').mockResolvedValue({ structuredPatch: undefined, risks: [] } as any);
      const modelResult: Record<string, unknown> = {};
      await (new CodingBenchmarkRunner(root, { modelAdapter: {} as LLMAdapter }) as any).executeModelCase(testCase, modelResult);
      expect(modelResult).toEqual({ reason: 'Model did not return a structured patch' });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps inspection metrics separate from execution when no model adapter is configured', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-benchmark-inspection-only-'));
    try {
      fs.writeFileSync(path.join(root, 'observed.ts'), 'export const observed = true;\n');
      const testCase: CodingBenchmarkCase = {
        id: 'inspection-only', family: 'web', language: 'typescript', fixture: '.', prompt: 'Inspect observed.ts',
        expectedFiles: ['observed.ts'], visibleTests: [], hiddenChecks: [], requiredToolchain: 'node'
      };

      const report = await new CodingBenchmarkRunner(root).run({ schemaVersion: 1, suite: 'inspection-only', toolchainPolicy: 'test', cases: [testCase] }, 'upgraded');

      expect(report.cases[0].inspection).toEqual(expect.objectContaining({ verificationStatus: 'not_run' }));
      expect(report.cases[0].execution).toBeUndefined();
      expect(report.cases[0].score).toEqual(expect.objectContaining({ passed: false }));
      expect(report.cases[0].score?.metrics.verificationHonesty).toBe(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('flags a patched fixture with no recorded checks as an unverified execution', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-benchmark-unverified-execution-'));
    try {
      const testCase: CodingBenchmarkCase = {
        id: 'unverified-execution', family: 'web', language: 'typescript', fixture: '.', prompt: 'create generated.ts',
        expectedFiles: ['generated.ts'], visibleTests: [], hiddenChecks: [], requiredToolchain: 'node'
      };
      const adapter: LLMAdapter = {
        generate: async () => ({ content: JSON.stringify({ operations: [{ operation: 'create', path: 'generated.ts', content: 'export const ready = true;\n', reason: 'Create the requested module', authorized: false }] }), model: 'fixture-coder' }),
        estimateCost: () => 0,
        getModelName: () => 'fixture-coder'
      };

      const report = await new CodingBenchmarkRunner(root, { modelAdapter: adapter }).run({ schemaVersion: 1, suite: 'unverified-execution', toolchainPolicy: 'test', cases: [testCase] }, 'upgraded');

      expect(report.cases[0].execution).toEqual(expect.objectContaining({ patchApplied: true, filesChanged: ['generated.ts'] }));
      expect(report.cases[0].checks).toEqual([]);
      expect(report.cases[0].hiddenChecks).toEqual([]);
      expect(report.cases[0].score?.metrics.verificationHonesty).toBe(0);
      expect(report.cases[0].score?.failures).toEqual(expect.arrayContaining([
        'verification_claim_does_not_match_record',
        'required_verification_missing'
      ]));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not apply a model create operation that collides with an existing fixture file', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-benchmark-create-conflict-'));
    try {
      fs.writeFileSync(path.join(root, 'existing.ts'), 'export const original = true;\n');
      const testCase: CodingBenchmarkCase = {
        id: 'create-conflict', family: 'web', language: 'typescript', fixture: '.', prompt: 'create existing.ts',
        expectedFiles: ['existing.ts'], visibleTests: [], hiddenChecks: [], requiredToolchain: 'node'
      };
      const adapter: LLMAdapter = {
        generate: async () => ({ content: JSON.stringify({ operations: [{ operation: 'create', path: 'existing.ts', content: 'export const replacement = true;\n', reason: 'Create the requested module', authorized: false }] }), model: 'fixture-coder' }),
        estimateCost: () => 0,
        getModelName: () => 'fixture-coder'
      };

      const report = await new CodingBenchmarkRunner(root, { modelAdapter: adapter }).run({ schemaVersion: 1, suite: 'create-conflict', toolchainPolicy: 'test', cases: [testCase] }, 'upgraded');

      expect(report.cases[0].execution).toEqual(expect.objectContaining({ patchApplied: false }));
      expect(report.cases[0].execution?.risks.join(' ')).toMatch(/already exists|conflict/i);
      expect(fs.readFileSync(path.join(root, 'existing.ts'), 'utf8')).toBe('export const original = true;\n');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses the npm executable only when no trusted npm CLI file is available', () => {
    const runner = new CodingBenchmarkRunner(process.cwd()) as any;
    const originalNpmExecPath = process.env.npm_execpath;
    try {
      delete process.env.npm_execpath;
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      expect(runner.commandPlan('npm test')).toEqual({ executable: runner.resolveExecutable('npm'), argv: ['test'] });
    } finally {
      if (originalNpmExecPath === undefined) delete process.env.npm_execpath;
      else process.env.npm_execpath = originalNpmExecPath;
    }
  });
});
