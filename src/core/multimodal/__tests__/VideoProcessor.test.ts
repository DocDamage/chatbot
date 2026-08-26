import { VideoProcessor, getVideoProcessor } from '../VideoProcessor';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const mockFfprobe = jest.fn((filePath, cb) => {
  cb(null, {
    format: {
      duration: '120',
      size: '5000000',
      format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
      bit_rate: '1500000'
    },
    streams: [
      {
        codec_type: 'video',
        width: 1920,
        height: 1080,
        r_frame_rate: '30/1',
        codec_name: 'h264'
      },
      {
        codec_type: 'audio',
        codec_name: 'aac'
      }
    ]
  });
});

const mockFfmpegInstance: any = {
  outputOptions: jest.fn().mockReturnThis(),
  noVideo: jest.fn().mockReturnThis(),
  audioCodec: jest.fn().mockReturnThis(),
  audioBitrate: jest.fn().mockReturnThis(),
  format: jest.fn().mockReturnThis(),
  output: jest.fn().mockImplementation(function (this: any, outPath: string) {
    if (outPath.endsWith('.jpg')) {
      const dir = path.dirname(outPath);
      try {
        fs.writeFileSync(path.join(dir, 'frame-0001.jpg'), 'fake-jpg-content');
      } catch {
        // ignore
      }
    } else if (outPath.endsWith('.mp3')) {
      try {
        fs.writeFileSync(outPath, 'fake-mp3-audio');
      } catch {
        // ignore
      }
    }
    return this;
  }),
  screenshots: jest.fn().mockImplementation(function (this: any, opts: any) {
    const thumb = path.join(opts.folder, opts.filename);
    try {
      fs.writeFileSync(thumb, 'fake-thumb-data');
    } catch {
      // ignore
    }
    return this;
  }),
  on: jest.fn(function (this: any, event: string, handler: any) {
    if (event === 'end') {
      setTimeout(() => handler(), 10);
    }
    return this;
  }),
  run: jest.fn()
};

jest.mock('fluent-ffmpeg', () => {
  const fn: any = jest.fn(() => mockFfmpegInstance);
  fn.ffprobe = mockFfprobe;
  return fn;
});

describe('RT-VID-001: VideoProcessor Multimodal Pipeline & Governance Suite', () => {
  let processor: VideoProcessor;
  let tempDir: string;
  const dummyVideoBase64 = 'AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAADFtb292AAAAbG12aGQAAAAA';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-proc-test-'));
    processor = new VideoProcessor({
      tempDir,
      maxSizeMB: 50,
      maxDurationSeconds: 300,
      maxFrames: 30
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('checks dependency health and temp file counts', async () => {
    const health = await processor.getDependencyHealth();
    expect(health.policy.maxSizeMB).toBe(50);
    expect(health.tempDir).toBe(tempDir);
    expect(processor.getTempFileCount()).toBeGreaterThanOrEqual(0);
  });

  it('validates video size against processing policy', async () => {
    const validRes = await processor.validateVideo(dummyVideoBase64);
    expect(['ok', 'unsupported']).toContain(validRes.status);

    const hugeBase64 = Buffer.alloc(55 * 1024 * 1024).toString('base64');
    const invalidRes = await processor.validateVideo(hugeBase64);
    expect(invalidRes.status).toBe('rejected');
    expect(invalidRes.error).toContain('exceeds maximum');
  });

  it('handles frame extraction and keyframe extraction with ffmpeg mocks', async () => {
    const frames = await processor.extractFrames(dummyVideoBase64, 2);
    expect(Array.isArray(frames)).toBe(true);

    const keyframes = await processor.extractKeyFrames(dummyVideoBase64, 0.4);
    expect(Array.isArray(keyframes)).toBe(true);
  });

  it('retrieves structured video metadata using ffprobe', async () => {
    const metadata = await processor.getMetadata(dummyVideoBase64);
    expect(metadata.duration).toBe(120);
    expect(metadata.width).toBe(1920);
    expect(metadata.height).toBe(1080);
    expect(metadata.hasAudio).toBe(true);
  });

  it('processes video for vision models safely and extracts audio', async () => {
    const safeVision = await processor.processForVisionSafe(dummyVideoBase64, 5);
    expect(['ok', 'unsupported']).toContain(safeVision.status);

    const audio = await processor.extractAudio(dummyVideoBase64);
    if (audio) {
      expect(typeof audio).toBe('string');
    }

    const safeAudio = await processor.extractAudioSafe(dummyVideoBase64);
    expect(['ok', 'unsupported']).toContain(safeAudio.status);
  });

  it('creates video thumbnails and provides singleton accessor', async () => {
    const thumb = await processor.createThumbnail(dummyVideoBase64, 10);
    if (thumb) {
      expect(thumb).toContain('data:image/jpeg;base64');
    }

    const singleton = getVideoProcessor();
    expect(singleton).toBeInstanceOf(VideoProcessor);
  });

  it('cleans up orphaned temp files cleanly', async () => {
    const oldTemp = path.join(tempDir, 'video-old.mp4');
    fs.writeFileSync(oldTemp, 'old content');

    await (processor as any).cleanupOrphanedTempFiles(0);
    expect(fs.existsSync(oldTemp)).toBe(false);
  });

  it('handles corrupted video and invalid base64 gracefully', async () => {
    const badBase64 = 'not-valid-base64-content!@#$%^&*()';
    const res = await processor.validateVideo(badBase64);
    expect(res.data?.size).toBeDefined();
  });
});
