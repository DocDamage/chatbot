import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import MockApiWorkspacePanel from '../MockApiWorkspacePanel';

describe('RT-DEV-002: MockApiWorkspacePanel Component Suite', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/mock-api/status') {
        return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) });
      }
      if (url === '/api/mock-api/import') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            endpoint: '/api/mock/records',
            collection: {
              name: 'records',
              records: [{ name: 'Example', status: 'ready' }],
              updatedAt: '2026-08-26T00:00:00Z'
            }
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('toggles panel open and imports mock API fixture', async () => {
    render(<MockApiWorkspacePanel />);

    const toggle = screen.getByRole('button', { name: /mock api sandbox/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const importBtn = screen.getByRole('button', { name: /import fixture/i });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(screen.getByText(/ready at \/api\/mock\/records/i)).toBeTruthy();
      expect(screen.getByText(/\[\s*\{\s*"name": "example"/i)).toBeTruthy();
    });
  });

  it('handles import error from backend', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/mock-api/import') {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Invalid CSV fixture syntax' })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    render(<MockApiWorkspacePanel />);

    fireEvent.click(screen.getByRole('button', { name: /mock api sandbox/i }));
    fireEvent.click(screen.getByRole('button', { name: /import fixture/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid csv fixture syntax/i)).toBeTruthy();
    });
  });
});
