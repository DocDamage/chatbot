import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FileExplorerPanel from './FileExplorerPanel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFileTree() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ name: '.', path: '.', type: 'directory', children: [] }),
  }));
}

describe('FileExplorerPanel accessibility and error handling', () => {
  it('uses the browse landmark label by default', () => {
    stubFileTree();

    render(<FileExplorerPanel onLoadFile={vi.fn()} />);

    expect(screen.getByRole('complementary', { name: 'Workspace files' })).toBeTruthy();
  });

  it('uses a distinct landmark label in select mode', () => {
    stubFileTree();

    render(<FileExplorerPanel mode="select" onSelect={vi.fn()} />);

    expect(screen.getByRole('complementary', { name: 'Selectable workspace files' })).toBeTruthy();
  });

  it('allows callers to provide a unique landmark label', () => {
    stubFileTree();

    render(<FileExplorerPanel ariaLabel="Sprite source files" mode="select" onSelect={vi.fn()} />);

    expect(screen.getByRole('complementary', { name: 'Sprite source files' })).toBeTruthy();
  });

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
