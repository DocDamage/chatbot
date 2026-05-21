import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FileExplorerPanel from './FileExplorerPanel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FileExplorerPanel error handling', () => {
  it('displays structured 401 route errors from the file API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: { message: 'No authentication token provided', code: 'AUTHENTICATION_ERROR' },
      }),
    }));

    render(<FileExplorerPanel onLoadFile={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No authentication token provided')).toBeTruthy();
    });
  });
});
