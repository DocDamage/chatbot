import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VideoProcessor } from '../VideoProcessor';
import { AudioLibraryService } from '../../audio/AudioLibraryService';
import { ProductionMediaEngineAdapter } from '../localization/ProductionMediaEngineAdapter';
import { DemucsWorkerAdapter } from '../../audio/stemdeck/DemucsWorkerAdapter';

describe('B75-06: Media, Video, and Audio Processing Decision Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('VideoProcessor', () => {
    it('initializes with policy, temp directory, and health check', async () => {
      const processor = new VideoProcessor({
        maxSizeMB: 50,
        maxDurationSeconds: 120,
        maxFrames: 30,
        tempDir,
      });

      const health = await processor.getDependencyHealth();
      expect(health.tempDir).toBe(tempDir);
      expect(health.policy.maxSizeMB).toBe(50);
      expect(health.policy.maxDurationSeconds).toBe(120);
      expect(health.policy.maxFrames).toBe(30);
      expect(processor.getTempFileCount()).toBe(0);
    });

    it('handles video validation, oversize rejection, and gracefully handles invalid streams', async () => {
      const processor = new VideoProcessor({ tempDir, maxSizeMB: 1 });

      const dummyBase64 = Buffer.from('fake video header data').toString('base64');
      const validation = await processor.validateVideo(dummyBase64);
      expect(validation.status).toBeDefined();
      expect(validation.data?.size).toBeGreaterThan(0);

      // Oversize base64 string (> 1MB)
      const oversizeBuffer = Buffer.alloc(1.5 * 1024 * 1024);
      const oversizeBase64 = oversizeBuffer.toString('base64');
      const oversizeValidation = await processor.validateVideo(oversizeBase64);
      expect(oversizeValidation.status).toBe('rejected');
      expect(oversizeValidation.error).toContain('exceeds maximum');

      // Invalid stream metadata throws or returns defaults
      await expect(processor.getMetadata(dummyBase64)).rejects.toThrow();

      const frames = await processor.extractFrames(dummyBase64, 1);
      expect(frames).toEqual([]);

      const keyFrames = await processor.extractKeyFrames(dummyBase64, 0.5);
      expect(keyFrames).toEqual([]);
    });
  });

  describe('AudioLibraryService', () => {
    it('lists audio files, resolves metadata, and extracts waveform for wav-pcm format', async () => {
      const service = new AudioLibraryService(tempDir);

      // Create a mock wav file with a simple header
      const wavPath = path.join(tempDir, 'test.wav');
      const wavHeader = Buffer.alloc(44);
      wavHeader.write('RIFF', 0);
      wavHeader.writeUInt32LE(36 + 16, 4);
      wavHeader.write('WAVE', 8);
      wavHeader.write('fmt ', 12);
      wavHeader.writeUInt32LE(16, 16);
      wavHeader.writeUInt16LE(1, 20); // PCM
      wavHeader.writeUInt16LE(1, 22); // 1 channel
      wavHeader.writeUInt32LE(44100, 24); // sample rate
      wavHeader.writeUInt32LE(88200, 28);
      wavHeader.writeUInt16LE(2, 32);
      wavHeader.writeUInt16LE(16, 34);
      wavHeader.write('data', 36);
      wavHeader.writeUInt32LE(16, 40);

      const pcmData = Buffer.alloc(16);
      fs.writeFileSync(wavPath, Buffer.concat([wavHeader, pcmData]));

      const listResult = await service.listAudioFiles();
      expect(listResult.files.length).toBe(1);
      expect(listResult.files[0].name).toBe('test.wav');

      const metadata = await service.getMetadata(wavPath);
      expect(metadata.name).toBe('test.wav');

      const waveform = await service.getWaveform(wavPath, 10);
      expect(waveform.available).toBe(true);
      expect(waveform.source).toBe('wav-pcm');

      const analysis = await service.analyzeAudio(wavPath);
      expect(analysis.available).toBe(true);
      expect(analysis.source).toBe('wav-pcm');
    });

    it('handles unsupported audio formats and missing files gracefully', async () => {
      const service = new AudioLibraryService(tempDir);

      const missingWave = await service.getWaveform('missing.wav');
      expect(missingWave.available).toBe(false);

      const mp3Path = path.join(tempDir, 'song.mp3');
      fs.writeFileSync(mp3Path, 'fake mp3 data');

      const mp3Wave = await service.getWaveform(mp3Path);
      expect(mp3Wave.available).toBe(false);
      expect(mp3Wave.source).toBe('unsupported');
    });
  });

  describe('ProductionMediaEngineAdapter and DemucsWorkerAdapter', () => {
    it('probes media validation and falls back gracefully when ffmpeg is unavailable', async () => {
      const adapter = new ProductionMediaEngineAdapter({
        ffmpegPath: 'nonexistent_ffmpeg_binary',
        allowMockFallback: true,
      });

      const mediaPath = path.join(tempDir, 'video.mp4');
      fs.writeFileSync(mediaPath, 'dummy media');

      const validation = await adapter.validateMedia(mediaPath);
      expect(validation.duration).toBeGreaterThanOrEqual(0);
      expect(validation.sizeBytes).toBeGreaterThan(0);
    });

    it('probes Demucs hardware acceleration capabilities and worker status', async () => {
      const worker = new DemucsWorkerAdapter();
      expect(worker.isAvailable()).toBe(false);

      const hw = await worker.probeHardwareAcceleration();
      expect(hw.workerAvailable).toBe(false);
      expect(hw.recommendedModel).toBeDefined();
      expect(['cpu', 'cuda', 'mps']).toContain(hw.device);
    });
  });
});
