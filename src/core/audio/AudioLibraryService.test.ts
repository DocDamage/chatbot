import fs from 'fs';
import os from 'os';
import path from 'path';
import { AudioLibraryService } from './AudioLibraryService';

describe('AudioLibraryService', () => {
  it('finds supported audio files and returns fallback metadata', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-library-'));
    fs.mkdirSync(path.join(root, 'samples'));
    fs.writeFileSync(path.join(root, 'samples', 'kick.wav'), Buffer.from('RIFF0000WAVE'));
    fs.writeFileSync(path.join(root, 'samples', 'notes.txt'), 'not audio');

    const service = new AudioLibraryService(root);
    const files = await service.listAudioFiles('.', '');
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('samples/kick.wav');

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
});
