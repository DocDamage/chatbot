import {
  GISBoundingBox,
  GISCoordinate,
  GISFeature,
  GISGeometry,
  GISPosition
} from '../../types/gis';

const EARTH_RADIUS_METERS = 6371008.8;

export interface NearestFeatureResult {
  feature: GISFeature;
  distanceMeters: number;
}

export class SpatialAnalysisService {
  distanceMeters(a: GISCoordinate, b: GISCoordinate): number {
    const lat1 = this.toRadians(a.lat);
    const lat2 = this.toRadians(b.lat);
    const dLat = this.toRadians(b.lat - a.lat);
    const dLng = this.toRadians(b.lng - a.lng);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  bufferPoint(coordinate: GISCoordinate, radiusMeters: number, segments = 64): GISFeature {
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
      throw new Error('radiusMeters must be a positive number.');
    }

    const safeSegments = Math.max(12, Math.min(256, Math.floor(segments)));
    const coordinates: GISPosition[] = [];

    for (let index = 0; index <= safeSegments; index += 1) {
      const bearing = (2 * Math.PI * index) / safeSegments;
      coordinates.push(this.destinationPoint(coordinate, radiusMeters, bearing));
    }

    return {
      type: 'Feature',
      id: `buffer-${Date.now()}`,
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates],
        crs: 'EPSG:4326'
      },
      properties: {
        analysis: 'buffer',
        radiusMeters
      },
      bbox: this.boundsToArray(this.boundsForPositions(coordinates))
    };
  }

  pointInPolygon(point: GISCoordinate, polygon: GISGeometry): boolean {
    if (polygon.type !== 'Polygon') return false;
    const ring = polygon.coordinates[0];
    if (!ring || ring.length < 4) return false;

    let inside = false;
    const x = point.lng;
    const y = point.lat;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const intersects = ((yi > y) !== (yj > y))
        && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }

    return inside;
  }

  nearestFeature(coordinate: GISCoordinate, features: GISFeature[], limit = 1): NearestFeatureResult[] {
    return features
      .map(feature => ({
        feature,
        distanceMeters: this.distanceMeters(coordinate, this.featureCenter(feature))
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, Math.max(1, limit));
  }

  featuresWithinDistance(coordinate: GISCoordinate, features: GISFeature[], radiusMeters: number): NearestFeatureResult[] {
    return this.nearestFeature(coordinate, features, features.length)
      .filter(result => result.distanceMeters <= radiusMeters);
  }

  featureIntersectsBounds(feature: GISFeature, bounds: GISBoundingBox): boolean {
    const featureBounds = this.geometryBounds(feature.geometry);
    return !(featureBounds.east < bounds.west
      || featureBounds.west > bounds.east
      || featureBounds.north < bounds.south
      || featureBounds.south > bounds.north);
  }

  featureCenter(feature: GISFeature): GISCoordinate {
    const bounds = this.geometryBounds(feature.geometry);
    return {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2
    };
  }

  geometryBounds(geometry: GISGeometry): GISBoundingBox {
    return this.boundsForPositions(this.flattenPositions(geometry));
  }

  boundsForFeatures(features: GISFeature[]): GISBoundingBox | undefined {
    const positions = features.flatMap(feature => this.flattenPositions(feature.geometry));
    return positions.length > 0 ? this.boundsForPositions(positions) : undefined;
  }

  boundsToArray(bounds: GISBoundingBox): [number, number, number, number] {
    return [bounds.west, bounds.south, bounds.east, bounds.north];
  }

  private flattenPositions(geometry: GISGeometry): GISPosition[] {
    switch (geometry.type) {
      case 'Point':
        return [geometry.coordinates];
      case 'LineString':
      case 'MultiPoint':
        return geometry.coordinates;
      case 'Polygon':
      case 'MultiLineString':
        return geometry.coordinates.flat();
      case 'MultiPolygon':
        return geometry.coordinates.flat(2);
      default:
        return [];
    }
  }

  private boundsForPositions(positions: GISPosition[]): GISBoundingBox {
    if (positions.length === 0) {
      throw new Error('Cannot calculate bounds for empty coordinates.');
    }

    return positions.reduce<GISBoundingBox>((bounds, position) => ({
      west: Math.min(bounds.west, position[0]),
      south: Math.min(bounds.south, position[1]),
      east: Math.max(bounds.east, position[0]),
      north: Math.max(bounds.north, position[1])
    }), {
      west: positions[0][0],
      south: positions[0][1],
      east: positions[0][0],
      north: positions[0][1]
    });
  }

  private destinationPoint(origin: GISCoordinate, distanceMeters: number, bearingRadians: number): GISPosition {
    const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
    const lat1 = this.toRadians(origin.lat);
    const lng1 = this.toRadians(origin.lng);
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance)
      + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRadians)
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    return [this.toDegrees(lng2), this.toDegrees(lat2)];
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  private toDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
  }
}
