import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateRoute, geocodeAddress, reverseGeocode } from './gisApi';

const mockFetch = (response: Partial<Response>) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gisApi client', () => {
  it('posts geocoding, reverse-geocoding, and routing requests', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await geocodeAddress('1600 Amphitheatre Pkwy');
    await reverseGeocode({ lat: 37.422, lng: -122.084 });
    await calculateRoute(['Point A', 'Point B']);
    await calculateRoute(['Point A', 'Point B'], 'walking');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/gis/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '1600 Amphitheatre Pkwy' }),
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/gis/reverse-geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinate: { lat: 37.422, lng: -122.084 } }),
    });

    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/gis/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stops: ['Point A', 'Point B'], profile: 'driving' }),
    });

    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/gis/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stops: ['Point A', 'Point B'], profile: 'walking' }),
    });
  });

  it('handles structured and unstructured error formats', async () => {
    // 1. error with payload.error.message
    mockFetch({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid geocode query' } }),
    });
    await expect(geocodeAddress('')).rejects.toThrow('Invalid geocode query');

    // 2. error with payload.error string
    mockFetch({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Route not found' }),
    });
    await expect(calculateRoute(['A', 'B'])).rejects.toThrow('Route not found');

    // 3. error with unparseable json fallback to statusText
    mockFetch({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => { throw new Error('Unparseable'); },
    });
    await expect(reverseGeocode({ lat: 0, lng: 0 })).rejects.toThrow('503 Service Unavailable');
  });
});
