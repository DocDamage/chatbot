import { AudioLibraryService } from '../AudioLibraryService';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('B75-08: AudioLibraryService Full Decision Matrix', () => {
  let tempDir: string;
  let service: AudioLibraryService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-lib-test-'));
    service = new AudioLibraryService(tempDir, async () => ({
      duration: 12.5,
      sampleRate: 44100,
      channels: 2,
      tags: { artist: 'Synth Producer' }
    }));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // Helper to create valid 16-bit PCM WAV buffer
  function createWavBuffer(sampleRate = 44100, numChannels = 1, numSamples = 100): Buffer {
    const blockAlign = numChannels * 2;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // subchunk1 size
    buffer.writeUInt16LE(1, 20); // PCM audio format
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34); // bits per sample
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < numSamples * numChannels; i++) {
      buffer.writeInt16LE(Math.round(Math.sin(i / 10) * 16000), 44 + i * 2);
    }
    return buffer;
  }

  it('lists audio files, searches by query, and caches index results', async () => {
    const wavPath = path.join(tempDir, 'kick.wav');
    const mp3Path = path.join(tempDir, 'snare.mp3');
    const txtPath = path.join(tempDir, 'readme.txt');

    fs.writeFileSync(wavPath, createWavBuffer());
    fs.writeFileSync(mp3Path, Buffer.from('mp3-mock-data'));
    fs.writeFileSync(txtPath, 'text content');

    const initialList = await service.listAudioFiles('.', '', { limit: 10 });
    expect(initialList.files.length).toBe(2);
    expect(initialList.cached).toBe(false);

    // Second call hits cache
    const cachedList = await service.listAudioFiles('.', 'kick', { limit: 10 });
    expect(cachedList.files.length).toBe(1);
    expect(cachedList.cached).toBe(true);

    // Invalidate cache
    service.invalidateCache('.');
    const freshList = await service.listAudioFiles('.', '', { limit: 10 });
    expect(freshList.cached).toBe(false);
  });

  it('probes audio metadata and handles probe failures gracefully', async () => {
    const wavPath = path.join(tempDir, 'lead.wav');
    fs.writeFileSync(wavPath, createWavBuffer());

    const meta = await service.getMetadata('lead.wav');
    expect(meta.duration).toBe(12.5);
    expect(meta.ffmpegAvailable).toBe(true);
    expect(meta.tags?.artist).toBe('Synth Producer');

    // Failing probe fallback
    const failingService = new AudioLibraryService(tempDir, async () => {
      throw new Error('ffprobe missing');
    });
    const fallbackMeta = await failingService.getMetadata('lead.wav');
    expect(fallbackMeta.ffmpegAvailable).toBe(false);
    expect(fallbackMeta.notice).toContain('unavailable');
  });

  it('decodes PCM WAV waveforms and calculates audio statistics', async () => {
    const wavPath = path.join(tempDir, 'bass.wav');
    fs.writeFileSync(wavPath, createWavBuffer(44100, 2, 256));

    const waveform = await service.getWaveform('bass.wav', 64);
    expect(waveform.available).toBe(true);
    expect(waveform.points.length).toBe(64);
    expect(waveform.source).toBe('wav-pcm');

    const analysis = await service.analyzeAudio('bass.wav');
    expect(analysis.available).toBe(true);
    expect(analysis.peakAmplitude).toBeGreaterThan(0);
    expect(analysis.channelPeaks?.length).toBe(2);

    // Unsupported/invalid file waveform and analysis fallback
    const mp3Path = path.join(tempDir, 'vocal.mp3');
    fs.writeFileSync(mp3Path, Buffer.from('non-wav-content'));

    const mp3Waveform = await service.getWaveform('vocal.mp3');
    expect(mp3Waveform.available).toBe(false);
    expect(mp3Waveform.source).toBe('unsupported');

    const mp3Analysis = await service.analyzeAudio('vocal.mp3');
    expect(() => service.getPreviewPath('../../../secret.wav')).toThrow();
    expect(() => service.getPreviewPath('readme.txt')).toThrow();
    await expect(service.getMetadata('readme.txt')).rejects.toThrow();
  });

  it('decodes 32-bit float WAV and handles walk truncation when maxFiles is reached', async () => {
    // 32-bit float WAV
    const sampleRate = 48000;
    const numSamples = 50;
    const dataSize = numSamples * 4; // 1 channel * 4 bytes
    const floatWav = Buffer.alloc(44 + dataSize);
    floatWav.write('RIFF', 0);
    floatWav.writeUInt32LE(36 + dataSize, 4);
    floatWav.write('WAVE', 8);
    floatWav.write('fmt ', 12);
    floatWav.writeUInt32LE(16, 16);
    floatWav.writeUInt16LE(3, 20); // IEEE float format
    floatWav.writeUInt16LE(1, 22); // 1 channel
    floatWav.writeUInt32LE(sampleRate, 24);
    floatWav.writeUInt32LE(sampleRate * 4, 28);
    floatWav.writeUInt16LE(4, 32);
    floatWav.writeUInt16LE(32, 34); // 32 bits per sample
    floatWav.write('data', 36);
    floatWav.writeUInt32LE(dataSize, 40);
    for (let i = 0; i < numSamples; i++) {
      floatWav.writeFloatLE(0.5 * Math.sin(i), 44 + i * 4);
    }

    const floatPath = path.join(tempDir, 'float.wav');
    fs.writeFileSync(floatPath, floatWav);

    const waveform = await service.getWaveform('float.wav', 10);
    expect(waveform.available).toBe(true);
    expect(waveform.points.length).toBe(16);

    // Test maxFiles truncation
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(tempDir, `file_${i}.wav`), createWavBuffer(44100, 1, 10));
    }
    const truncatedList = await service.listAudioFiles('.', '', { maxFiles: 3, cacheTtlMs: 0 });
    expect(truncatedList.truncated).toBe(true);
  });
});
