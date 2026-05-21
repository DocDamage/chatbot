import express from 'express';
import request from 'supertest';
import { GISProviderRegistry } from '../../../core/gis/GISProviderRegistry';
import { GISService } from '../../../core/gis/GISService';
import { apiErrorSchema } from '../../../middleware/apiErrorSchema';
import { errorHandler } from '../../../middleware/errorHandler';
import { createGISRouter } from '../gis';

describe('GIS routes', () => {
  const createApp = () => {
    const app = express();
    app.use(express.json());
    app.use(apiErrorSchema);
    app.use(createGISRouter({
      gisService: new GISService({ providerRegistry: GISProviderRegistry.development() })
    }));
    app.use(errorHandler);
    return app;
  };

  it('geocodes addresses', async () => {
    await request(createApp())
      .post('/api/gis/geocode')
      .send({ query: 'White House' })
      .expect(200)
      .expect(response => {
        expect(response.body.results[0].provider).toBe('development-geocoder');
        expect(response.body.mapArtifact.markers[0].kind).toBe('address');
      });
  });

  it('calculates routes', async () => {
    await request(createApp())
      .post('/api/gis/route')
      .send({ stops: ['Times Square', 'Central Park'], profile: 'walking' })
      .expect(200)
      .expect(response => {
        expect(response.body.route.geometry.type).toBe('LineString');
        expect(response.body.mapArtifact.routes).toHaveLength(1);
      });
  });

  it('rejects unsupported route profiles', async () => {
    await request(createApp())
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

  it('runs buffer analysis and saves map sessions', async () => {
    const app = createApp();
    const buffer = await request(app)
      .post('/api/gis/analysis/buffer')
      .send({ coordinate: { lat: 41.2705, lng: -72.947 }, radiusMeters: 250 })
      .expect(200);

    expect(buffer.body.feature.geometry.type).toBe('Polygon');

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
  });
});
