import { GISProviderRegistry } from '../GISProviderRegistry';
import { GISService } from '../GISService';

describe('GISService', () => {
  const createService = () => new GISService({ providerRegistry: GISProviderRegistry.development() });

  it('geocodes a known seed location and returns a map artifact', async () => {
    const result = await createService().geocode({ query: '  1600 Pennsylvania Ave NW  ', limit: 1 });
    expect(result.results[0].coordinate.lat).toBeCloseTo(38.8977, 3);
    expect(result.results[0].label).toBe('1600 Pennsylvania Ave NW');
    expect(result.mapArtifact?.markers?.[0].kind).toBe('address');
    expect(result.warnings[0]).toContain('development');
  });

  it('routes between addresses after resolving stops', async () => {
    const result = await createService().route({ stops: ['Times Square', 'Central Park'], profile: 'walking' });
    expect(result.route.distanceMeters).toBeGreaterThan(2000);
    expect(result.mapArtifact.routes?.[0].geometry.type).toBe('LineString');
    expect(result.mapArtifact.markers).toHaveLength(2);
  });

  it('imports and queries GeoJSON layers', () => {
    const service = createService();
    const imported = service.importLayer({
      name: 'Test points',
      data: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          id: 'a',
          geometry: { type: 'Point', coordinates: [-72.947, 41.2705] },
          properties: { name: 'A' }
        }]
      }
    });

    expect(imported.layer.featureCount).toBe(1);
    expect(service.queryLayer({ layerId: imported.layer.id }).features[0].properties.name).toBe('A');
  });

  it('rejects out-of-range coordinates before provider calls', async () => {
    await expect(createService().reverseGeocode({ coordinate: { lat: 95, lng: 10 } }))
      .rejects
      .toThrow('coordinate must include a latitude between -90 and 90');
  });

  it('rejects empty layer imports with a useful error', () => {
    expect(() => createService().importLayer({
      name: 'Empty layer',
      format: 'csv',
      data: 'name,lat,lng\n'
    })).toThrow('Layer import requires at least one feature.');
  });
});
