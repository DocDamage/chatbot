import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AutoReview } from '../AutoReview';
import { PerformanceMonitor } from '../../learning/PerformanceMonitor';
import { RedisCache } from '../../cache/RedisCache';
import { SemanticCache } from '../../cache/SemanticCache';
import { CodeExecutor } from '../../tools/CodeExecutor';

describe('B75-08: Quality Watcher, Cache Subsystems, and Performance Monitoring Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qual-matrix-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('AutoReview Background Watcher & Reviewer', () => {
    it('reviews single files, batches, parses LLM JSON responses, and manages watch state', async () => {
      const mockLLM = jest.fn().mockResolvedValue(
        JSON.stringify({
          score: 85,
          issues: [
            { type: 'warning', line: 10, message: 'Unused variable', rule: 'no-unused-vars' },
          ],
          suggestions: [
            { line: 10, original: 'const a = 1;', suggested: '', reason: 'Remove dead code' },
          ],
          summary: 'Good code with minor unused variables',
        })
      );

      const autoReview = new AutoReview(mockLLM, {
        watchPaths: [tempDir],
        maxFileSize: 50 * 1024,
        enabled: true,
      });

      // Write sample file
      const sampleFile = path.join(tempDir, 'sample.ts');
      fs.writeFileSync(sampleFile, 'export function compute() { const a = 1; return 42; }');

      // 1. Single file review
      const result = await autoReview.reviewFile(sampleFile);
      expect(result.score).toBe(85);
      expect(result.issues.length).toBe(1);
      expect(result.suggestions.length).toBe(1);

      // 2. Review history & stats
      const history = autoReview.getHistory(5);
      expect(history.length).toBe(1);
      const stats = autoReview.getStats();
      expect(stats.totalReviews).toBe(1);
      expect(stats.avgScore).toBe(85);

      // 3. Batch review
      const results = await autoReview.reviewFiles([sampleFile]);
      expect(results.length).toBe(1);

      // 4. Start & stop watching
      autoReview.startWatching();
      autoReview.stopWatching();

      // 5. Error branches: Missing file & oversized file
      await expect(autoReview.reviewFile(path.join(tempDir, 'missing.ts'))).rejects.toThrow(
        'File not found'
      );

      const bigFile = path.join(tempDir, 'big.ts');
      fs.writeFileSync(bigFile, 'A'.repeat(60 * 1024));
      await expect(autoReview.reviewFile(bigFile)).rejects.toThrow('File too large');

      // 6. Non-JSON / Corrupt LLM response fallback
      mockLLM.mockResolvedValueOnce('{ "score": 90, "corrupt_json": }');
      const fallbackRes = await autoReview.reviewFile(sampleFile);
      expect(fallbackRes.issues.length).toBeGreaterThan(0);
    });
  });

  describe('PerformanceMonitor', () => {
    it('records metrics, calculates windowed snapshots, detects trends, and flags degradation', () => {
      const monitor = new PerformanceMonitor();

      // Record metrics
      for (let i = 0; i < 20; i++) {
        monitor.record({
          name: 'latency',
          value: 100 + i * 5,
          timestamp: new Date(),
        });
        monitor.record({
          name: 'quality',
          value: 0.9 - i * 0.02,
          timestamp: new Date(),
        });
        monitor.record({
          name: 'success_rate',
          value: 0.95,
          timestamp: new Date(),
        });
      }

      const snapshot = monitor.getSnapshot();
      expect(snapshot.summary.averageLatency).toBeGreaterThan(0);
      expect(snapshot.summary.successRate).toBeCloseTo(0.95, 2);
      expect(snapshot.summary.averageQuality).toBeGreaterThan(0);

      const latencyTrend = monitor.getTrend('latency', 5);
      expect(latencyTrend.trend).toBe('up');

      const qualityTrend = monitor.getTrend('quality', 5);
      expect(qualityTrend.trend).toBe('down');

      const emptyTrend = monitor.getTrend('nonexistent_metric');
      expect(emptyTrend.trend).toBe('stable');

      expect(monitor.isDegrading(0.01)).toBe(true);
    });
  });

  describe('RedisCache L2 Provider', () => {
    it('initializes, executes get/set/delete/clear with fallback on failure', async () => {
      const cache = new RedisCache();
      expect(cache.isEnabled()).toBe(false);

      // Uninitialized / disabled get, set, delete, clear
      expect(await cache.get('key1')).toBeUndefined();
      await cache.set('key1', { a: 1 });
      await cache.delete('key1');
      await cache.clear();
      await cache.close();

      // Mock internal client
      const mockRedisClient = {
        ping: jest.fn().mockResolvedValue('PONG'),
        get: jest.fn().mockResolvedValue(JSON.stringify({ value: 'hello' })),
        set: jest.fn().mockResolvedValue('OK'),
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        flushdb: jest.fn().mockResolvedValue('OK'),
        quit: jest.fn().mockResolvedValue('OK'),
        on: jest.fn(),
      };

      (cache as any).client = mockRedisClient;
      (cache as any).enabled = true;

      expect(cache.isEnabled()).toBe(true);
      const val = await cache.get<{ value: string }>('key2');
      expect(val?.value).toBe('hello');

      await cache.set('key2', { value: 'world' });
      expect(mockRedisClient.set).toHaveBeenCalled();

      await cache.set('key2', { value: 'world' }, 60);
      expect(mockRedisClient.setex).toHaveBeenCalled();

      await cache.delete('key2');
      expect(mockRedisClient.del).toHaveBeenCalled();

      await cache.clear();
      expect(mockRedisClient.flushdb).toHaveBeenCalled();

      await cache.close();
      expect(cache.isEnabled()).toBe(false);
    });
  });

  describe('SemanticCache Query & Jaccard Subsystem', () => {
    it('stores values, matches by exact and Jaccard similarity, and manages stats', () => {
      const cache = new SemanticCache<string>(3600, 0.5);

      cache.set(
        'how to configure typescript compiler options',
        'Use tsconfig.json compilerOptions field.'
      );

      // Exact hit
      const exact = cache.get('how to configure typescript compiler options');
      expect(exact).toBe('Use tsconfig.json compilerOptions field.');

      // Semantic hit (Jaccard match with overlapping tokens)
      const semantic = cache.get('how to configure typescript options');
      expect(semantic).toBe('Use tsconfig.json compilerOptions field.');

      // Miss
      const miss = cache.get('completely unrelated cooking recipe for pizza');
      expect(miss).toBeUndefined();

      const stats = cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.totalAccess).toBeGreaterThanOrEqual(1);

      cache.clear();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('CodeExecutor Safe Sandboxing', () => {
    it('executes JavaScript code and enforces allowed languages and security checks', async () => {
      const executor = new CodeExecutor(3000, ['javascript', 'python']);

      // 1. Valid JavaScript execution
      const jsRes = await executor.execute('console.log("Hello from sandbox");', 'javascript');
      expect(jsRes.success).toBe(true);
      expect(jsRes.data?.output).toContain('Hello from sandbox');

      // 2. Disallowed language
      const rubyRes = await executor.execute('puts "hello"', 'ruby');
      expect(rubyRes.success).toBe(false);
      expect(rubyRes.error).toContain('Language ruby not allowed');

      // 3. Security check failures
      const evalRes = await executor.execute('eval("2 + 2")', 'javascript');
      expect(evalRes.success).toBe(false);
      expect(evalRes.error).toContain('Security check failed');

      const fsRes = await executor.execute(
        'const fs = require("fs"); fs.readFileSync("/etc/passwd");',
        'javascript'
      );
      expect(fsRes.success).toBe(false);
      expect(fsRes.error).toContain('Security check failed');

      const childProcRes = await executor.execute(
        'const cp = require("child_process");',
        'javascript'
      );
      expect(childProcRes.success).toBe(false);

      // 4. Bash is explicitly disabled by default
      const bashExecutor = new CodeExecutor(3000, ['bash']);
      const bashRes = await bashExecutor.execute('echo hello', 'bash');
      expect(bashRes.success).toBe(false);
      expect(bashRes.error).toContain('Bash execution is disabled');
    });
  });
});
