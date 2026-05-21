import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GISMapPanel from './GISMapPanel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GISMapPanel', () => {
  it('trims geocode input and displays provider warnings', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{
          id: 'white-house',
          label: 'White House',
          coordinate: { lat: 38.8977, lng: -77.0365 },
          confidence: 0.95,
          provider: 'development-geocoder'
        }],
        warnings: ['development-geocoder is a deterministic development provider.'],
        mapArtifact: {
          layers: [],
          markers: [{
            id: 'white-house',
            label: 'White House',
            coordinate: { lat: 38.8977, lng: -77.0365 }
          }],
          attribution: [],
          providerMetadata: []
        }
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<GISMapPanel />);

    await user.type(screen.getByLabelText(/address or place/i), '  White House  ');
    await user.click(screen.getByRole('button', { name: /^map$/i }));

    await waitFor(() => {
      expect(screen.getByText(/found 1 geocoding result/i)).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/gis/geocode', expect.objectContaining({
      body: JSON.stringify({ query: 'White House' })
    }));
    expect(screen.getByRole('list', { name: /gis warnings/i })).toBeTruthy();
  });

  it('clears stale map output after a route error', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            id: 'white-house',
            label: 'White House',
            coordinate: { lat: 38.8977, lng: -77.0365 },
            confidence: 0.95,
            provider: 'development-geocoder'
          }],
          warnings: [],
          mapArtifact: {
            layers: [],
            markers: [{
              id: 'white-house',
              label: 'White House',
              coordinate: { lat: 38.8977, lng: -77.0365 }
            }],
            attribution: [],
            providerMetadata: []
          }
        })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: { message: 'Could not geocode stop: [REDACTED_ADDRESS]' } })
      }));

    render(<GISMapPanel />);

    await user.type(screen.getByLabelText(/address or place/i), 'White House');
    await user.click(screen.getByRole('button', { name: /^map$/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/gis result/i)).toBeTruthy();
    });

    await user.type(screen.getByLabelText(/route from/i), 'Unknown');
    await user.type(screen.getByLabelText(/^to$/i), 'Nowhere');
    await user.click(screen.getByRole('button', { name: /^route$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Could not geocode stop');
    });
    expect(screen.queryByLabelText(/gis result/i)).toBeNull();
    expect(screen.queryByText(/found 1 geocoding result/i)).toBeNull();
  });
});
