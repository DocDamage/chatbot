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
    await user.click(screen.getByRole('tab', { name: /advanced/i }));

    expect(await screen.findByText(/fl studio mcp bridge \(dry-run first\)/i)).toBeTruthy();
    expect(screen.getByText(/control actions remain dry-run unless the bridge is connected/i)).toBeTruthy();
  });

  it('keeps technical settings behind clear section tabs', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => settingsPayload,
    }));

    render(<SettingsMenu />);

    await user.click(screen.getByRole('button', { name: /open settings/i }));

    expect(screen.getByRole('tab', { name: /workspace/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText(/fl studio mcp bridge/i)).toBeNull();
    expect(screen.getByRole('tab', { name: /advanced/i }).getAttribute('title')).toContain('embeddings');
  });

  it('surfaces provider and advanced controls without exposing them all at once', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => settingsPayload,
    }));

    render(<SettingsMenu />);

    await user.click(screen.getByRole('button', { name: /open settings/i }));
    await user.click(screen.getByRole('tab', { name: /ai connection/i }));
    await user.click(screen.getByRole('radio', { name: 'Gemini' }));
    expect(screen.getByLabelText('Gemini API key')).toBeTruthy();
    expect(screen.getByLabelText('Gemini model')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: /advanced/i }));
    expect(screen.getByLabelText('Embedding provider')).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: /use native transformers/i }));
    expect((screen.getByRole('checkbox', { name: /use native transformers/i }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText('MCP command').getAttribute('placeholder')).toBe('fl-studio-mcp.cmd');
  });
});
