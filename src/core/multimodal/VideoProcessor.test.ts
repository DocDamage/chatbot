import fs from 'fs';
import os from 'os';
import path from 'path';
import { VideoProcessor } from './VideoProcessor';

describe('VideoProcessor release policy', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-video-policy-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('rejects videos over the configured byte limit before temp writes', async () => {
    const processor = new VideoProcessor({ tempDir, maxSizeMB: 0.0001 });
    const oversized = Buffer.alloc(1024).toString('base64');

    const result = await processor.validateVideo(oversized);

    expect(result.status).toBe('rejected');
    expect(result.error).toMatch(/exceeds maximum/);
    expect(processor.getTempFileCount()).toBe(0);
  });

  it('exposes dependency health and resource policy', async () => {
    const processor = new VideoProcessor({
      tempDir,
      maxSizeMB: 12,
      maxDurationSeconds: 34,
      maxFrames: 5,
    });

    const health = await processor.getDependencyHealth();

    expect(typeof health.ffmpegAvailable).toBe('boolean');
    expect(health.tempDir).toBe(tempDir);
    expect(health.policy).toEqual({
      maxSizeMB: 12,
      maxDurationSeconds: 34,
      maxFrames: 5,
    });
  });

  it('cleans temp artifacts after failed safe video processing', async () => {
    const processor = new VideoProcessor({ tempDir, maxSizeMB: 1 });
    const invalidVideo = Buffer.from('not a real mp4').toString('base64');

    const result = await processor.processForVisionSafe(invalidVideo);

    expect(['unsupported', 'error']).toContain(result.status);
    expect(processor.getTempFileCount()).toBe(0);
  });
});
