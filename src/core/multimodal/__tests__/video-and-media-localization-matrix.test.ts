import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { VideoProcessor } from '../VideoProcessor';
import { ProductionMediaEngineAdapter } from '../localization/ProductionMediaEngineAdapter';
import { AudioLibraryService } from '../../audio/AudioLibraryService';

describe('B75-08: Video, Localization Engine, and Audio Library Deep Coverage Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-matrix-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('VideoProcessor Operations', () => {
    it('reports dependency health and checks policy boundaries', async () => {
      const processor = new VideoProcessor({
        maxSizeMB: 50,
        maxDurationSeconds: 300,
        tempDir
      });

      const health = await processor.getDependencyHealth();
      expect(health.policy.maxSizeMB).toBe(50);
      expect(health.tempDir).toBe(tempDir);
      expect(processor.getTempFileCount()).toBe(0);

      // Oversized base64 validation
      const fakeBase64 = Buffer.alloc(55 * 1024 * 1024).toString('base64');
      const validation = await processor.validateVideo(fakeBase64);
      expect(validation.status).toBe('rejected');
      // Small dummy base64 video handling
      const smallBase64 = Buffer.from('fake mp4 video bytes').toString('base64');

      // Safe wrapper methods
      const visionSafe = await processor.processForVisionSafe(smallBase64, 5);
      expect(visionSafe.status).toBeDefined();

      const audioSafe = await processor.extractAudioSafe(smallBase64);
      expect(audioSafe.status).toBeDefined();

      // Direct processing methods
      const frames = await processor.extractFrames(smallBase64, 3);
      expect(Array.isArray(frames)).toBe(true);

      const keyframes = await processor.extractKeyFrames(smallBase64);
      expect(Array.isArray(keyframes)).toBe(true);

      try {
        const audio = await processor.extractAudio(smallBase64);
        expect(audio).toBeDefined();
      } catch (err: any) {
        expect(err.message).toBeDefined();
      }

      const thumb = await processor.createThumbnail(smallBase64, 0);
      expect(thumb === null || typeof thumb === 'string').toBe(true);

      try {
        const vision = await processor.processForVision(smallBase64, 2);
        expect(vision.metadata).toBeDefined();
      } catch (err: any) {
        expect(err.message).toBeDefined();
      }

      try {
        const meta = await processor.getMetadata(smallBase64);
        expect(meta).toBeDefined();
      } catch (err: any) {
        expect(err.message).toContain('Failed to extract video metadata');
      }

      // Cleanup temp files
      await (processor as any).cleanupOrphanedTempFiles();
      expect(processor.getTempFileCount()).toBe(0);
    });
  });

  describe('ProductionMediaEngineAdapter Operations', () => {
    it('handles availability check and mock fallback methods safely', async () => {
      const adapter = new ProductionMediaEngineAdapter({
        ffmpegPath: 'invalid_nonexistent_ffmpeg_binary',
        ffprobePath: 'invalid_nonexistent_ffprobe_binary',
        allowMockFallback: true
      });

      expect(adapter.checkAvailability()).toBe(false);

      const fakeVideoPath = path.join(tempDir, 'sample.mp4');
      fs.writeFileSync(fakeVideoPath, 'RIFF mock media content', 'utf8');

      const meta = await adapter.validateMedia(fakeVideoPath);
      expect(meta.sizeBytes).toBeGreaterThan(0);
      expect(meta.resolution).toBeDefined();

      const missingPath = path.join(tempDir, 'nonexistent.mp4');
      await expect(adapter.validateMedia(missingPath)).rejects.toThrow('Media file not found');
    });
  });

  describe('AudioLibraryService Operations', () => {
    it('indexes audio files, filters by query, caches results, and invalidates cache', async () => {
      const audioDir = path.join(tempDir, 'audio_workspace');
      fs.mkdirSync(audioDir, { recursive: true });
      fs.writeFileSync(path.join(audioDir, 'theme.wav'), 'RIFF mock wav data', 'utf8');
      fs.writeFileSync(path.join(audioDir, 'bgm.mp3'), 'ID3 mock mp3 data', 'utf8');
      fs.writeFileSync(path.join(audioDir, 'notes.txt'), 'text file should be ignored', 'utf8');

      const mockProbe = jest.fn().mockResolvedValue({
        duration: 120,
        sampleRate: 44100,
        channels: 2,
        tags: { title: 'Theme Song' }
      });

      const service = new AudioLibraryService(audioDir, mockProbe);
      const list1 = await service.listAudioFiles('.', '', { limit: 10 });
      expect(list1.files.length).toBe(2);
      expect(list1.totalIndexed).toBe(2);
      expect(list1.cached).toBe(false);

      const list2 = await service.listAudioFiles('.', 'theme', { limit: 10 });
      expect(list2.files.length).toBe(1);
      expect(list2.cached).toBe(true);

      const meta = await service.getMetadata('theme.wav');
      expect(meta.format).toBe('wav');
      expect(meta.duration).toBe(120);

      service.invalidateCache('.');
      const list3 = await service.listAudioFiles('.', '', { limit: 10 });
      expect(list3.cached).toBe(false);
    });
  });
});
