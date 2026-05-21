import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsMenu from './SettingsMenu';

const settingsPayload = {
  settings: {},
  secrets: {},
  status: {
    activeProvider: 'template',
    configured: {},
    model: 'template',
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SettingsMenu accessibility', () => {
  it('focuses the dialog close button and restores focus when closed', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => settingsPayload,
    }));

    render(<SettingsMenu />);

    const opener = screen.getByRole('button', { name: /open settings/i });
    opener.focus();
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: /settings/i });
    expect(dialog).toBeTruthy();

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /close settings/i }));
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /settings/i })).toBeNull();
      expect(document.activeElement).toBe(opener);
    });
  });

  it('keeps tab focus inside the dialog', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => settingsPayload,
    }));

    render(<SettingsMenu />);

    await user.click(screen.getByRole('button', { name: /open settings/i }));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /close settings/i }));
    });

    await user.keyboard('{Shift>}{Tab}{/Shift}');

    expect(document.activeElement).toBe(screen.getByRole('button', { name: /save settings/i }));
  });

  it('labels FL Studio bridge settings as dry-run-first configuration', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => settingsPayload,
    }));

    render(<SettingsMenu />);

    await user.click(screen.getByRole('button', { name: /open settings/i }));

    expect(await screen.findByText(/fl studio mcp bridge \(dry-run first\)/i)).toBeTruthy();
    expect(screen.getByText(/control actions remain dry-run unless the bridge is connected/i)).toBeTruthy();
  });
});
