import {
  GeocodeRequest,
  GeocodeResult,
  GISCoordinate,
  GISGeometry,
  ParcelResult,
  ParcelSearchRequest,
  PlaceResult,
  PlaceSearchRequest,
  ReverseGeocodeRequest,
  ReverseGeocodeResult,
  RouteProviderRequest,
  RouteResult,
  RouteStep
} from '../../../types/gis';
import { GeocodingProvider, ParcelProvider, PlacesProvider, RoutingProvider } from '../GISProviderRegistry';
import { SpatialAnalysisService } from '../SpatialAnalysisService';

const DEFAULT_CENTER: GISCoordinate = {
  lat: Number(process.env.GIS_DEFAULT_CENTER_LAT || 41.2705),
  lng: Number(process.env.GIS_DEFAULT_CENTER_LNG || -72.9470)
};

const SEEDED_LOCATIONS: Record<string, GISCoordinate> = {
  'times square': { lat: 40.758, lng: -73.9855 },
  'central park': { lat: 40.7812, lng: -73.9665 },
  '1600 pennsylvania ave nw': { lat: 38.8977, lng: -77.0365 },
  'white house': { lat: 38.8977, lng: -77.0365 },
  'west haven': { lat: 41.2705, lng: -72.9470 },
  'new haven': { lat: 41.3083, lng: -72.9279 }
};

export class DevelopmentGeocodingProvider implements GeocodingProvider {
  readonly id = 'development-geocoder';
  readonly attribution = 'Development geocoder; replace with Census, Mapbox, Google, or self-hosted Nominatim for production.';

  async geocode(request: GeocodeRequest): Promise<GeocodeResult[]> {
    const normalized = request.query.toLowerCase().trim();
    const seeded = Object.entries(SEEDED_LOCATIONS).find(([key]) => normalized.includes(key));
    const coordinate = seeded?.[1] || this.coordinateFromQuery(normalized);

    return [{
      id: `dev-geocode-${this.slug(request.query)}`,
      label: request.query,
      address: request.persistExactAddress ? request.query : undefined,
      coordinate,
      confidence: seeded ? 0.95 : 0.55,
      provider: this.id,
      source: 'deterministic-development-provider',
      metadata: {
        seeded: Boolean(seeded),
        productionReady: false
      }
    }].slice(0, request.limit || 1);
  }

  async reverseGeocode(request: ReverseGeocodeRequest): Promise<ReverseGeocodeResult[]> {
    return [{
      id: `dev-reverse-${request.coordinate.lat.toFixed(5)}-${request.coordinate.lng.toFixed(5)}`,
      label: `Approximate development location at ${request.coordinate.lat.toFixed(5)}, ${request.coordinate.lng.toFixed(5)}`,
      coordinate: request.coordinate,
      confidence: 0.5,
      provider: this.id,
      source: 'deterministic-development-provider'
    }].slice(0, request.limit || 1);
  }

  private coordinateFromQuery(query: string): GISCoordinate {
    let hash = 0;
    for (let index = 0; index < query.length; index += 1) {
      hash = ((hash << 5) - hash + query.charCodeAt(index)) | 0;
    }
    const latOffset = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.08;
    const lngOffset = ((Math.abs(hash >> 8) % 1000) / 1000 - 0.5) * 0.08;
    return {
      lat: Number((DEFAULT_CENTER.lat + latOffset).toFixed(6)),
      lng: Number((DEFAULT_CENTER.lng + lngOffset).toFixed(6))
    };
  }

  private slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'location';
  }
}

export class DevelopmentRoutingProvider implements RoutingProvider {
  readonly id = 'development-routing';
  readonly attribution = 'Development straight-line routing; replace with OSRM, Valhalla, GraphHopper, Mapbox, or Google Routes for production.';

  private readonly spatial = new SpatialAnalysisService();

  async route(request: RouteProviderRequest): Promise<RouteResult> {
    if (request.stops.length < 2) {
      throw new Error('Routing requires at least two resolved stops.');
    }

    let totalDistance = 0;
    const steps: RouteStep[] = [];

    for (let index = 1; index < request.stops.length; index += 1) {
      const from = request.stops[index - 1];
      const to = request.stops[index];
      const distanceMeters = this.spatial.distanceMeters(from, to);
      totalDistance += distanceMeters;
      steps.push({
        instruction: `Travel from ${from.label || `stop ${index}`} to ${to.label || `stop ${index + 1}`}`,
        distanceMeters,
        durationSeconds: Math.round(distanceMeters / this.speedMetersPerSecond(request.profile || 'driving'))
      });
    }

    const geometry: GISGeometry = {
      type: 'LineString',
      coordinates: request.stops.map(stop => [stop.lng, stop.lat]),
      crs: 'EPSG:4326'
    };

    return {
      id: `dev-route-${Date.now().toString(36)}`,
      profile: request.profile || 'driving',
      distanceMeters: totalDistance,
      durationSeconds: Math.round(totalDistance / this.speedMetersPerSecond(request.profile || 'driving')),
      geometry,
      steps,
      provider: this.id,
      source: 'deterministic-development-provider',
      metadata: {
        routeType: 'straight-line-polyline',
        productionReady: false
      }
    };
  }

  private speedMetersPerSecond(profile: 'driving' | 'walking' | 'cycling'): number {
    if (profile === 'walking') return 1.4;
    if (profile === 'cycling') return 5.5;
    return 13.4;
  }
}

export class DevelopmentPlacesProvider implements PlacesProvider {
  readonly id = 'development-places';
  readonly attribution = 'Development place search; replace with Google Places, Foursquare, Overpass, or local business datasets for production.';

  private readonly spatial = new SpatialAnalysisService();

  async search(request: PlaceSearchRequest): Promise<PlaceResult[]> {
    const center = this.extractCenter(request.center) || DEFAULT_CENTER;
    const candidates: PlaceResult[] = [
      this.place('coffee', 'Demo Coffee Lab', center, 95, 'coffee'),
      this.place('restaurant', 'Demo Route Diner', center, 220, 'restaurant'),
      this.place('hardware', 'Demo Hardware Supply', center, 430, 'hardware')
    ];

    return candidates
      .filter(place => !request.query || place.name.toLowerCase().includes(request.query.toLowerCase()) || place.category?.includes(request.query.toLowerCase()))
      .slice(0, request.limit || 10);
  }

  private place(id: string, name: string, center: GISCoordinate, metersEast: number, category: string): PlaceResult {
    const coordinate = {
      lat: center.lat,
      lng: center.lng + metersEast / 111320 / Math.cos((center.lat * Math.PI) / 180)
    };

    return {
      id: `dev-place-${id}`,
      name,
      coordinate,
      category,
      address: undefined,
      distanceMeters: this.spatial.distanceMeters(center, coordinate),
      provider: this.id,
      source: 'deterministic-development-provider',
      metadata: { productionReady: false }
    };
  }

  private extractCenter(value: PlaceSearchRequest['center']): GISCoordinate | undefined {
    if (!value || typeof value === 'string' || 'query' in value) return undefined;
    return Number.isFinite(value.lat) && Number.isFinite(value.lng) ? value : undefined;
  }
}

export class DevelopmentParcelProvider implements ParcelProvider {
  readonly id = 'development-parcels';
  readonly attribution = 'Development parcel generator; replace with county ArcGIS REST, state open data, or a licensed parcel provider for production.';

  async search(request: ParcelSearchRequest): Promise<ParcelResult[]> {
    const coordinate = this.extractCoordinate(request.coordinate);
    const center = coordinate || this.centerFromBounds(request.bounds);
    const size = 0.0015;
    const geometry: GISGeometry = {
      type: 'Polygon',
      coordinates: [[
        [center.lng - size, center.lat - size],
        [center.lng + size, center.lat - size],
        [center.lng + size, center.lat + size],
        [center.lng - size, center.lat + size],
        [center.lng - size, center.lat - size]
      ]],
      crs: 'EPSG:4326'
    };

    return [{
      id: `dev-parcel-${request.parcelId || 'sample'}`,
      label: request.parcelId ? `Development parcel ${request.parcelId}` : 'Development parcel sample',
      parcelId: request.parcelId || 'DEV-PARCEL-001',
      address: undefined,
      geometry,
      centroid: center,
      properties: {
        zoning: 'DEMO',
        note: 'Generated sample parcel. Configure GIS_PARCEL_PROVIDER=arcgis for real parcel layers.'
      },
      provider: this.id,
      source: 'deterministic-development-provider',
      metadata: { productionReady: false }
    }].slice(0, request.limit || 1);
  }

  private extractCoordinate(value: ParcelSearchRequest['coordinate']): GISCoordinate | undefined {
    if (!value || typeof value === 'string' || 'query' in value) return undefined;
    return Number.isFinite(value.lat) && Number.isFinite(value.lng) ? value : undefined;
  }

  private centerFromBounds(bounds?: ParcelSearchRequest['bounds']): GISCoordinate {
    if (!bounds) return DEFAULT_CENTER;
    return {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2
    };
  }
}
