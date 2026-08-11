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
});
