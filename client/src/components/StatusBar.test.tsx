import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import StatusBar from './StatusBar';

afterEach(() => {
  cleanup();
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
});
