import { GISProviderRegistry } from '../GISProviderRegistry';
import { GISService } from '../GISService';

describe('B75-08: GISService Deep Branch Coverage Suite', () => {
  const createService = () => new GISService({ providerRegistry: GISProviderRegistry.development() });

  it('handles reverse geocoding with cache hit and map artifact generation', async () => {
    const service = createService();

    const coord = { lat: 40.758, lng: -73.9855 };
    const res1 = await service.reverseGeocode({ coordinate: coord });
    expect(res1.results.length).toBeGreaterThan(0);
    expect(res1.mapArtifact).toBeDefined();

    // Cache hit path
    const res2 = await service.reverseGeocode({ coordinate: coord });
    expect(res2.results.length).toBeGreaterThan(0);
  });

  it('handles spatial analysis: buffering layers and finding nearest features', async () => {
    const service = createService();

    const layerRes = service.importLayer({
      name: 'Points of Interest',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'p1',
            geometry: { type: 'Point', coordinates: [-73.9855, 40.758] },
            properties: { name: 'Times Square' }
          },
          {
            type: 'Feature',
            id: 'p2',
            geometry: { type: 'Point', coordinates: [-73.9654, 40.7829] },
            properties: { name: 'Central Park' }
          }
        ]
      }
    });

    const bufferRes = await service.buffer({
      coordinate: { lat: 40.758, lng: -73.9855 },
      radiusMeters: 500
    });
    expect(bufferRes.layer.featureCount).toBe(1);

    const nearestRes = await service.nearest({
      coordinate: { lat: 40.759, lng: -73.985 },
      layerId: layerRes.layer.id,
      limit: 1
    });
    expect(nearestRes.results.length).toBe(1);

    const askRes = await service.ask('route from Times Square to Central Park');
    expect(askRes.domain).toBe('gis');
    expect(askRes.mode).toBe('route');

    // Ask parcel mode
    const askParcel = await service.ask('find parcel property near Downtown');
    expect(askParcel.mode).toBe('parcel');

    // Ask places mode
    const askPlaces = await service.ask('find coffee shops near me');
    expect(askPlaces.mode).toBe('places');

    // Ask geocode mode
    const askGeocode = await service.ask('Seattle WA');
    expect(askGeocode.mode).toBe('geocode');

    // Query layer
    const queried = service.queryLayer({
      layerId: layerRes.layer.id,
      where: { name: 'Times Square' }
    });
    expect(queried.features.length).toBe(1);

    // List layers
    const layersList = service.listLayers();
    expect(layersList.layers.length).toBeGreaterThan(0);

    // Sessions
    const saved = service.saveSession({
      title: 'Test Map Session',
      center: { lat: 40.758, lng: -73.9855 },
      zoom: 12,
      layers: [],
      markers: []
    });
    expect(saved.id).toBeDefined();

    const retrieved = service.getSession(saved.id);
    expect(retrieved.id).toBe(saved.id);

    const allSessions = service.listSessions();
    expect(allSessions.length).toBeGreaterThan(0);

    // Throws on missing session
    expect(() => service.getSession('nonexistent-session')).toThrow('not found');

    // Throws on empty geocode query
    await expect(service.geocode({ query: '' })).rejects.toThrow();
  });
});
