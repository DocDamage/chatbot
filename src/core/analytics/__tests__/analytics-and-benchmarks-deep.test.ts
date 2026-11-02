import { AnalyticsService } from '../AnalyticsService';
import { CodingBenchmarkRunner } from '../../evaluation/CodingBenchmarkRunner';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('B75-08: Analytics Service and Coding Benchmark Runner Deep Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-matrix-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('AnalyticsService Operations', () => {
    it('tracks events, queries, latencies, feedback, and aggregates stats and trends', () => {
      const analytics = new AnalyticsService();

      analytics.track({
        type: 'session_start',
        userId: 'user_1',
        sessionId: 'sess_1',
        metadata: { client: 'web' }
      });

      // Track successful request
      analytics.trackRequest({
        userId: 'user_1',
        model: 'gpt-4o',
        intent: 'coding',
        latency: 120,
        success: true,
        query: 'How to sort an array in TypeScript?'
      });

      // Track failed request
      analytics.trackRequest({
        userId: 'user_1',
        model: 'gpt-4o',
        intent: 'coding',
        latency: 300,
        success: false,
        query: 'Invalid syntax query'
      });

      // Track feedback
      analytics.recordFeedback({
        userId: 'user_1',
        sessionId: 'sess_1',
        rating: 5,
        comment: 'Super fast and helpful!',
        categories: ['helpful', 'fast']
      });

      const stats = analytics.getUsageStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
      expect(stats.averageLatency).toBeGreaterThan(0);

      const userBehavior = analytics.getUserBehavior('user_1');
      expect(userBehavior?.feedbackCount).toBe(1);
      expect(userBehavior?.satisfactionScore).toBe(1);

      const patterns = analytics.getQueryPatterns();
      expect(Array.isArray(patterns.trending)).toBe(true);

      analytics.clear();
      expect(analytics.getUsageStats().totalRequests).toBe(0);
    });
  });

  describe('CodingBenchmarkRunner Operations', () => {
    it('inspects manifests, calculates fixture hashes, and reports toolchain availability', () => {
      const fixtureDir = path.join(tempDir, 'sample_fixture');
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, 'index.ts'), 'export const hello = "world";');

      const runner = new CodingBenchmarkRunner(tempDir);

      const manifest = {
        schemaVersion: 1,
        suite: 'core-benchmarks',
        toolchainPolicy: 'lenient',
        cases: [
          {
            id: 'case_1',
            family: 'refactor',
            language: 'typescript',
            fixture: 'sample_fixture',
            prompt: 'Export a function named greet',
            expectedFiles: ['index.ts'],
            visibleTests: [],
            hiddenChecks: [],
            requiredToolchain: 'node'
          }
        ]
      };

      const report = runner.inspect(manifest, 'baseline');
      expect(report.suite).toBe('core-benchmarks');
      expect(report.cases.length).toBe(1);
      expect(report.cases[0].fixtureHash).toBeDefined();
    });
  });
});
