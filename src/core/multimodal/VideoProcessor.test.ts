import fs from 'fs';
import os from 'os';
import path from 'path';
import { VideoProcessor, getVideoProcessor } from './VideoProcessor';

describe('RT-MEDIA-001: VideoProcessor Comprehensive Multimodal & Release Policy Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-video-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('rejects videos over configured byte limit before temp writes', async () => {
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

  it('handles metadata, data URI decoding, and policy duration limits', async () => {
    const processor = new VideoProcessor({ tempDir, maxDurationSeconds: 10 });
    const sampleDataUri = 'data:video/mp4;base64,' + Buffer.from('dummy video payload').toString('base64');

    // Test getMetadata
    try {
      const meta = await processor.getMetadata(sampleDataUri);
      expect(meta.size).toBeGreaterThan(0);
    } catch (e: any) {
      expect(e.message).toMatch(/Failed to extract video metadata|ffmpeg/);
    }

    // Test duration policy assertion
    expect(() => {
      (processor as any).assertDurationWithinPolicy({ duration: 100 });
    }).toThrow('exceeds maximum duration');
    expect(() => {
      (processor as any).assertDurationWithinPolicy({ duration: 5 });
    }).not.toThrow();
  });

  it('handles safe processing workflows, error classification, and orphaned file cleanup', async () => {
    const processor = new VideoProcessor({ tempDir, maxSizeMB: 1, maxDurationSeconds: 5 });
    const invalidVideo = Buffer.from('corrupt video header').toString('base64');

    // 1. Process for vision safe with corrupt video
    const result = await processor.processForVisionSafe(invalidVideo);
    expect(['unsupported', 'error', 'rejected']).toContain(result.status);

    // 2. Extract audio safe with corrupt video
    const audioResult = await processor.extractAudioSafe(invalidVideo);
    expect(['unsupported', 'error', 'rejected']).toContain(audioResult.status);

    // 3. Populate temp directory with files and subdirectories, then test cleanupOrphanedTempFiles
    const subDir = path.join(tempDir, 'nested-dir');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'frame.jpg'), 'fake jpg');
    fs.writeFileSync(path.join(tempDir, 'temp-file.tmp'), 'fake tmp');
    expect(processor.getTempFileCount()).toBeGreaterThan(0);

    await (processor as any).cleanupOrphanedTempFiles();
    expect(processor.getTempFileCount()).toBe(0);
  });

  it('validates video payloads and returns status ok or unsupported based on ffmpeg', async () => {
    const processor = new VideoProcessor({ tempDir, maxSizeMB: 10 });
    const validSmallVideo = Buffer.from('small dummy video').toString('base64');

    const validation = await processor.validateVideo(validSmallVideo);
    expect(['ok', 'unsupported']).toContain(validation.status);
  });

  it('handles frame extraction, keyframes, audio, and thumbnail fallbacks', async () => {
    const processor = new VideoProcessor({ tempDir, maxSizeMB: 5 });
    const dummyVideo = Buffer.from('dummy video for fallback testing').toString('base64');

    // extractFrames
    const frames = await processor.extractFrames(dummyVideo, 1);
    expect(Array.isArray(frames)).toBe(true);

    // extractKeyFrames
    const keyFrames = await processor.extractKeyFrames(dummyVideo, 0.5);
    expect(Array.isArray(keyFrames)).toBe(true);

    // extractAudio
    const audio = await processor.extractAudio(dummyVideo);
    expect(audio === null || typeof audio === 'string').toBe(true);

    // createThumbnail
    const thumb = await processor.createThumbnail(dummyVideo, 0);
    expect(thumb === null || typeof thumb === 'string').toBe(true);
  });

  it('provides singleton instance via getVideoProcessor', () => {
    const instance1 = getVideoProcessor();
    const instance2 = getVideoProcessor();
    expect(instance1).toBeDefined();
    expect(instance1).toBe(instance2);
  });

  it('handles getTempFileCount when directory does not exist', () => {
    const nonExistentDir = path.join(tempDir, 'does-not-exist');
    const processor = new VideoProcessor({ tempDir: nonExistentDir });
    // remove directory if constructor created it
    fs.rmSync(nonExistentDir, { recursive: true, force: true });
    expect(processor.getTempFileCount()).toBe(0);
  });
});
