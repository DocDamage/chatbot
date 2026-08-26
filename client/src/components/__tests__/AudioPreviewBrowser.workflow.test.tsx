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

  it('lists audio files, plays preview, paginates with more results, and loads metadata', async () => {
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
      totalIndexed: 2,
      scannedFiles: 2,
      truncated: false,
      cached: true
    };

    const mockMoreFiles: audioApi.AudioFileListResponse = {
      files: [
        {
          name: 'snare_808.wav',
          path: 'samples/snare_808.wav',
          extension: '.wav',
          size: 2048,
          modifiedTime: '2026-08-26T00:00:00Z',
          duration: 1.0,
          format: 'wav'
        }
      ],
      nextOffset: undefined,
      totalIndexed: 2,
      scannedFiles: 2,
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

    vi.spyOn(audioApi, 'listAudioFiles')
      .mockResolvedValueOnce(mockFiles)
      .mockResolvedValueOnce(mockMoreFiles);
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

    // 2. Click More audio button to load page 2
    fireEvent.click(screen.getByText('More audio'));
    await waitFor(() => {
      expect(screen.getByText('snare_808.wav')).toBeTruthy();
    });

    // 3. Click Load button to load audio metadata
    fireEvent.click(screen.getAllByText('Load')[0]);
    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledWith('samples/kick_808.wav');
      expect(onLoadAudio).toHaveBeenCalledWith(mockMetadata);
    });
  });

  it('handles audio preview play rejection and metadata load errors', async () => {
    window.HTMLMediaElement.prototype.play = vi.fn().mockRejectedValue(new Error('Format not supported'));
    vi.spyOn(audioApi, 'listAudioFiles').mockResolvedValue({
      files: [
        {
          name: 'corrupt.ogg',
          path: 'samples/corrupt.ogg',
          extension: '.ogg',
          size: 512,
          modifiedTime: '2026-08-26T00:00:00Z',
          duration: 0,
          format: 'ogg'
        }
      ],
      totalIndexed: 1,
      scannedFiles: 1,
      truncated: false,
      cached: false
    });
    vi.spyOn(audioApi, 'loadAudioMetadata').mockRejectedValue(new Error('Failed to load audio metadata'));

    render(<AudioPreviewBrowser onLoadAudio={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('corrupt.ogg')).toBeTruthy();
    });

    // Click to preview -> triggers .catch()
    fireEvent.click(screen.getByText('corrupt.ogg'));
    await waitFor(() => {
      expect(screen.getByText(/Preview is not supported for this file in the browser/i)).toBeTruthy();
    });

    // Click Load -> triggers metadata load error catch
    fireEvent.click(screen.getByText('Load'));
    await waitFor(() => {
      expect(screen.getByText(/Failed to load audio metadata/i)).toBeTruthy();
    });
  });

  it('performs query search via Enter key and handles search errors', async () => {
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

    // Press Enter to trigger search
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Audio search failed/i)).toBeTruthy();
    });
  });
});
