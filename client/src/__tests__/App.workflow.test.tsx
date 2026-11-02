import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import App from '../App';

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as any;

describe('RT-UI-003 / RT-COV-003 / RT-CLIENT-005: Critical Client Coverage & Workspace Layout Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/settings')) {
        return {
          ok: true,
          json: async () => ({
            settings: {},
            secrets: {},
            status: {
              activeProvider: 'template',
              configured: {},
              model: 'template'
            }
          })
        };
      }
      return {
        ok: true,
        json: async () => ({})
      };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders interactive app header, subtitle, and AssistantChat', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Chatbot' })).toBeTruthy();
    expect(screen.getByText('A simple space to think, write, and build.')).toBeTruthy();
  });

  it('toggles advanced settings to reveal advanced workspace and files', async () => {
    render(<App />);

    // Open settings menu
    const settingsButton = screen.getByRole('button', { name: /open settings/i });
    fireEvent.click(settingsButton);

    // Wait for settings dialog content to load
    await waitFor(() => {
      expect(screen.getByText('Open advanced workspace')).toBeTruthy();
    });

    // Toggle advanced workspace tools
    const advancedToggle = screen.getByText('Open advanced workspace');
    fireEvent.click(advancedToggle);

    await waitFor(() => {
      expect(document.querySelector('.app-main.advanced-open')).toBeTruthy();
      expect(screen.getByLabelText('Workspace files')).toBeTruthy();
    });
  });
});
