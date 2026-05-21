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

export interface GISGeometry {
  type: string;
  coordinates: unknown;
  crs?: string;
}

export interface GISMarkerArtifact {
  id: string;
  coordinate: GISCoordinate;
  label: string;
  description?: string;
  kind?: string;
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
  layerType: string;
  geometryType?: string;
  crs: string;
  sourceType: string;
  sourceUrl?: string;
  attribution?: string;
  visible: boolean;
  opacity?: number;
  featureCount?: number;
  bbox?: GISBoundingBox;
  features?: Array<{
    type: 'Feature';
    id?: string;
    geometry: GISGeometry;
    properties: Record<string, unknown>;
  }>;
}

export interface ProviderMetadata {
  provider: string;
  kind: string;
  source?: string;
  attribution?: string;
  cached?: boolean;
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

export interface GeocodeResponse {
  results: Array<{
    id: string;
    label: string;
    coordinate: GISCoordinate;
    confidence: number;
    provider: string;
  }>;
  mapArtifact?: GISMapArtifact;
  warnings: string[];
  providerMetadata?: ProviderMetadata[];
}

export interface RouteResponse {
  route: {
    id: string;
    profile: string;
    distanceMeters: number;
    durationSeconds?: number;
    geometry: GISGeometry;
    provider: string;
  };
  mapArtifact: GISMapArtifact;
  warnings: string[];
  providerMetadata?: ProviderMetadata[];
}
