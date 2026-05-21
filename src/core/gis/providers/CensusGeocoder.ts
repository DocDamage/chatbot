import {
  GeocodeRequest,
  GeocodeResult,
  ReverseGeocodeRequest,
  ReverseGeocodeResult
} from '../../../types/gis';
import { GeocodingProvider } from '../GISProviderRegistry';

interface CensusMatch {
  matchedAddress?: string;
  coordinates?: {
    x?: number;
    y?: number;
  };
  tigerLine?: Record<string, unknown>;
  addressComponents?: Record<string, unknown>;
}

export class CensusGeocoder implements GeocodingProvider {
  readonly id = 'census-geocoder';
  readonly attribution = 'U.S. Census Geocoder';

  constructor(private readonly baseUrl = 'https://geocoding.geo.census.gov/geocoder') {}

  async geocode(request: GeocodeRequest): Promise<GeocodeResult[]> {
    const params = new URLSearchParams({
      address: request.query,
      benchmark: 'Public_AR_Current',
      format: 'json'
    });
    const response = await fetch(`${this.baseUrl}/locations/onelineaddress?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Census geocoder failed with ${response.status}`);
    }

    const payload = await response.json() as { result?: { addressMatches?: CensusMatch[] } };
    const matches = payload.result?.addressMatches || [];

    return matches.slice(0, request.limit || 5).flatMap((match, index): GeocodeResult[] => {
      const lat = match.coordinates?.y;
      const lng = match.coordinates?.x;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
      return [{
        id: `census-${index}-${lat}-${lng}`,
        label: match.matchedAddress || request.query,
        address: request.persistExactAddress ? match.matchedAddress : undefined,
        coordinate: { lat: lat as number, lng: lng as number },
        confidence: match.matchedAddress ? 0.88 : 0.65,
        provider: this.id,
        source: 'https://geocoding.geo.census.gov/geocoder',
        metadata: {
          tigerLine: match.tigerLine,
          addressComponents: match.addressComponents
        }
      }];
    });
  }

  async reverseGeocode(request: ReverseGeocodeRequest): Promise<ReverseGeocodeResult[]> {
    const params = new URLSearchParams({
      x: String(request.coordinate.lng),
      y: String(request.coordinate.lat),
      benchmark: 'Public_AR_Current',
      format: 'json'
    });
    const response = await fetch(`${this.baseUrl}/locations/coordinates?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Census reverse geocoder failed with ${response.status}`);
    }

    const payload = await response.json() as { result?: { geographies?: Record<string, Array<Record<string, unknown>>> } };
    const firstLayer = Object.values(payload.result?.geographies || {})[0] || [];
    const first = firstLayer[0];

    return [{
      id: `census-reverse-${request.coordinate.lat}-${request.coordinate.lng}`,
      label: first ? String(first.NAME || first.BASENAME || 'Census geography') : 'Census reverse geocode result',
      coordinate: request.coordinate,
      confidence: first ? 0.7 : 0.4,
      provider: this.id,
      source: 'https://geocoding.geo.census.gov/geocoder',
      metadata: first || {}
    }].slice(0, request.limit || 1);
  }
}
