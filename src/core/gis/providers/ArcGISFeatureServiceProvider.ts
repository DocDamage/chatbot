import { GISFeature, ParcelResult, ParcelSearchRequest } from '../../../types/gis';
import { ParcelProvider } from '../GISProviderRegistry';
import { SpatialAnalysisService } from '../SpatialAnalysisService';

interface ArcGISGeoJsonResponse {
  features?: GISFeature[];
}

export class ArcGISFeatureServiceProvider implements ParcelProvider {
  readonly id = 'arcgis-feature-service';
  readonly attribution = 'ArcGIS REST FeatureServer source';
  private readonly spatial = new SpatialAnalysisService();

  constructor(private readonly layerUrl: string) {}

  async search(request: ParcelSearchRequest): Promise<ParcelResult[]> {
    const params = new URLSearchParams({
      f: 'geojson',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: String(request.limit || 10)
    });

    if (request.bounds) {
      params.set('geometry', `${request.bounds.west},${request.bounds.south},${request.bounds.east},${request.bounds.north}`);
      params.set('geometryType', 'esriGeometryEnvelope');
      params.set('inSR', '4326');
      params.set('spatialRel', 'esriSpatialRelIntersects');
      params.set('where', '1=1');
    } else if (request.parcelId) {
      params.set('where', `UPPER(PARCELID)='${request.parcelId.replace(/'/g, "''").toUpperCase()}'`);
    } else if (request.query) {
      const safeQuery = request.query.replace(/'/g, "''").toUpperCase();
      params.set('where', `UPPER(ADDRESS) LIKE '%${safeQuery}%' OR UPPER(PARCELID) LIKE '%${safeQuery}%'`);
    } else {
      params.set('where', '1=1');
    }

    const response = await fetch(`${this.layerUrl.replace(/\/$/, '')}/query?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`ArcGIS parcel query failed with ${response.status}`);
    }

    const payload = await response.json() as ArcGISGeoJsonResponse;
    return (payload.features || []).map((feature, index) => {
      const centroid = this.spatial.featureCenter(feature);
      const parcelId = this.readString(feature.properties, ['PARCELID', 'PARCEL_ID', 'PID', 'PIN', 'parcel_id']);
      const address = this.readString(feature.properties, ['ADDRESS', 'SITE_ADDRESS', 'SITUS', 'FULLADDR', 'address']);
      return {
        id: String(feature.id || parcelId || `arcgis-parcel-${index}`),
        label: parcelId || address || `Parcel ${index + 1}`,
        parcelId,
        address,
        geometry: feature.geometry,
        centroid,
        properties: feature.properties,
        provider: this.id,
        source: this.layerUrl
      };
    });
  }

  private readString(properties: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = properties[key];
      if (typeof value === 'string' && value.trim()) return value;
      if (typeof value === 'number') return String(value);
    }
    return undefined;
  }
}
