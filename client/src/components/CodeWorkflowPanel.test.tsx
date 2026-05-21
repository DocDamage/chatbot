import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CodeWorkflowPanel from './CodeWorkflowPanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      results: [{ path: 'src/App.tsx' }],
      symbols: [{ name: 'App' }],
      ok: true,
    }),
  } as Response);
});

describe('CodeWorkflowPanel', () => {
  it('maps search and symbol controls to dedicated code routes', async () => {
    const user = userEvent.setup();
    render(<CodeWorkflowPanel mode="implement" />);

    await user.type(screen.getByPlaceholderText(/search code files/i), 'App');
    await user.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/code/files/search?q=App', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    await user.click(screen.getByRole('button', { name: 'src/App.tsx' }));

    expect(fetch).toHaveBeenLastCalledWith('/api/code/symbols?file=src%2FApp.tsx');
  });

  it('maps ask, plan, patch, review, and verify actions to code routes', async () => {
    const user = userEvent.setup();
    render(<CodeWorkflowPanel mode="implement" />);

    await user.type(screen.getByLabelText(/code prompt/i), 'Add a release gate');
    await user.click(screen.getByRole('button', { name: /ask agent/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: /plan work/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: /create patch/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    await user.type(screen.getByLabelText(/diff review/i), 'diff --git a/a b/a');
    await user.click(screen.getByRole('button', { name: /review diff/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    await user.click(screen.getByRole('button', { name: /verify typecheck/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/code/ask', expect.objectContaining({ method: 'POST' }));
      expect(fetch).toHaveBeenCalledWith('/api/code/plan', expect.objectContaining({ method: 'POST' }));
      expect(fetch).toHaveBeenCalledWith('/api/code/patch', expect.objectContaining({ method: 'POST' }));
      expect(fetch).toHaveBeenCalledWith('/api/code/review', expect.objectContaining({ method: 'POST' }));
      expect(fetch).toHaveBeenCalledWith('/api/code/verify', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('disables patch and verify controls outside code execution modes', async () => {
    const user = userEvent.setup();
    render(<CodeWorkflowPanel mode="ask" />);

    await user.type(screen.getByLabelText(/code prompt/i), 'Explain this file');

    expect(screen.getByRole('button', { name: /create patch/i }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /verify typecheck/i }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /ask agent/i }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: /plan work/i }).hasAttribute('disabled')).toBe(false);
  });

  it('displays structured 400 route errors without dumping backend details', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: {
          message: 'q is required',
          code: 'BAD_REQUEST',
          details: { secret: 'server-only-token' },
        },
      }),
    } as Response);

    render(<CodeWorkflowPanel mode="implement" />);

    await user.type(screen.getByPlaceholderText(/search code files/i), 'x');
    await user.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText('q is required')).toBeTruthy());
    expect(screen.queryByText(/server-only-token/i)).toBeNull();
  });
});
