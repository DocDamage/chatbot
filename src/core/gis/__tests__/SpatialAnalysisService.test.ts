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

  it('finds nearest features', () => {
    const features = [
      {
        type: 'Feature' as const,
        id: 'far',
        geometry: { type: 'Point' as const, coordinates: [-73, 41] as [number, number] },
        properties: {}
      },
      {
        type: 'Feature' as const,
        id: 'near',
        geometry: { type: 'Point' as const, coordinates: [-72.947, 41.2705] as [number, number] },
        properties: {}
      }
    ];

    const [nearest] = spatial.nearestFeature({ lat: 41.2704, lng: -72.9471 }, features);
    expect(nearest.feature.id).toBe('near');
  });
});
