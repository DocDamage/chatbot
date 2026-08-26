import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AutoReview } from '../AutoReview';

describe('RT-QUAL-001: AutoReview Automated Code Inspection Suite', () => {
  let tempDir: string;
  let mockLLM: jest.Mock<any>;
  let autoReview: AutoReview;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-review-test-'));
    mockLLM = jest.fn<any>().mockResolvedValue(JSON.stringify({
      score: 92,
      issues: [
        { type: 'warning', line: 12, message: 'Unused local variable' }
      ],
      suggestions: [
        { line: 12, original: 'const unused = 1;', suggested: '// removed unused', reason: 'clean code' }
      ]
    }));

    autoReview = new AutoReview(mockLLM, {
      enabled: true,
      debounceMs: 50
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('reviews files from disk and records history', async () => {
    const testFile = path.join(tempDir, 'service.ts');
    fs.writeFileSync(testFile, 'export class Service {}');

    const result = await autoReview.reviewFile(testFile);
    expect(result.filepath).toBe(testFile);
    expect(result.score).toBe(92);
    expect(result.issues).toHaveLength(1);
    expect(autoReview.getHistory()).toHaveLength(1);
  });
});
