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

  it('covers searchPlaces, searchParcels, spatial analysis, sessions, and chat response', async () => {
    const service = createService();

    // 1. Places search
    const places = await service.searchPlaces({ query: 'coffee', center: 'Times Square', radiusMeters: 500, limit: 5 });
    expect(places.results).toBeDefined();

    // 2. Parcels search
    const parcels = await service.searchParcels({ query: '1600 Pennsylvania Ave', limit: 1 });
    expect(parcels.results).toBeDefined();

    // 3. Layer import & spatial analysis (buffer + nearest)
    const imported = service.importLayer({
      name: 'Points layer',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'p1',
            geometry: { type: 'Point', coordinates: [-74.006, 40.7128] },
            properties: { name: 'P1' }
          },
          {
            type: 'Feature',
            id: 'p2',
            geometry: { type: 'Point', coordinates: [-74.005, 40.7130] },
            properties: { name: 'P2' }
          }
        ]
      }
    });

    const bufferRes = await service.buffer({ coordinate: { lat: 40.7128, lng: -74.006 }, radiusMeters: 100 });
    expect(bufferRes.layer).toBeDefined();

    const nearestRes = await service.nearest({
      layerId: imported.layer.id,
      coordinate: { lat: 40.7129, lng: -74.0055 },
      limit: 1
    });
    expect(nearestRes.results.length).toBeGreaterThan(0);

    // 4. Session management
    const session = service.saveSession({
      title: 'Test Map Session',
      center: { lat: 40.7128, lng: -74.006 },
      zoom: 12,
      layers: [imported.layer]
    });
    expect(session.id).toBeDefined();

    const retrieved = service.getSession(session.id);
    expect(retrieved?.title).toBe('Test Map Session');

    const list = service.listSessions();
    expect(list.length).toBeGreaterThan(0);

    // 5. Ask router
    const routeAsk = await service.ask('Directions from Times Square to Central Park');
    expect(routeAsk.mode).toBe('route');

    const parcelAsk = await service.ask('Look up property parcel zoning for 1600 Pennsylvania Ave');
    expect(parcelAsk.mode).toBe('parcel');

    const placeAsk = await service.ask('Find coffee shops nearby');
    expect(placeAsk.mode).toBe('places');

    const geocodeAsk = await service.ask('Where is Seattle?');
    expect(geocodeAsk.mode).toBe('geocode');
  });
});
