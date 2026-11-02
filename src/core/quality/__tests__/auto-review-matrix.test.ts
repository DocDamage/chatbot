import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AutoReview } from '../AutoReview';

describe('B75-07: AutoReview Decision Matrix', () => {
  let tempDir: string;
  let testFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-review-test-'));
    testFile = path.join(tempDir, 'sample.ts');
    fs.writeFileSync(testFile, 'export function add(a: number, b: number) { return a + b; }\n');
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reviews single file and parses structured JSON issues, suggestions, and score', async () => {
    const mockLlm = jest.fn().mockResolvedValue(JSON.stringify({
      score: 95,
      issues: [{ type: 'info', line: 1, message: 'Consider adding JSDoc', rule: 'jsdoc/required' }],
      suggestions: [{ line: 1, original: 'export function add', suggested: '/** Adds two numbers */\nexport function add', reason: 'Documentation' }],
      summary: 'Clean code'
    }));

    const reviewer = new AutoReview(mockLlm, { watchPaths: [tempDir] });
    const result = await reviewer.reviewFile(testFile);

    expect(result.score).toBe(95);
    expect(result.issues.length).toBe(1);
    expect(result.suggestions.length).toBe(1);
    expect(reviewer.getHistory().length).toBe(1);
  });

  it('handles LLM fallback parsing when response is not valid JSON', async () => {
    const mockLlm = jest.fn().mockResolvedValue('{ not valid json content }');
    const reviewer = new AutoReview(mockLlm);
    const result = await reviewer.reviewFile(testFile);

    expect(result.issues.length).toBe(1);
    expect(result.issues[0].message).toContain('not valid json');
  });

  it('reviews batch of files and captures stats and errors', async () => {
    const mockLlm = jest.fn().mockResolvedValue('{"score": 80, "issues": []}');
    const reviewer = new AutoReview(mockLlm);
    const results = await reviewer.reviewFiles([testFile, path.join(tempDir, 'nonexistent.ts')]);

    expect(results.length).toBe(1);
    const stats = reviewer.getStats();
    expect(stats.totalReviews).toBe(1);
    expect(stats.avgScore).toBe(80);
  });

  it('throws on missing files or oversized files', async () => {
    const reviewer = new AutoReview(jest.fn(), { maxFileSize: 10 });
    await expect(reviewer.reviewFile(path.join(tempDir, 'missing.ts'))).rejects.toThrow('File not found');
    await expect(reviewer.reviewFile(testFile)).rejects.toThrow('File too large');
  });

  it('manages watcher start/stop and disabled state', () => {
    const reviewer = new AutoReview(jest.fn(), { enabled: false });
    reviewer.startWatching();
    expect(reviewer.getWatchedFiles().length).toBe(0);

    const activeReviewer = new AutoReview(jest.fn(), { watchPaths: [tempDir] });
    activeReviewer.startWatching();
    expect(activeReviewer.getWatchedFiles().length).toBe(1);
    activeReviewer.stopWatching();
    expect(activeReviewer.getWatchedFiles().length).toBe(0);
  });
});
