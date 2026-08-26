import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import WebsiteWorkspacePanel from '../WebsiteWorkspacePanel';

describe('RT-WEB-002: WebsiteWorkspacePanel Component Suite', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((_url: string) => {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          project: { name: 'Saved site' },
          html: '<html><body><h1>Rendered</h1></body></html>'
        })
      });
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('toggles panel open and saves website project for preview', async () => {
    render(<WebsiteWorkspacePanel />);

    const toggle = screen.getByRole('button', { name: /website workspace/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const saveBtn = screen.getByRole('button', { name: /save and preview/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/saved locally and rendered in the sandbox/i)).toBeTruthy();
      expect(screen.getByTitle('Website preview')).toBeTruthy();
    });
  });

  it('handles invalid JSON gracefully', async () => {
    const { container } = render(<WebsiteWorkspacePanel />);

    fireEvent.click(screen.getByRole('button', { name: /website workspace/i }));

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '{ invalid JSON' } });

    fireEvent.click(screen.getByRole('button', { name: /save and preview/i }));

    await waitFor(() => {
      const status = container.querySelector('.workspace-status');
      expect(status).toBeTruthy();
      expect(status?.textContent).toMatch(/JSON|Expected/i);
    });
  });
});
