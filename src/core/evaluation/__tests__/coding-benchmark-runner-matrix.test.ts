import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { CodingBenchmarkRunner } from '../CodingBenchmarkRunner';

describe('B75-08: CodingBenchmarkRunner Command Planning and Matrix Suite', () => {
  let tempDir: string;
  let runner: CodingBenchmarkRunner;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-bench-test-'));
    fs.writeFileSync(path.join(tempDir, 'sample.txt'), 'hello world', 'utf8');
    runner = new CodingBenchmarkRunner(tempDir);
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('maps all supported polyglot command plans accurately', () => {
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
      'npm test',
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
      'node hidden-check.mjs'
    ];

    for (const cmd of commands) {
      const plan = (runner as any).commandPlan(cmd);
      expect(plan).toBeDefined();
      expect(plan.executable).toBeDefined();
      expect(Array.isArray(plan.argv)).toBe(true);
    }

    const unsupportedPlan = (runner as any).commandPlan('unsupported-custom-binary test');
    expect(unsupportedPlan).toBeUndefined();
  });

  it('hashes fixture directories deterministically and handles empty or nested structures', () => {
    const hash1 = (runner as any).hashFixture(tempDir);
    expect(typeof hash1).toBe('string');
    expect(hash1.length).toBe(64);

    const subDir = path.join(tempDir, 'nested', 'target');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'ignored.bin'), 'ignored bytes', 'utf8');

    // Target folder is filtered out from hashing
    const hash2 = (runner as any).hashFixture(tempDir);
    expect(hash2).toBe(hash1);
  });

  it('resolves executable names across operating systems', () => {
    const nodeExe = (runner as any).resolveExecutable('node');
    expect(nodeExe).toBeDefined();

    const npmCmd = (runner as any).resolveExecutable('npm');
    expect(npmCmd).toBeDefined();

    const gradleCmd = (runner as any).resolveExecutable('gradle');
    expect(gradleCmd).toBeDefined();
  });

  it('runs manifest inspection and handles unavailable toolchains gracefully', () => {
    const manifest = {
      schemaVersion: 1,
      suite: 'polyglot-test-suite',
      toolchainPolicy: 'strict',
      cases: [
        {
          id: 'test_node_case',
          family: 'js',
          language: 'javascript',
          fixture: '.',
          prompt: 'Fix JavaScript bug',
          expectedFiles: ['index.js'],
          visibleTests: ['node hidden-check.mjs'],
          hiddenChecks: [],
          requiredToolchain: 'node'
        },
        {
          id: 'test_missing_toolchain',
          family: 'exotic',
          language: 'brainfuck',
          fixture: '.',
          prompt: 'Fix exotic bug',
          expectedFiles: ['main.bf'],
          visibleTests: ['bf test'],
          hiddenChecks: [],
          requiredToolchain: 'nonexistent-exotic-compiler-12345'
        }
      ]
    };

    const report = runner.inspect(manifest, 'baseline');
    expect(report.suite).toBe('polyglot-test-suite');
    expect(report.cases.length).toBe(2);
    expect(report.cases[1].toolchainAvailable).toBe(false);
    expect(report.cases[1].status).toBe('unsupported');
  });

  it('runs benchmark cases in baseline and upgraded mode', async () => {
    const manifest = {
      schemaVersion: 1,
      suite: 'polyglot-test-suite',
      toolchainPolicy: 'strict',
      cases: [
        {
          id: 'test_node_case',
          family: 'js',
          language: 'javascript',
          fixture: '.',
          prompt: 'Fix JavaScript bug',
          expectedFiles: ['index.js'],
          visibleTests: [],
          hiddenChecks: [],
          requiredToolchain: 'node'
        }
      ]
    };

    const baselineReport = await runner.run(manifest, 'baseline');
    expect(baselineReport.cases.length).toBe(1);
    expect(baselineReport.cases[0].score).toBeDefined();

    const upgradedReport = await runner.run(manifest, 'upgraded');
    expect(upgradedReport.cases.length).toBe(1);
    expect(upgradedReport.cases[0].score).toBeDefined();

    // Model adapter execution path
    const mockModelAdapter: any = {
      generateJSON: jest.fn().mockResolvedValue({
        summary: 'Fixed issue',
        risks: ['None'],
        verificationSteps: ['npm test'],
        confidence: 0.95,
        files: [{ path: 'sample.txt', action: 'modify', patch: '+hello world updated' }]
      })
    };

    const modelRunner = new CodingBenchmarkRunner(tempDir, { modelAdapter: mockModelAdapter });
    const modelReport = await modelRunner.run(manifest, 'upgraded');
    expect(modelReport.cases.length).toBe(1);
    expect(modelReport.cases[0].score).toBeDefined();
  });
});
