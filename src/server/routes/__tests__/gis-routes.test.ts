import express from 'express';
import request from 'supertest';
import { GISProviderRegistry } from '../../../core/gis/GISProviderRegistry';
import { GISService } from '../../../core/gis/GISService';
import { GISMappingAgent } from '../../../core/agents/gis/GISMappingAgent';
import { apiErrorSchema } from '../../../middleware/apiErrorSchema';
import { errorHandler } from '../../../middleware/errorHandler';
import { createGISRouter } from '../gis';

describe('GIS routes', () => {
  const createApp = () => {
    const app = express();
    app.use(express.json());
    app.use(apiErrorSchema);
    const service = new GISService({ providerRegistry: GISProviderRegistry.development() });
    const agent = new GISMappingAgent(service);
    app.use(createGISRouter({
      gisService: service,
      gisMappingAgent: agent
    }));
    app.use(errorHandler);
    return app;
  };

  it('geocodes addresses and reverse geocodes coordinates', async () => {
    const app = createApp();

    await request(app)
      .post('/api/gis/geocode')
      .send({ query: 'White House' })
      .expect(200)
      .expect(response => {
        expect(response.body.results[0].provider).toBe('development-geocoder');
        expect(response.body.mapArtifact.markers[0].kind).toBe('address');
      });

    await request(app)
      .post('/api/gis/reverse-geocode')
      .send({ coordinate: { lat: 38.8977, lng: -77.0365 } })
      .expect(200)
      .expect(response => {
        expect(response.body.results.length).toBeGreaterThan(0);
      });
  });

  it('answers natural language spatial questions using GISMappingAgent', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/gis/ask')
      .send({ query: 'Find hospitals near downtown New Haven' })
      .expect(200);

    expect(res.body.domain).toBe('gis');
    expect(res.body.response).toBeDefined();
  });

  it('searches places and parcels', async () => {
    const app = createApp();

    const places = await request(app)
      .post('/api/gis/places/search')
      .send({ query: 'coffee', center: { lat: 41.3083, lng: -72.9279 } })
      .expect(200);
    expect(places.body.results).toBeDefined();

    const parcels = await request(app)
      .post('/api/gis/parcels/search')
      .send({ query: '123 Main St', coordinate: { lat: 41.3083, lng: -72.9279 } })
      .expect(200);
    expect(parcels.body.results).toBeDefined();
  });

  it('calculates routes and rejects unsupported route profiles', async () => {
    const app = createApp();

    await request(app)
      .post('/api/gis/route')
      .send({ stops: ['Times Square', 'Central Park'], profile: 'walking' })
      .expect(200)
      .expect(response => {
        expect(response.body.route.geometry.type).toBe('LineString');
        expect(response.body.mapArtifact.routes).toHaveLength(1);
      });

    await request(app)
      .post('/api/gis/route')
      .send({ stops: ['Times Square', 'Central Park'], profile: 'flying' })
      .expect(400)
      .expect(response => {
        expect(response.body.error.message).toContain('profile must be driving, walking, or cycling');
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
  });

  it('imports, lists, and queries layers', async () => {
    const app = createApp();
    const imported = await request(app)
      .post('/api/gis/layers/import')
      .send({
        name: 'CSV points',
        format: 'csv',
        data: 'name,lat,lng\nTest,41.2705,-72.9470\n'
      })
      .expect(200);

    expect(imported.body.layer.featureCount).toBe(1);

    await request(app).get('/api/gis/layers').expect(200).expect(response => {
      expect(response.body.layers[0].name).toBe('CSV points');
    });

    await request(app)
      .post('/api/gis/layers/query')
      .send({ layerId: imported.body.layer.id })
      .expect(200)
      .expect(response => {
        expect(response.body.features[0].properties.name).toBe('Test');
      });
  });

  it('runs buffer and nearest analysis and manages map sessions', async () => {
    const app = createApp();
    const buffer = await request(app)
      .post('/api/gis/analysis/buffer')
      .send({ coordinate: { lat: 41.2705, lng: -72.947 }, radiusMeters: 250 })
      .expect(200);

    expect(buffer.body.feature.geometry.type).toBe('Polygon');

    const nearest = await request(app)
      .post('/api/gis/analysis/nearest')
      .send({ coordinate: { lat: 41.2705, lng: -72.947 }, layerId: buffer.body.layer.id })
      .expect(200);
    expect(nearest.body.results).toBeDefined();

    const session = await request(app)
      .post('/api/gis/sessions')
      .send({ title: 'Test GIS session', layers: [buffer.body.layer], center: { lat: 41.2705, lng: -72.947 } })
      .expect(200);

    await request(app)
      .get(`/api/gis/sessions/${session.body.session.id}`)
      .expect(200)
      .expect(response => {
        expect(response.body.session.title).toBe('Test GIS session');
      });

    await request(app)
      .get('/api/gis/sessions')
      .expect(200)
      .expect(response => {
        expect(response.body.sessions.length).toBeGreaterThan(0);
      });
  });
});
