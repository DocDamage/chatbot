import {
  AnalysisBufferRequest,
  AnalysisNearestRequest,
  GeocodeRequest,
  GeocodeResult,
  GISBoundingBox,
  GISChatResponse,
  GISCoordinate,
  GISFeature,
  GISLayerArtifact,
  GISMapArtifact,
  GISMarkerArtifact,
  GISRouteStopInput,
  GISWaypoint,
  LayerImportRequest,
  LayerQueryRequest,
  MapSessionState,
  ParcelResult,
  ParcelSearchRequest,
  PlaceResult,
  PlaceSearchRequest,
  ProviderMetadata,
  ReverseGeocodeRequest,
  ReverseGeocodeResult,
  RouteRequest,
  RouteResult,
  SavedMapSession
} from '../../types/gis';
import { GISCache } from './GISCache';
import { GISPrivacy } from './GISPrivacy';
import { GISProviderRegistry } from './GISProviderRegistry';
import { LayerImportService } from './LayerImportService';
import { MapSessionService } from './MapSessionService';
import { SpatialAnalysisService } from './SpatialAnalysisService';

export interface GeocodeResponse {
  results: GeocodeResult[];
  mapArtifact?: GISMapArtifact;
  warnings: string[];
  providerMetadata: ProviderMetadata[];
}

export interface ReverseGeocodeResponse {
  results: ReverseGeocodeResult[];
  mapArtifact?: GISMapArtifact;
  warnings: string[];
  providerMetadata: ProviderMetadata[];
}

export interface RouteResponse {
  route: RouteResult;
  mapArtifact: GISMapArtifact;
  warnings: string[];
  providerMetadata: ProviderMetadata[];
}

export interface PlacesResponse {
  results: PlaceResult[];
  mapArtifact?: GISMapArtifact;
  warnings: string[];
  providerMetadata: ProviderMetadata[];
}

export interface ParcelsResponse {
  results: ParcelResult[];
  mapArtifact?: GISMapArtifact;
  warnings: string[];
  providerMetadata: ProviderMetadata[];
}

export interface GISServiceOptions {
  providerRegistry?: GISProviderRegistry;
  cache?: GISCache;
  spatial?: SpatialAnalysisService;
  layerImport?: LayerImportService;
  sessions?: MapSessionService;
}

export class GISService {
  private readonly providerRegistry: GISProviderRegistry;
  private readonly cache: GISCache;
  private readonly spatial: SpatialAnalysisService;
  private readonly layerImport: LayerImportService;
  private readonly sessions: MapSessionService;
  private readonly layers = new Map<string, GISLayerArtifact>();

  constructor(options: GISServiceOptions = {}) {
    this.providerRegistry = options.providerRegistry || GISProviderRegistry.fromEnv();
    this.cache = options.cache || new GISCache();
    this.spatial = options.spatial || new SpatialAnalysisService();
    this.layerImport = options.layerImport || new LayerImportService(this.spatial);
    this.sessions = options.sessions || new MapSessionService();
  }

  async geocode(request: GeocodeRequest): Promise<GeocodeResponse> {
    this.requireString(request.query, 'query');
    const normalizedRequest: GeocodeRequest = {
      ...request,
      query: request.query.trim(),
      limit: this.clampLimit(request.limit, 1, 20)
    };
    const persistExactAddress = GISPrivacy.shouldPersistExactAddress(request.persistExactAddress);
    const cacheKey = GISPrivacy.requestHash({
      kind: 'geocode',
      provider: this.providerRegistry.geocoder.id,
      query: normalizedRequest.query,
      limit: normalizedRequest.limit,
      country: normalizedRequest.country,
      region: normalizedRequest.region
    });
    const cached = this.cache.get<GeocodeResult[]>(cacheKey);
    const results = cached || await this.providerRegistry.geocoder.geocode({ ...normalizedRequest, persistExactAddress });
    if (!cached) this.cache.set(cacheKey, results);

    return {
      results,
      mapArtifact: this.pointMapArtifact(results.map(result => ({
        id: result.id,
        label: result.label,
        coordinate: result.coordinate,
        kind: 'address' as const,
        properties: { confidence: result.confidence, provider: result.provider }
      })), [{
        provider: this.providerRegistry.geocoder.id,
        kind: 'geocoder',
        attribution: this.providerRegistry.geocoder.attribution,
        cached: Boolean(cached)
      }]),
      warnings: this.providerWarnings(this.providerRegistry.geocoder.id),
      providerMetadata: [{
        provider: this.providerRegistry.geocoder.id,
        kind: 'geocoder',
        attribution: this.providerRegistry.geocoder.attribution,
        cached: Boolean(cached)
      }]
    };
  }

  async reverseGeocode(request: ReverseGeocodeRequest): Promise<ReverseGeocodeResponse> {
    this.requireCoordinate(request.coordinate, 'coordinate');
    const results = await this.providerRegistry.geocoder.reverseGeocode({
      ...request,
      limit: this.clampLimit(request.limit, 1, 20)
    });
    const providerMetadata: ProviderMetadata[] = [{
      provider: this.providerRegistry.geocoder.id,
      kind: 'geocoder',
      attribution: this.providerRegistry.geocoder.attribution
    }];

    return {
      results,
      mapArtifact: this.pointMapArtifact(results.map(result => ({
        id: result.id,
        label: result.label,
        coordinate: result.coordinate,
        kind: 'address' as const,
        properties: { confidence: result.confidence, provider: result.provider }
      })), providerMetadata),
      warnings: this.providerWarnings(this.providerRegistry.geocoder.id),
      providerMetadata
    };
  }

  async route(request: RouteRequest): Promise<RouteResponse> {
    if (!Array.isArray(request.stops) || request.stops.length < 2) {
      throw new Error('stops must include at least two addresses or coordinates.');
    }
    const profile = this.normalizeRouteProfile(request.profile);

    const stops = await Promise.all(request.stops.map(stop => this.resolveStop(stop)));
    const route = await this.providerRegistry.routing.route({ ...request, profile, stops });
    const providerMetadata: ProviderMetadata[] = [{
      provider: this.providerRegistry.routing.id,
      kind: 'routing',
      attribution: this.providerRegistry.routing.attribution
    }];

    return {
      route,
      mapArtifact: {
        center: this.centerFromCoordinates(stops),
        bounds: this.geometryBoundsToBounds(route.geometry),
        zoom: 12,
        layers: [],
        markers: stops.map((stop, index) => ({
          id: `route-stop-${index + 1}`,
          label: stop.label || `Stop ${index + 1}`,
          coordinate: stop,
          kind: 'route-stop' as const,
          properties: { address: stop.address, sourceQuery: stop.sourceQuery }
        })),
        routes: [{
          id: route.id,
          label: `${route.profile} route`,
          geometry: route.geometry,
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
          provider: route.provider
        }],
        attribution: [this.providerRegistry.routing.attribution],
        providerMetadata
      },
      warnings: this.providerWarnings(this.providerRegistry.routing.id),
      providerMetadata
    };
  }

  async searchPlaces(request: PlaceSearchRequest): Promise<PlacesResponse> {
    this.requireString(request.query, 'query');
    const center = request.center ? await this.resolveStop(request.center) : undefined;
    const results = await this.providerRegistry.places.search({
      ...request,
      query: request.query.trim(),
      center,
      radiusMeters: this.optionalPositiveNumber(request.radiusMeters, 'radiusMeters'),
      limit: this.clampLimit(request.limit, 1, 50)
    });
    const providerMetadata: ProviderMetadata[] = [{
      provider: this.providerRegistry.places.id,
      kind: 'places',
      attribution: this.providerRegistry.places.attribution
    }];

    return {
      results,
      mapArtifact: this.pointMapArtifact(results.map(place => ({
        id: place.id,
        label: place.name,
        description: place.address,
        coordinate: place.coordinate,
        kind: 'place' as const,
        properties: { category: place.category, rating: place.rating, distanceMeters: place.distanceMeters }
      })), providerMetadata),
      warnings: this.providerWarnings(this.providerRegistry.places.id),
      providerMetadata
    };
  }

  async searchParcels(request: ParcelSearchRequest): Promise<ParcelsResponse> {
    const resolvedCoordinate = request.coordinate ? await this.resolveStop(request.coordinate) : undefined;
    if (!request.query && !request.coordinate && !request.parcelId && !request.bounds) {
      throw new Error('Parcel search requires query, coordinate, parcelId, or bounds.');
    }
    const results = await this.providerRegistry.parcels.search({
      ...request,
      query: request.query?.trim(),
      coordinate: resolvedCoordinate,
      limit: this.clampLimit(request.limit, 1, 50)
    });
    const providerMetadata: ProviderMetadata[] = [{
      provider: this.providerRegistry.parcels.id,
      kind: 'parcel',
      attribution: this.providerRegistry.parcels.attribution
    }];
    const parcelLayer = this.parcelLayer(results);

    return {
      results,
      mapArtifact: {
        center: results[0]?.centroid,
        bounds: parcelLayer.bbox,
        zoom: 16,
        layers: parcelLayer.featureCount ? [parcelLayer] : [],
        markers: results.map(parcel => ({
          id: parcel.id,
          label: parcel.label,
          description: parcel.address,
          coordinate: parcel.centroid,
          kind: 'parcel' as const,
          properties: { parcelId: parcel.parcelId, provider: parcel.provider }
        })),
        attribution: [this.providerRegistry.parcels.attribution],
        providerMetadata
      },
      warnings: [
        ...this.providerWarnings(this.providerRegistry.parcels.id),
        'Parcel/property output is informational only and is not legal, survey, engineering, or title advice.'
      ],
      providerMetadata
    };
  }

  importLayer(request: LayerImportRequest): { layer: GISLayerArtifact; mapArtifact: GISMapArtifact } {
    this.requireString(request.name, 'name');
    const layer = this.layerImport.importLayer(request);
    this.layers.set(layer.id, layer);
    return {
      layer,
      mapArtifact: {
        center: layer.bbox ? this.centerFromBounds(layer.bbox) : undefined,
        bounds: layer.bbox,
        zoom: 12,
        layers: [layer],
        attribution: [layer.attribution || 'Uploaded/local GIS layer'],
        providerMetadata: [{
          provider: 'layer-import',
          kind: 'layer',
          source: layer.sourceUrl,
          attribution: layer.attribution,
          licenseNote: layer.licenseNote
        }]
      }
    };
  }

  listLayers(): { layers: GISLayerArtifact[] } {
    return { layers: [...this.layers.values()] };
  }

  queryLayer(request: LayerQueryRequest): { layer: GISLayerArtifact; features: GISFeature[] } {
    const layer = this.getLayer(request.layerId);
    const limit = Math.max(1, Math.min(1000, request.limit || 100));
    let features = layer.features || [];

    if (request.bounds) {
      features = features.filter(feature => this.spatial.featureIntersectsBounds(feature, request.bounds as GISBoundingBox));
    }

    if (request.where) {
      features = features.filter(feature => Object.entries(request.where || {}).every(([key, value]) => feature.properties[key] === value));
    }

    return { layer, features: features.slice(0, limit) };
  }

  async buffer(request: AnalysisBufferRequest): Promise<{ feature: GISFeature; layer: GISLayerArtifact; mapArtifact: GISMapArtifact }> {
    const coordinate = await this.resolveStop(request.coordinate);
    const feature = this.spatial.bufferPoint(coordinate, request.radiusMeters, request.segments);
    const layer = this.importLayer({
      name: `Buffer ${request.radiusMeters}m`,
      data: [feature],
      format: 'geojson',
      attribution: 'Generated by local GIS analysis',
      licenseNote: 'Generated analysis layer'
    }).layer;

    return {
      feature,
      layer,
      mapArtifact: {
        center: coordinate,
        bounds: layer.bbox,
        zoom: 14,
        layers: [layer],
        markers: [{
          id: 'buffer-origin',
          label: 'Buffer origin',
          coordinate,
          kind: 'analysis'
        }],
        attribution: ['Generated by local GIS analysis'],
        providerMetadata: [{ provider: 'local-spatial-analysis', kind: 'analysis' }]
      }
    };
  }

  async nearest(request: AnalysisNearestRequest): Promise<{ results: Array<{ feature: GISFeature; distanceMeters: number }> }> {
    const coordinate = await this.resolveStop(request.coordinate);
    const layer = this.getLayer(request.layerId);
    return {
      results: this.spatial.nearestFeature(coordinate, layer.features || [], this.clampLimit(request.limit, 1, 100))
    };
  }

  saveSession(state: MapSessionState): SavedMapSession {
    return this.sessions.save(state);
  }

  getSession(id: string): SavedMapSession {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Map session not found: ${id}`);
    return session;
  }

  listSessions(): SavedMapSession[] {
    return this.sessions.list();
  }

  async ask(query: string): Promise<GISChatResponse> {
    const normalized = query.toLowerCase();

    if (/\b(route|directions|drive|walk|cycle)\b/.test(normalized)) {
      const routeMatch = query.match(/from\s+(.+?)\s+to\s+(.+)$/i);
      if (routeMatch) {
        const response = await this.route({ stops: [routeMatch[1], routeMatch[2]], profile: 'driving' });
        return {
          domain: 'gis',
          mode: 'route',
          response: `Route calculated: ${(response.route.distanceMeters / 1000).toFixed(2)} km.`,
          mapArtifact: response.mapArtifact,
          warnings: response.warnings,
          providerMetadata: response.providerMetadata,
          sources: response.providerMetadata.map(item => item.provider)
        };
      }
    }

    if (/\b(parcel|property|zoning|land)\b/.test(normalized)) {
      const response = await this.searchParcels({ query, limit: 5 });
      return {
        domain: 'gis',
        mode: 'parcel',
        response: `Found ${response.results.length} parcel/property result(s).`,
        mapArtifact: response.mapArtifact,
        warnings: response.warnings,
        providerMetadata: response.providerMetadata,
        sources: response.providerMetadata.map(item => item.provider)
      };
    }

    if (/\b(business|restaurant|coffee|store|nearby|near me|poi|place)\b/.test(normalized)) {
      const response = await this.searchPlaces({ query, limit: 10 });
      return {
        domain: 'gis',
        mode: 'places',
        response: `Found ${response.results.length} place result(s).`,
        mapArtifact: response.mapArtifact,
        warnings: response.warnings,
        providerMetadata: response.providerMetadata,
        sources: response.providerMetadata.map(item => item.provider)
      };
    }

    const response = await this.geocode({ query, limit: 5 });
    return {
      domain: 'gis',
      mode: 'geocode',
      response: `Found ${response.results.length} location result(s).`,
      mapArtifact: response.mapArtifact,
      warnings: response.warnings,
      providerMetadata: response.providerMetadata,
      sources: response.providerMetadata.map(item => item.provider)
    };
  }

  private async resolveStop(stop: GISRouteStopInput): Promise<GISWaypoint> {
    if (typeof stop === 'string') {
      this.requireString(stop, 'stop');
      const result = (await this.geocode({ query: stop.trim(), limit: 1 })).results[0];
      if (!result) throw new Error(`Could not geocode stop: ${GISPrivacy.redactText(stop)}`);
      return { ...result.coordinate, label: result.label, address: result.address, sourceQuery: GISPrivacy.redactText(stop) };
    }

    if ('query' in stop) {
      this.requireString(stop.query, 'stop.query');
      const result = (await this.geocode({ query: stop.query.trim(), limit: 1 })).results[0];
      if (!result) throw new Error(`Could not geocode stop: ${GISPrivacy.redactText(stop.query)}`);
      return { ...result.coordinate, label: stop.label || result.label, address: result.address, sourceQuery: GISPrivacy.redactText(stop.query) };
    }

    this.requireCoordinate(stop, 'stop');
    return {
      lat: stop.lat,
      lng: stop.lng,
      label: 'label' in stop ? stop.label : undefined,
      address: 'address' in stop ? stop.address : undefined
    };
  }

  private pointMapArtifact(markers: GISMarkerArtifact[], providerMetadata: ProviderMetadata[]): GISMapArtifact | undefined {
    if (markers.length === 0) return undefined;
    return {
      center: this.centerFromCoordinates(markers.map(marker => marker.coordinate)),
      zoom: markers.length === 1 ? 14 : 11,
      layers: [],
      markers,
      attribution: providerMetadata.flatMap(item => item.attribution ? [item.attribution] : []),
      providerMetadata
    };
  }

  private parcelLayer(results: ParcelResult[]): GISLayerArtifact {
    const features: GISFeature[] = results.map(parcel => ({
      type: 'Feature',
      id: parcel.id,
      geometry: parcel.geometry,
      properties: {
        ...parcel.properties,
        parcelId: parcel.parcelId,
        label: parcel.label,
        address: parcel.address
      }
    }));
    const bbox = this.spatial.boundsForFeatures(features);

    return {
      id: `parcel-results-${Date.now().toString(36)}`,
      name: 'Parcel results',
      layerType: 'vector',
      geometryType: 'Polygon',
      crs: 'EPSG:4326',
      sourceType: 'provider',
      attribution: this.providerRegistry.parcels.attribution,
      visible: true,
      opacity: 0.75,
      features,
      featureCount: features.length,
      bbox,
      schema: { parcelId: 'string', label: 'string', address: 'string' },
      createdAt: new Date().toISOString()
    };
  }

  private centerFromCoordinates(coordinates: GISCoordinate[]): GISCoordinate | undefined {
    if (coordinates.length === 0) return undefined;
    return {
      lat: coordinates.reduce((sum, coordinate) => sum + coordinate.lat, 0) / coordinates.length,
      lng: coordinates.reduce((sum, coordinate) => sum + coordinate.lng, 0) / coordinates.length
    };
  }

  private centerFromBounds(bounds: GISBoundingBox): GISCoordinate {
    return {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2
    };
  }

  private geometryBoundsToBounds(geometry: RouteResult['geometry']): GISBoundingBox | undefined {
    try {
      return this.spatial.geometryBounds(geometry);
    } catch {
      return undefined;
    }
  }

  private getLayer(layerId: string): GISLayerArtifact {
    const layer = this.layers.get(layerId);
    if (!layer) throw new Error(`Layer not found: ${layerId}`);
    return layer;
  }

  private requireString(value: unknown, name: string): asserts value is string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${name} is required.`);
    }
  }

  private requireCoordinate(value: unknown, name: string): asserts value is GISCoordinate {
    const coordinate = value as Partial<GISCoordinate>;
    if (!coordinate || !Number.isFinite(coordinate.lat) || !Number.isFinite(coordinate.lng)) {
      throw new Error(`${name} must include numeric lat and lng.`);
    }
    if (Number(coordinate.lat) < -90 || Number(coordinate.lat) > 90) {
      throw new Error(`${name} must include a latitude between -90 and 90.`);
    }
    if (Number(coordinate.lng) < -180 || Number(coordinate.lng) > 180) {
      throw new Error(`${name} must include a longitude between -180 and 180.`);
    }
  }

  private normalizeRouteProfile(profile: RouteRequest['profile']): NonNullable<RouteRequest['profile']> {
    if (profile === undefined || profile === null) return 'driving';
    if (profile === 'driving' || profile === 'walking' || profile === 'cycling') return profile;
    throw new Error('profile must be driving, walking, or cycling.');
  }

  private clampLimit(limit: unknown, min: number, max: number): number {
    if (limit === undefined || limit === null || limit === '') return max;
    const numeric = Number(limit);
    if (!Number.isFinite(numeric)) return max;
    return Math.max(min, Math.min(max, Math.floor(numeric)));
  }

  private optionalPositiveNumber(value: unknown, name: string): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error(`${name} must be a positive number.`);
    }
    return numeric;
  }

  private providerWarnings(providerId: string): string[] {
    return providerId.startsWith('development')
      ? [`${providerId} is a deterministic development provider. Configure real GIS providers before production use.`]
      : [];
  }
}
