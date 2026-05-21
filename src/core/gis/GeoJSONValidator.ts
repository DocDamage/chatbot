import { GISFeature, GISFeatureCollection, GISGeometry, GISPosition } from '../../types/gis';

const GEOMETRY_TYPES = new Set([
  'Point',
  'LineString',
  'Polygon',
  'MultiPoint',
  'MultiLineString',
  'MultiPolygon'
]);

export interface GeoJSONValidationResult {
  valid: boolean;
  errors: string[];
}

export class GeoJSONValidator {
  static validateFeatureCollection(value: unknown): GeoJSONValidationResult {
    const errors: string[] = [];
    const candidate = value as Partial<GISFeatureCollection>;

    if (!candidate || typeof candidate !== 'object') {
      return { valid: false, errors: ['GeoJSON payload must be an object.'] };
    }

    if (candidate.type !== 'FeatureCollection') {
      errors.push('GeoJSON root type must be FeatureCollection.');
    }

    if (!Array.isArray(candidate.features)) {
      errors.push('GeoJSON FeatureCollection requires a features array.');
    } else {
      candidate.features.forEach((feature, index) => {
        const result = this.validateFeature(feature);
        errors.push(...result.errors.map(error => `features[${index}]: ${error}`));
      });
    }

    return { valid: errors.length === 0, errors };
  }

  static validateFeature(value: unknown): GeoJSONValidationResult {
    const errors: string[] = [];
    const candidate = value as Partial<GISFeature>;

    if (!candidate || typeof candidate !== 'object') {
      return { valid: false, errors: ['Feature must be an object.'] };
    }

    if (candidate.type !== 'Feature') {
      errors.push('Feature type must be Feature.');
    }

    const geometryResult = this.validateGeometry(candidate.geometry);
    errors.push(...geometryResult.errors);

    if (!candidate.properties || typeof candidate.properties !== 'object' || Array.isArray(candidate.properties)) {
      errors.push('Feature properties must be an object.');
    }

    return { valid: errors.length === 0, errors };
  }

  static validateGeometry(value: unknown): GeoJSONValidationResult {
    const errors: string[] = [];
    const geometry = value as Partial<GISGeometry>;

    if (!geometry || typeof geometry !== 'object') {
      return { valid: false, errors: ['Geometry must be an object.'] };
    }

    if (!geometry.type || !GEOMETRY_TYPES.has(geometry.type)) {
      errors.push(`Unsupported geometry type: ${String(geometry.type)}`);
      return { valid: false, errors };
    }

    if (!this.validateCoordinates(geometry.type, geometry.coordinates)) {
      errors.push(`Invalid coordinates for ${geometry.type}.`);
    }

    return { valid: errors.length === 0, errors };
  }

  private static validateCoordinates(type: GISGeometry['type'], coordinates: unknown): boolean {
    switch (type) {
      case 'Point':
        return this.isPosition(coordinates);
      case 'LineString':
      case 'MultiPoint':
        return Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(item => this.isPosition(item));
      case 'Polygon':
      case 'MultiLineString':
        return Array.isArray(coordinates)
          && coordinates.length > 0
          && coordinates.every(ring => Array.isArray(ring) && ring.length > 0 && ring.every(item => this.isPosition(item)));
      case 'MultiPolygon':
        return Array.isArray(coordinates)
          && coordinates.length > 0
          && coordinates.every(polygon => Array.isArray(polygon)
            && polygon.length > 0
            && polygon.every(ring => Array.isArray(ring) && ring.length > 0 && ring.every(item => this.isPosition(item))));
      default:
        return false;
    }
  }

  private static isPosition(value: unknown): value is GISPosition {
    return Array.isArray(value)
      && (value.length === 2 || value.length === 3)
      && Number.isFinite(value[0])
      && Number.isFinite(value[1])
      && (value.length === 2 || Number.isFinite(value[2]));
  }
}
