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
});
