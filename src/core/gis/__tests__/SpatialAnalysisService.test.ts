import { SpatialAnalysisService } from '../SpatialAnalysisService';

const spatial = new SpatialAnalysisService();

describe('SpatialAnalysisService', () => {
  it('calculates haversine distance between coordinates', () => {
    const distance = spatial.distanceMeters({ lat: 40.758, lng: -73.9855 }, { lat: 40.7812, lng: -73.9665 });
    expect(distance).toBeGreaterThan(2500);
    expect(distance).toBeLessThan(4000);
  });

  it('creates a polygon buffer around a point', () => {
    const feature = spatial.bufferPoint({ lat: 41.2705, lng: -72.947 }, 500, 16);
    expect(feature.geometry.type).toBe('Polygon');
    expect(feature.properties.radiusMeters).toBe(500);
    if (feature.geometry.type === 'Polygon') {
      expect(feature.geometry.coordinates[0].length).toBe(17);
    }
  });

  it('evaluates pointInPolygon across inside, outside, and invalid geometry cases', () => {
    const polygonGeom: any = {
      type: 'Polygon',
      coordinates: [
        [
          [-73.0, 41.0],
          [-72.0, 41.0],
          [-72.0, 42.0],
          [-73.0, 42.0],
          [-73.0, 41.0]
        ]
      ]
    };

    expect(spatial.pointInPolygon({ lat: 41.5, lng: -72.5 }, polygonGeom)).toBe(true);
    expect(spatial.pointInPolygon({ lat: 40.0, lng: -70.0 }, polygonGeom)).toBe(false);

    // Invalid / non-polygon
    expect(spatial.pointInPolygon({ lat: 41.5, lng: -72.5 }, { type: 'Point', coordinates: [0, 0] } as any)).toBe(false);
    expect(spatial.pointInPolygon({ lat: 41.5, lng: -72.5 }, { type: 'Polygon', coordinates: [] } as any)).toBe(false);
  });

  it('filters features within distance and checks intersection with bounding boxes', () => {
    const features: any[] = [
      {
        type: 'Feature',
        id: 'f1',
        geometry: { type: 'Point', coordinates: [-72.947, 41.2705] },
        properties: {}
      },
      {
        type: 'Feature',
        id: 'f2',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-72.947, 41.2705],
            [-72.948, 41.2710]
          ]
        },
        properties: {}
      },
      {
        type: 'Feature',
        id: 'f3',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[-72.947, 41.2705], [-72.948, 41.2705], [-72.948, 41.2710], [-72.947, 41.2705]]]
          ]
        },
        properties: {}
      }
    ];

    const within = spatial.featuresWithinDistance({ lat: 41.2705, lng: -72.947 }, features, 1000);
    expect(within.length).toBeGreaterThan(0);

    const bounds = { west: -73.0, south: 41.0, east: -72.0, north: 42.0 };
    expect(spatial.featureIntersectsBounds(features[0], bounds)).toBe(true);

    const outsideBounds = { west: 0, south: 0, east: 1, north: 1 };
    expect(spatial.featureIntersectsBounds(features[0], outsideBounds)).toBe(false);

    // boundsForFeatures
    expect(spatial.boundsForFeatures(features)).toBeDefined();
    expect(spatial.boundsForFeatures([])).toBeUndefined();

    // bufferPoint validation error
    expect(() => spatial.bufferPoint({ lat: 0, lng: 0 }, -10)).toThrow('radiusMeters must be a positive number');
  });
});
