import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { CapabilityEvaluationSuite } from '../CapabilityEvaluationSuite';
import { CodingBenchmarkRunner } from '../../../evaluation/CodingBenchmarkRunner';

describe('B75-07: Capability Evaluation Suite and Coding Benchmark Runner Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-suite-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('CapabilityEvaluationSuite', () => {
    it('runs evaluation across all 10 domain areas and computes verifiable digest', async () => {
      const suite = CapabilityEvaluationSuite.getInstance();
      const allDomains = suite.getAllDomains();
      expect(allDomains.length).toBe(10);

      const result = await suite.runSuite({ targetRepoPath: tempDir });

      expect(result.totalChecks).toBeGreaterThan(0);
      expect(result.sha256Digest).toBeDefined();
      expect(result.domainSummaries).toBeDefined();
      expect(typeof result.overallScore).toBe('number');
    });

    it('handles filtered domain evaluation and checks remediation fields', async () => {
      const suite = CapabilityEvaluationSuite.getInstance();
      const result = await suite.runSuite({
        domains: ['media_consent_egress_and_cleanup', 'browser_origin_and_state_change_policy']
      });

      expect(result.checks.length).toBeGreaterThan(0);
      for (const check of result.checks) {
        expect(['passed', 'failed', 'warned', 'skipped']).toContain(check.status);
        expect(check.score).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('CodingBenchmarkRunner', () => {
    it('inspects manifest, handles missing toolchains, and reports structured case results', () => {
      const fixtureDir = path.join(tempDir, 'fixtures');
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.mkdirSync(path.join(fixtureDir, 'case1'), { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, 'case1', 'index.ts'), 'export const x = 1;', 'utf8');

      const manifest = {
        schemaVersion: 1,
        suite: 'core-benchmarks',
        toolchainPolicy: 'strict',
        cases: [
          {
            id: 'case_ts_1',
            family: 'refactor',
            language: 'typescript',
            fixture: 'case1',
            prompt: 'Refactor constant',
            expectedFiles: ['index.ts'],
            visibleTests: ['node -v'],
            hiddenChecks: [],
            requiredToolchain: 'node'
          },
          {
            id: 'case_rust_1',
            family: 'security',
            language: 'rust',
            fixture: 'case1',
            prompt: 'Fix memory safety',
            expectedFiles: ['main.rs'],
            visibleTests: [],
            hiddenChecks: [],
            requiredToolchain: 'nonexistent_rust_toolchain'
          }
        ]
      };

      const runner = new CodingBenchmarkRunner(fixtureDir);
      const inspection = runner.inspect(manifest, 'baseline');

      expect(inspection.suite).toBe('core-benchmarks');
      expect(inspection.cases.length).toBe(2);
      expect(inspection.cases[0].toolchainAvailable).toBe(true);
      expect(inspection.cases[1].toolchainAvailable).toBe(false);
      expect(inspection.cases[1].status).toBe('unsupported');
    });
  });
});
