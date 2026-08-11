import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StatusBar from './StatusBar';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StatusBar', () => {
  it.each([
    ['connected', 'Connected'],
    ['degraded', 'Degraded'],
    ['connecting', 'Connecting'],
    ['disconnected', 'Disconnected'],
  ] as const)('renders the %s connection state', (connectionState, label) => {
    render(<StatusBar connectionState={connectionState} messageCount={2} />);

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText('2 messages')).toBeTruthy();
  });

  it('keeps asynchronous connection and message updates in a polite live region', () => {
    const { rerender } = render(<StatusBar connectionState="connecting" messageCount={0} />);
    const liveStatus = screen.getByRole('status');

    expect(liveStatus.getAttribute('aria-live')).toBe('polite');
    expect(liveStatus.textContent).toContain('Connecting');

    rerender(<StatusBar connectionState="connected" messageCount={1} />);

    expect(liveStatus.textContent).toContain('Connected');
    expect(liveStatus.textContent).toContain('1 message');
  });

  it('refreshes the displayed time on the interval', () => {
    const toLocaleTimeString = vi.spyOn(Date.prototype, 'toLocaleTimeString');
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    render(<StatusBar />);
    expect(toLocaleTimeString).toHaveBeenCalledTimes(1);

    act(() => {
      const intervalCallback = setIntervalSpy.mock.calls[0]?.[0] as (() => void) | undefined;
      intervalCallback?.();
    });

    expect(toLocaleTimeString).toHaveBeenCalledTimes(2);
  });
});
