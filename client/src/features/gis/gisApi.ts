import type { GeocodeResponse, GISCoordinate, RouteResponse } from './gisTypes';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    throw new Error(payload?.error?.message || payload?.error || `${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function geocodeAddress(query: string): Promise<GeocodeResponse> {
  return postJson<GeocodeResponse>('/api/gis/geocode', { query });
}

export function reverseGeocode(coordinate: GISCoordinate): Promise<GeocodeResponse> {
  return postJson<GeocodeResponse>('/api/gis/reverse-geocode', { coordinate });
}

export function calculateRoute(stops: Array<string | GISCoordinate>, profile: 'driving' | 'walking' | 'cycling' = 'driving'): Promise<RouteResponse> {
  return postJson<RouteResponse>('/api/gis/route', { stops, profile });
}
