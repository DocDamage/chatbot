import { CensusGeocoder } from '../providers/CensusGeocoder';
import { OSRMRoutingProvider } from '../providers/OSRMRoutingProvider';
import { ArcGISFeatureServiceProvider } from '../providers/ArcGISFeatureServiceProvider';
import { GeoJSONValidator } from '../GeoJSONValidator';
import { SpatialAnalysisService } from '../SpatialAnalysisService';
import { LayerImportService } from '../LayerImportService';
import { GISService } from '../GISService';
import { GISFeature, GISFeatureCollection } from '../../../types/gis';

describe('B75-05: GIS Providers, Analysis, and Validation Matrix', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('CensusGeocoder', () => {
    it('geocodes addresses with full match metadata and coordinate filtering', async () => {
      const geocoder = new CensusGeocoder('https://fake-census.gov/geocoder');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            addressMatches: [
              {
                matchedAddress: '1600 Pennsylvania Ave NW, Washington, DC 20500',
                coordinates: { x: -77.0365, y: 38.8977 },
                tigerLine: { side: 'L', tigerLineId: '12345' },
                addressComponents: { zip: '20500', state: 'DC' },
              },
              {
                matchedAddress: 'Corrupt match with missing coords',
                coordinates: { x: null, y: undefined },
              },
            ],
          },
        }),
      } as any);

      const results = await geocoder.geocode({
        query: '1600 Pennsylvania Ave',
        limit: 5,
        persistExactAddress: true,
      });

      expect(results.length).toBe(1);
      expect(results[0].address).toBe('1600 Pennsylvania Ave NW, Washington, DC 20500');
      expect(results[0].coordinate).toEqual({ lat: 38.8977, lng: -77.0365 });
      expect(results[0].confidence).toBe(0.88);
      expect(results[0].metadata?.tigerLine).toBeDefined();
    });

    it('handles geocode HTTP failures', async () => {
      const geocoder = new CensusGeocoder();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
      } as any);

      await expect(geocoder.geocode({ query: 'Main St' })).rejects.toThrow(
        'Census geocoder failed with 502'
      );
    });

    it('reverse geocodes coordinates with geographies or fallback labels', async () => {
      const geocoder = new CensusGeocoder();
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              geographies: {
                'Census Tracts': [
                  { NAME: 'Census Tract 9800', BASENAME: '9800', GEOID: '11001980000' },
                ],
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: { geographies: {} },
          }),
        });

      const res1 = await geocoder.reverseGeocode({
        coordinate: { lat: 38.8977, lng: -77.0365 },
      });
      expect(res1[0].label).toBe('Census Tract 9800');
      expect(res1[0].confidence).toBe(0.7);

      const res2 = await geocoder.reverseGeocode({
        coordinate: { lat: 0, lng: 0 },
      });
      expect(res2[0].label).toBe('Census reverse geocode result');
      expect(res2[0].confidence).toBe(0.4);
    });

    it('handles reverse geocode HTTP failures', async () => {
      const geocoder = new CensusGeocoder();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      await expect(geocoder.reverseGeocode({ coordinate: { lat: 0, lng: 0 } })).rejects.toThrow(
        'Census reverse geocoder failed with 500'
      );
    });
  });

  describe('OSRMRoutingProvider', () => {
    it('generates routes across cycling, walking, and driving profiles with steps', async () => {
      const provider = new OSRMRoutingProvider('https://router.project-osrm.org');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          routes: [
            {
              distance: 1250.5,
              duration: 180.2,
              geometry: {
                type: 'LineString',
                coordinates: [
                  [-77.0365, 38.8977],
                  [-77.035, 38.898],
                ],
              },
              legs: [
                {
                  steps: [
                    {
                      name: 'Pennsylvania Ave NW',
                      distance: 500,
                      duration: 60,
                      maneuver: { instruction: 'Turn right onto 15th St NW', type: 'turn' },
                      geometry: {
                        type: 'LineString',
                        coordinates: [
                          [-77.0365, 38.8977],
                          [-77.035, 38.898],
                        ],
                      },
                    },
                    {
                      distance: 750.5,
                      duration: 120.2,
                      maneuver: { type: 'arrive' },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      } as any);

      const cyclingRoute = await provider.route({
        stops: [
          { lat: 38.8977, lng: -77.0365 },
          { lat: 38.898, lng: -77.035 },
        ],
        profile: 'cycling',
        alternatives: true,
      });

      expect(cyclingRoute.distanceMeters).toBe(1250.5);
      expect(cyclingRoute.profile).toBe('cycling');
      expect(cyclingRoute.steps.length).toBe(2);
      expect(cyclingRoute.steps[0].instruction).toBe('Turn right onto 15th St NW');
      expect(cyclingRoute.steps[1].instruction).toBe('arrive');
    });

    it('handles OSRM route HTTP errors and missing routes', async () => {
      const provider = new OSRMRoutingProvider('https://router.project-osrm.org');
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 400 })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ routes: [] }) });

      await expect(
        provider.route({
          stops: [
            { lat: 10, lng: 10 },
            { lat: 20, lng: 20 },
          ],
        })
      ).rejects.toThrow('OSRM route request failed with 400');

      await expect(
        provider.route({
          stops: [
            { lat: 10, lng: 10 },
            { lat: 20, lng: 20 },
          ],
        })
      ).rejects.toThrow('OSRM did not return a route.');
    });
  });

  describe('ArcGISFeatureServiceProvider', () => {
    it('searches parcels with bounds, parcelId, and free text queries', async () => {
      const provider = new ArcGISFeatureServiceProvider(
        'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Parcels/FeatureServer/0'
      );
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              id: 'parcel-101',
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [-77.036, 38.897],
                    [-77.035, 38.897],
                    [-77.035, 38.898],
                    [-77.036, 38.898],
                    [-77.036, 38.897],
                  ],
                ],
              },
              properties: {
                PARCELID: '001-002-003',
                SITE_ADDRESS: '123 Main St',
                ZONE: 'Commercial',
              },
            },
            {
              id: 102,
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [-77.03, 38.89],
              },
              properties: {
                PIN: 456789,
                FULLADDR: '456 Oak Ave',
              },
            },
          ],
        }),
      } as any);

      // Bounds query
      const boundsRes = await provider.search({
        bounds: { north: 39, south: 38, east: -76, west: -78 },
        limit: 10,
      });
      expect(boundsRes.length).toBe(2);
      expect(boundsRes[0].parcelId).toBe('001-002-003');
      expect(boundsRes[0].address).toBe('123 Main St');
      expect(boundsRes[1].parcelId).toBe('456789');

      // Parcel ID query
      const idRes = await provider.search({ parcelId: "A'123" });
      expect(idRes.length).toBe(2);

      // Text query
      const queryRes = await provider.search({ query: 'Main St' });
      expect(queryRes.length).toBe(2);

      // Default query
      const defaultRes = await provider.search({});
      expect(defaultRes.length).toBe(2);
    });

    it('handles ArcGIS parcel query HTTP errors', async () => {
      const provider = new ArcGISFeatureServiceProvider('https://fake-arcgis.com');
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 } as any);

      await expect(provider.search({ query: 'test' })).rejects.toThrow(
        'ArcGIS parcel query failed with 403'
      );
    });
  });

  describe('GeoJSONValidator', () => {
    it('validates valid geometries of all supported types', () => {
      const validPoint = { type: 'Point', coordinates: [-77.036, 38.897, 10] };
      const validLine = {
        type: 'LineString',
        coordinates: [
          [-77.036, 38.897],
          [-77.035, 38.898],
        ],
      };
      const validPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-77.036, 38.897],
            [-77.035, 38.897],
            [-77.035, 38.898],
            [-77.036, 38.898],
            [-77.036, 38.897],
          ],
        ],
      };
      const validMultiPoint = {
        type: 'MultiPoint',
        coordinates: [
          [-77.036, 38.897],
          [-77.035, 38.898],
        ],
      };
      const validMultiLine = {
        type: 'MultiLineString',
        coordinates: [
          [
            [-77.036, 38.897],
            [-77.035, 38.898],
          ],
          [
            [-77.034, 38.899],
            [-77.033, 38.9],
          ],
        ],
      };
      const validMultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-77.036, 38.897],
              [-77.035, 38.897],
              [-77.035, 38.898],
              [-77.036, 38.897],
            ],
          ],
          [
            [
              [-77.03, 38.89],
              [-77.029, 38.89],
              [-77.029, 38.891],
              [-77.03, 38.89],
            ],
          ],
        ],
      };

      expect(GeoJSONValidator.validateGeometry(validPoint).valid).toBe(true);
      expect(GeoJSONValidator.validateGeometry(validLine).valid).toBe(true);
      expect(GeoJSONValidator.validateGeometry(validPolygon).valid).toBe(true);
      expect(GeoJSONValidator.validateGeometry(validMultiPoint).valid).toBe(true);
      expect(GeoJSONValidator.validateGeometry(validMultiLine).valid).toBe(true);
      expect(GeoJSONValidator.validateGeometry(validMultiPolygon).valid).toBe(true);
    });

    it('validates Feature and FeatureCollection objects and catches malformed structures', () => {
      // Non-object
      expect(GeoJSONValidator.validateFeatureCollection(null).valid).toBe(false);
      expect(GeoJSONValidator.validateFeature(null).valid).toBe(false);
      expect(GeoJSONValidator.validateGeometry(null).valid).toBe(false);

      // Invalid geometry type
      expect(
        GeoJSONValidator.validateGeometry({ type: 'CircularString', coordinates: [] }).valid
      ).toBe(false);

      // Invalid Feature
      const badFeature = {
        type: 'InvalidFeature',
        geometry: { type: 'Point', coordinates: ['not-a-number', 38] },
        properties: 'not-an-object',
      };
      const featRes = GeoJSONValidator.validateFeature(badFeature);
      expect(featRes.valid).toBe(false);
      expect(featRes.errors.length).toBeGreaterThan(1);

      // Valid FeatureCollection
      const validFC: GISFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-77.036, 38.897] },
            properties: { name: 'White House' },
          },
        ],
      };
      expect(GeoJSONValidator.validateFeatureCollection(validFC).valid).toBe(true);

      // Invalid FeatureCollection missing features array
      expect(GeoJSONValidator.validateFeatureCollection({ type: 'FeatureCollection' }).valid).toBe(
        false
      );
    });
  });

  describe('SpatialAnalysisService', () => {
    const spatial = new SpatialAnalysisService();

    it('computes distance, bbox, centroid, and featureCenter across geometries', () => {
      const p1 = { lat: 38.8977, lng: -77.0365 };
      const p2 = { lat: 38.898, lng: -77.035 };
      const dist = spatial.distanceMeters(p1, p2);
      expect(dist).toBeGreaterThan(0);

      const polyFeature: GISFeature = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-77.036, 38.897],
              [-77.034, 38.897],
              [-77.034, 38.899],
              [-77.036, 38.899],
              [-77.036, 38.897],
            ],
          ],
        },
        properties: {},
      };

      const center = spatial.featureCenter(polyFeature);
      expect(center.lat).toBeCloseTo(38.898, 2);
      expect(center.lng).toBeCloseTo(-77.035, 2);

      const inside = spatial.pointInPolygon({ lat: 38.898, lng: -77.035 }, polyFeature.geometry);
      expect(inside).toBe(true);

      const bufferPoly = spatial.bufferPoint(p1, 500);
      expect(bufferPoly.geometry.type).toBe('Polygon');
      expect((bufferPoly.geometry as any).coordinates[0].length).toBeGreaterThan(10);
    });
  });

  describe('LayerImportService', () => {
    const importService = new LayerImportService();

    it('imports and parses valid GeoJSON layers', () => {
      const fc: GISFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-77.036, 38.897] },
            properties: { id: 1, title: 'POI' },
          },
        ],
      };

      const layer = importService.importLayer({
        name: 'Test POI Layer',
        format: 'geojson',
        data: fc,
      });

      expect(layer.id).toBeDefined();
      expect(layer.name).toBe('Test POI Layer');
      expect(layer.featureCount).toBe(1);
    });

    it('rejects invalid or empty content', () => {
      expect(() =>
        importService.importLayer({
          name: 'Invalid Layer',
          format: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
      ).toThrow();

      expect(() =>
        importService.importLayer({
          name: 'CSV Invalid',
          format: 'csv',
          data: 12345 as any,
        })
      ).toThrow();
    });
  });

  describe('GISService Full Workflow', () => {
    it('executes geocoding, reverse geocoding, routing, and layer queries', async () => {
      const service = new GISService();

      const geocodeResponse = await service.geocode({ query: 'Washington DC' });
      expect(geocodeResponse.results.length).toBeGreaterThan(0);

      const reverseResponse = await service.reverseGeocode({
        coordinate: { lat: 38.8977, lng: -77.0365 },
      });
      expect(reverseResponse.results.length).toBeGreaterThan(0);

      const routeResponse = await service.route({
        stops: [
          { lat: 38.8977, lng: -77.0365 },
          { lat: 38.9072, lng: -77.0369 },
        ],
        profile: 'driving',
      });
      expect(routeResponse.route.distanceMeters).toBeGreaterThan(0);

      const parcelsResponse = await service.searchParcels({ query: '1600' });
      expect(Array.isArray(parcelsResponse.results)).toBe(true);

      const layers = service.listLayers();
      expect(Array.isArray(layers.layers)).toBe(true);
    });
  });
});
