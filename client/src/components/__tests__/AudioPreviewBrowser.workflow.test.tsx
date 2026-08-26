import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import AudioPreviewBrowser from '../AudioPreviewBrowser';
import * as audioApi from '../../api/audio';

describe('RT-COV-003 / RT-CLIENT-004: AudioPreviewBrowser Playback and Metadata Workflows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('lists audio files, plays preview, and loads metadata into the parent workflow', async () => {
    const mockFiles: audioApi.AudioFileListResponse = {
      files: [
        {
          name: 'kick_808.wav',
          path: 'samples/kick_808.wav',
          extension: '.wav',
          size: 1024,
          modifiedTime: '2026-08-26T00:00:00Z',
          duration: 1.5,
          format: 'wav'
        }
      ],
      nextOffset: 50,
      totalIndexed: 1,
      scannedFiles: 1,
      truncated: false,
      cached: true
    };

    const mockMetadata: audioApi.AudioFileContext = {
      name: 'kick_808.wav',
      path: 'samples/kick_808.wav',
      extension: '.wav',
      size: 1024,
      modifiedTime: '2026-08-26T00:00:00Z',
      duration: 1.5,
      format: 'wav'
    };

    vi.spyOn(audioApi, 'listAudioFiles').mockResolvedValue(mockFiles);
    const loadSpy = vi.spyOn(audioApi, 'loadAudioMetadata').mockResolvedValue(mockMetadata);
    const onLoadAudio = vi.fn();

    render(<AudioPreviewBrowser onLoadAudio={onLoadAudio} />);

    await waitFor(() => {
      expect(screen.getByText('kick_808.wav')).toBeTruthy();
      expect(screen.getByText('More audio')).toBeTruthy();
    });

    // 1. Click filename to preview audio
    fireEvent.click(screen.getByText('kick_808.wav'));
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();

    // 2. Click Load button to load audio metadata
    fireEvent.click(screen.getByText('Load'));
    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledWith('samples/kick_808.wav');
      expect(onLoadAudio).toHaveBeenCalledWith(mockMetadata);
    });
  });

  it('performs query search and handles search errors', async () => {
    vi.spyOn(audioApi, 'listAudioFiles')
      .mockResolvedValueOnce({ files: [], totalIndexed: 0, scannedFiles: 0, truncated: false, cached: false })
      .mockRejectedValueOnce(new Error('Audio search failed'));

    const onLoadAudio = vi.fn();
    render(<AudioPreviewBrowser onLoadAudio={onLoadAudio} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('Search samples');
    fireEvent.change(input, { target: { value: 'synth' } });

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(screen.getByText(/Audio search failed/i)).toBeTruthy();
    });
  });
});
