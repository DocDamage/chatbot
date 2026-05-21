import {
  GISFeature,
  GISFeatureCollection,
  GISLayerArtifact,
  LayerImportRequest
} from '../../types/gis';
import { GeoJSONValidator } from './GeoJSONValidator';
import { SpatialAnalysisService } from './SpatialAnalysisService';

export class LayerImportService {
  constructor(private readonly spatial = new SpatialAnalysisService()) {}

  importLayer(request: LayerImportRequest): GISLayerArtifact {
    const features = this.normalizeFeatures(request);
    if (features.length === 0) {
      throw new Error('Layer import requires at least one feature.');
    }
    const geometryTypes = new Set(features.map(feature => feature.geometry.type));
    const bbox = this.spatial.boundsForFeatures(features);
    const schema = this.inferSchema(features);

    return {
      id: this.createLayerId(request.name),
      name: request.name.trim(),
      layerType: 'vector',
      geometryType: geometryTypes.size === 1 ? [...geometryTypes][0] : 'Mixed',
      crs: request.crs || 'EPSG:4326',
      sourceType: request.sourceUrl ? 'service' : 'upload',
      sourceUrl: request.sourceUrl,
      attribution: request.attribution,
      licenseNote: request.licenseNote,
      visible: true,
      opacity: 1,
      features,
      featureCount: features.length,
      bbox,
      schema,
      createdAt: new Date().toISOString()
    };
  }

  private normalizeFeatures(request: LayerImportRequest): GISFeature[] {
    const format = request.format || (typeof request.data === 'string' ? 'csv' : 'geojson');

    if (format === 'csv') {
      if (typeof request.data !== 'string') {
        throw new Error('CSV imports require string data.');
      }
      return this.featuresFromCsv(request.data);
    }

    const collection = Array.isArray(request.data)
      ? { type: 'FeatureCollection' as const, features: request.data }
      : request.data;

    const validation = GeoJSONValidator.validateFeatureCollection(collection);
    if (!validation.valid) {
      throw new Error(`Invalid GeoJSON: ${validation.errors.join('; ')}`);
    }

    return (collection as GISFeatureCollection).features;
  }

  private featuresFromCsv(csv: string): GISFeature[] {
    const lines = csv.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = this.splitCsvLine(lines[0]).map(header => header.trim());
    const latIndex = headers.findIndex(header => /^(lat|latitude)$/i.test(header));
    const lngIndex = headers.findIndex(header => /^(lng|lon|long|longitude)$/i.test(header));

    if (latIndex === -1 || lngIndex === -1) {
      throw new Error('CSV must include latitude/lat and longitude/lng/lon columns.');
    }

    return lines.slice(1).map((line, index) => {
      const values = this.splitCsvLine(line);
      const lat = Number(values[latIndex]);
      const lng = Number(values[lngIndex]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error(`Invalid coordinate at CSV row ${index + 2}.`);
      }

      const properties = headers.reduce<Record<string, unknown>>((record, header, headerIndex) => {
        record[header] = values[headerIndex] ?? '';
        return record;
      }, {});

      return {
        type: 'Feature' as const,
        id: `csv-row-${index + 1}`,
        geometry: {
          type: 'Point' as const,
          coordinates: [lng, lat] as [number, number],
          crs: 'EPSG:4326'
        },
        properties
      };
    });
  }

  private splitCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values.map(value => value.trim());
  }

  private inferSchema(features: GISFeature[]): Record<string, string> {
    const schema: Record<string, string> = {};

    for (const feature of features) {
      for (const [key, value] of Object.entries(feature.properties)) {
        if (!schema[key]) {
          schema[key] = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
        }
      }
    }

    return schema;
  }

  private createLayerId(name: string): string {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'layer';
    return `${slug}-${Date.now().toString(36)}`;
  }
}
