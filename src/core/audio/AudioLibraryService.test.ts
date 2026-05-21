import fs from 'fs';
import os from 'os';
import path from 'path';
import { AudioLibraryService } from './AudioLibraryService';

function createTestWav(samples: number[], sampleRate = 8000): Buffer {
  const bytesPerSample = 2;
  const channels = 1;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * bytesPerSample);
  });
  return buffer;
}

describe('AudioLibraryService', () => {
  it('finds supported audio files and returns fallback metadata', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-library-'));
    fs.mkdirSync(path.join(root, 'samples'));
    fs.writeFileSync(path.join(root, 'samples', 'kick.wav'), Buffer.from('RIFF0000WAVE'));
    fs.writeFileSync(path.join(root, 'samples', 'notes.txt'), 'not audio');

    const service = new AudioLibraryService(root);
    const result = await service.listAudioFiles('.', '');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('samples/kick.wav');
    expect(result.scannedFiles).toBe(2);
    expect(result.truncated).toBe(false);

    const metadata = await service.getMetadata('samples/kick.wav');
    expect(metadata.format).toBe('wav');
    expect(metadata.ffmpegAvailable).toBe(false);
    expect(metadata.size).toBeGreaterThan(0);
  });

  it('uses an injected FFmpeg probe when metadata is available', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-probe-'));
    fs.writeFileSync(path.join(root, 'loop.mp3'), Buffer.from('fake'));

    const service = new AudioLibraryService(root, async () => ({
      duration: 12.5,
      sampleRate: 44100,
      channels: 2,
      tags: { artist: 'Test' }
    }));

    const metadata = await service.getMetadata('loop.mp3');

    expect(metadata.ffmpegAvailable).toBe(true);
    expect(metadata.duration).toBe(12.5);
    expect(metadata.sampleRate).toBe(44100);
    expect(metadata.channels).toBe(2);
    expect(metadata.tags?.artist).toBe('Test');
    expect(metadata.notice).toBeUndefined();
  });

  it('paginates indexed audio results and reuses the cache', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-cache-'));
    fs.writeFileSync(path.join(root, 'a.wav'), Buffer.from('a'));
    fs.writeFileSync(path.join(root, 'b.wav'), Buffer.from('b'));
    fs.writeFileSync(path.join(root, 'c.wav'), Buffer.from('c'));

    const service = new AudioLibraryService(root);
    const first = await service.listAudioFiles('.', '', { limit: 2 });
    const second = await service.listAudioFiles('.', '', { limit: 2, offset: first.nextOffset });

    expect(first.files.map(file => file.name)).toEqual(['a.wav', 'b.wav']);
    expect(first.nextOffset).toBe(2);
    expect(first.cached).toBe(false);
    expect(second.files.map(file => file.name)).toEqual(['c.wav']);
    expect(second.cached).toBe(true);
  });

  it('reports when maxFiles truncates discovery', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-truncated-'));
    fs.writeFileSync(path.join(root, 'a.wav'), Buffer.from('a'));
    fs.writeFileSync(path.join(root, 'b.wav'), Buffer.from('b'));

    const service = new AudioLibraryService(root);
    const result = await service.listAudioFiles('.', '', { maxFiles: 1 });

    expect(result.scannedFiles).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.files).toHaveLength(1);
  });

  it('extracts deterministic waveform and amplitude analysis from PCM WAV files', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-waveform-'));
    fs.writeFileSync(path.join(root, 'loop.wav'), createTestWav([0, 0.5, -0.75, 1, -1, 0.25]));

    const service = new AudioLibraryService(root);
    const waveform = await service.getWaveform('loop.wav', 3);
    const analysis = await service.analyzeAudio('loop.wav');

    expect(waveform.available).toBe(true);
    expect(waveform.points).toHaveLength(16);
    expect(Math.max(...waveform.points)).toBe(0.999969);
    expect(waveform.points).toContain(0.5);
    expect(waveform.duration).toBe(0.00075);
    expect(analysis.available).toBe(true);
    expect(analysis.peakAmplitude).toBe(0.999969);
    expect(analysis.channelPeaks).toEqual([0.999969]);
    expect(analysis.estimatedTempo).toBeNull();
  });

  it('returns a structured unsupported state for non-decodable audio analysis', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-unsupported-'));
    fs.writeFileSync(path.join(root, 'loop.mp3'), Buffer.from('not really mp3'));

    const service = new AudioLibraryService(root);
    const waveform = await service.getWaveform('loop.mp3');
    const analysis = await service.analyzeAudio('loop.mp3');

    expect(waveform.available).toBe(false);
    expect(waveform.source).toBe('unsupported');
    expect(analysis.available).toBe(false);
    expect(analysis.format).toBe('mp3');
  });
});
