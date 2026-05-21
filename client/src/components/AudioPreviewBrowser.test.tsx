import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AudioPreviewBrowser from './AudioPreviewBrowser';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AudioPreviewBrowser error handling', () => {
  it('displays structured 403 route errors from the audio API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        error: { message: 'Insufficient permissions', code: 'AUTHORIZATION_ERROR' },
      }),
    }));

    render(<AudioPreviewBrowser onLoadAudio={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Insufficient permissions')).toBeTruthy();
    });
  });
});
