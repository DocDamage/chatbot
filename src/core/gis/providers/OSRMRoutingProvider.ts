import { GISPosition, RouteProviderRequest, RouteResult, RouteStep } from '../../../types/gis';
import { RoutingProvider } from '../GISProviderRegistry';

interface OSRMRoute {
  distance: number;
  duration: number;
  geometry?: {
    type: 'LineString';
    coordinates: GISPosition[];
  };
  legs?: Array<{
    steps?: Array<{
      name?: string;
      distance: number;
      duration: number;
      maneuver?: { instruction?: string; type?: string; modifier?: string };
      geometry?: { type: 'LineString'; coordinates: GISPosition[] };
    }>;
  }>;
}

export class OSRMRoutingProvider implements RoutingProvider {
  readonly id = 'osrm-routing';
  readonly attribution = 'OSRM routing engine and OpenStreetMap contributors';

  constructor(private readonly baseUrl: string) {}

  async route(request: RouteProviderRequest): Promise<RouteResult> {
    const profile = request.profile || 'driving';
    const osrmProfile = profile === 'cycling' ? 'bike' : profile === 'walking' ? 'foot' : 'driving';
    const coordinates = request.stops.map(stop => `${stop.lng},${stop.lat}`).join(';');
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'geojson',
      steps: 'true',
      alternatives: request.alternatives ? 'true' : 'false'
    });

    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/route/v1/${osrmProfile}/${coordinates}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`OSRM route request failed with ${response.status}`);
    }

    const payload = await response.json() as { routes?: OSRMRoute[] };
    const route = payload.routes?.[0];
    if (!route || !route.geometry) {
      throw new Error('OSRM did not return a route.');
    }

    const steps: RouteStep[] = (route.legs || []).flatMap(leg => (leg.steps || []).map(step => ({
      instruction: step.maneuver?.instruction || step.name || step.maneuver?.type || 'Continue',
      distanceMeters: step.distance,
      durationSeconds: step.duration,
      geometry: step.geometry ? { ...step.geometry, crs: 'EPSG:4326' } : undefined
    })));

    return {
      id: `osrm-route-${Date.now().toString(36)}`,
      profile,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: {
        ...route.geometry,
        crs: 'EPSG:4326'
      },
      steps,
      provider: this.id,
      source: this.baseUrl
    };
  }
}
