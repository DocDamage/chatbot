import { afterEach, describe, expect, it, vi } from 'vitest';
import { listAudioFiles, loadAudioMetadata } from './audio';

const mockFetch = (response: Partial<Response>) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('audio API client', () => {
  it('returns the server file list and encodes query parameters', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({
        files: [{ path: 'beat.wav', name: 'beat.wav' }],
        totalIndexed: 1,
        scannedFiles: 1,
        truncated: false,
        cached: false,
      }),
    });

    const result = await listAudioFiles('music stems', 'kick/snare', { limit: 25, offset: 50 });

    expect(result.files).toEqual([{ path: 'beat.wav', name: 'beat.wav' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/audio/files?root=music+stems&q=kick%2Fsnare&limit=25&offset=50',
      { signal: undefined }
    );
  });

  it('throws clear errors for failed metadata loads', async () => {
    mockFetch({ ok: false });

    await expect(loadAudioMetadata('missing.wav')).rejects.toThrow('Unable to load audio metadata');
  });

  it('preserves structured 403 audio route errors', async () => {
    mockFetch({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        error: { message: 'Insufficient permissions', code: 'AUTHORIZATION_ERROR' },
      }),
    });

    await expect(listAudioFiles()).rejects.toMatchObject({
      message: 'Insufficient permissions',
      status: 403,
      code: 'AUTHORIZATION_ERROR',
    });
  });
});
