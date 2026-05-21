export interface GISCoordinate {
  lat: number;
  lng: number;
}

export interface GISBoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type GISPosition = [number, number] | [number, number, number];

export type GISGeometry =
  | { type: 'Point'; coordinates: GISPosition; crs?: string }
  | { type: 'LineString'; coordinates: GISPosition[]; crs?: string }
  | { type: 'Polygon'; coordinates: GISPosition[][]; crs?: string }
  | { type: 'MultiPoint'; coordinates: GISPosition[]; crs?: string }
  | { type: 'MultiLineString'; coordinates: GISPosition[][]; crs?: string }
  | { type: 'MultiPolygon'; coordinates: GISPosition[][][]; crs?: string };

export interface GISFeature<Properties extends Record<string, unknown> = Record<string, unknown>> {
  type: 'Feature';
  id?: string;
  geometry: GISGeometry;
  properties: Properties;
  bbox?: [number, number, number, number];
}

export interface GISFeatureCollection {
  type: 'FeatureCollection';
  features: GISFeature[];
  bbox?: [number, number, number, number];
}

export type GISRouteStopInput =
  | string
  | GISCoordinate
  | (GISCoordinate & { label?: string; address?: string })
  | { query: string; label?: string };

export interface GISWaypoint extends GISCoordinate {
  label?: string;
  address?: string;
  sourceQuery?: string;
}

export interface ProviderMetadata {
  provider: string;
  kind: 'geocoder' | 'routing' | 'places' | 'parcel' | 'layer' | 'analysis' | 'session';
  source?: string;
  attribution?: string;
  licenseNote?: string;
  fetchedAt?: string;
  cached?: boolean;
}

export interface GeocodeRequest {
  query: string;
  limit?: number;
  country?: string;
  region?: string;
  persistExactAddress?: boolean;
}

export interface GeocodeResult {
  id: string;
  label: string;
  address?: string;
  coordinate: GISCoordinate;
  confidence: number;
  provider: string;
  source?: string;
  bbox?: GISBoundingBox;
  metadata?: Record<string, unknown>;
}

export interface ReverseGeocodeRequest {
  coordinate: GISCoordinate;
  limit?: number;
}

export interface ReverseGeocodeResult {
  id: string;
  label: string;
  coordinate: GISCoordinate;
  confidence: number;
  provider: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface RouteRequest {
  stops: GISRouteStopInput[];
  profile?: 'driving' | 'walking' | 'cycling';
  avoidHighways?: boolean;
  alternatives?: boolean;
}

export interface RouteProviderRequest extends Omit<RouteRequest, 'stops'> {
  stops: GISWaypoint[];
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds?: number;
  geometry?: GISGeometry;
}

export interface RouteResult {
  id: string;
  profile: 'driving' | 'walking' | 'cycling';
  distanceMeters: number;
  durationSeconds?: number;
  geometry: GISGeometry;
  steps: RouteStep[];
  provider: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface PlaceSearchRequest {
  query: string;
  center?: GISRouteStopInput;
  radiusMeters?: number;
  limit?: number;
  category?: string;
  openNow?: boolean;
}

export interface PlaceResult {
  id: string;
  name: string;
  coordinate: GISCoordinate;
  address?: string;
  category?: string;
  rating?: number;
  phone?: string;
  website?: string;
  distanceMeters?: number;
  provider: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface ParcelSearchRequest {
  query?: string;
  coordinate?: GISRouteStopInput;
  parcelId?: string;
  bounds?: GISBoundingBox;
  limit?: number;
}

export interface ParcelResult {
  id: string;
  label: string;
  parcelId?: string;
  address?: string;
  geometry: GISGeometry;
  centroid: GISCoordinate;
  properties: Record<string, unknown>;
  provider: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface GISMarkerArtifact {
  id: string;
  coordinate: GISCoordinate;
  label: string;
  description?: string;
  kind?: 'address' | 'place' | 'parcel' | 'route-stop' | 'analysis' | 'custom';
  properties?: Record<string, unknown>;
}

export interface GISRouteArtifact {
  id: string;
  label: string;
  geometry: GISGeometry;
  distanceMeters?: number;
  durationSeconds?: number;
  provider?: string;
}

export interface GISLayerArtifact {
  id: string;
  name: string;
  layerType: 'vector' | 'raster' | 'service' | 'table' | 'analysis';
  geometryType?: GISGeometry['type'] | 'Mixed';
  crs: string;
  sourceType: 'upload' | 'generated' | 'provider' | 'service' | 'memory';
  sourceUrl?: string;
  attribution?: string;
  licenseNote?: string;
  visible: boolean;
  opacity?: number;
  style?: GISLayerStyle;
  features?: GISFeature[];
  featureCount?: number;
  bbox?: GISBoundingBox;
  schema?: Record<string, string>;
  createdAt: string;
}

export interface GISLayerStyle {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  pointRadius?: number;
  labelField?: string;
  colorByField?: string;
}

export interface GISMapArtifact {
  center?: GISCoordinate;
  zoom?: number;
  bounds?: GISBoundingBox;
  layers: GISLayerArtifact[];
  markers?: GISMarkerArtifact[];
  routes?: GISRouteArtifact[];
  attribution: string[];
  providerMetadata: ProviderMetadata[];
}

export interface GISChatResponse {
  domain: 'gis';
  mode: string;
  response: string;
  mapArtifact?: GISMapArtifact;
  warnings?: string[];
  sources?: string[];
  providerMetadata?: ProviderMetadata[];
}

export interface LayerImportRequest {
  name: string;
  data: GISFeatureCollection | GISFeature[] | string;
  format?: 'geojson' | 'csv';
  crs?: string;
  sourceUrl?: string;
  attribution?: string;
  licenseNote?: string;
}

export interface LayerQueryRequest {
  layerId: string;
  bounds?: GISBoundingBox;
  limit?: number;
  where?: Record<string, string | number | boolean>;
}

export interface AnalysisBufferRequest {
  coordinate: GISRouteStopInput;
  radiusMeters: number;
  segments?: number;
}

export interface AnalysisNearestRequest {
  coordinate: GISRouteStopInput;
  layerId: string;
  limit?: number;
}

export interface MapSessionState {
  title: string;
  center?: GISCoordinate;
  zoom?: number;
  layers: GISLayerArtifact[];
  markers?: GISMarkerArtifact[];
  routes?: GISRouteArtifact[];
  notes?: string;
}

export interface SavedMapSession {
  id: string;
  title: string;
  state: MapSessionState;
  createdAt: string;
  updatedAt: string;
}
