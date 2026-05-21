import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FLStudioControlPanel from './FLStudioControlPanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/flstudio/status') {
      return {
        ok: true,
        json: async () => ({
          connected: false,
          serverId: 'fl-studio-mcp',
          state: { connected: false, serverId: 'fl-studio-mcp', limitations: [] },
        }),
      } as Response;
    }
    if (url === '/api/flstudio/tools') {
      return {
        ok: true,
        json: async () => ({ toolNames: ['fl_get_transport_status', 'fl_play', 'fl_record'] }),
      } as Response;
    }
    return {
      ok: true,
      json: async () => ({
        response: 'I planned the FL Studio control actions without touching your DAW.',
        request: init?.body,
      }),
    } as Response;
  });
});

describe('FLStudioControlPanel', () => {
  it('labels offline control as dry-run and explains live-mode safety', async () => {
    const user = userEvent.setup();
    render(<FLStudioControlPanel />);

    await waitFor(() => expect(screen.getByText(/bridge offline/i)).toBeTruthy());
    expect(screen.getByText(/dry-run available/i)).toBeTruthy();
    expect(screen.getByText(/dry-run: actions are planned without touching fl studio/i)).toBeTruthy();

    await user.selectOptions(screen.getByLabelText(/mode/i), 'live_control');

    expect(screen.getByText(/bridge offline: live modes fall back/i)).toBeTruthy();
    expect(screen.getByText(/live modes can change the active fl studio project/i)).toBeTruthy();
  });

  it('sends selected mode and confirmation state to the command route', async () => {
    const user = userEvent.setup();
    render(<FLStudioControlPanel />);

    await waitFor(() => expect(screen.getByText(/bridge offline/i)).toBeTruthy());
    await user.selectOptions(screen.getByLabelText(/mode/i), 'confirm_required');
    await user.click(screen.getByLabelText(/confirm risky actions/i));
    await user.click(screen.getByRole('button', { name: /^plan$/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/flstudio/command', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"mode":"confirm_required"'),
      }));
      expect(fetch).toHaveBeenCalledWith('/api/flstudio/command', expect.objectContaining({
        body: expect.stringContaining('"confirmed":true'),
      }));
    });
  });
});
