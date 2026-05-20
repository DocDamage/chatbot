import express from 'express';
import request from 'supertest';
import { createMusicProductionGeniusRouter } from '../music';
import { createStoryGeniusRouter } from '../story';
import { createLegalCivicGeniusRouter } from '../legal';
import { createHealthGeniusRouter } from '../health';
import { createSecurityGeniusRouter } from '../security';
import { createBusinessGeniusRouter } from '../business';
import { createPhilosophyGeniusRouter } from '../philosophy';
import { createLanguageGeniusRouter } from '../language';
import { createGeoCultureGeniusRouter } from '../geography';
import { createEngineeringGeniusRouter } from '../engineering';

describe('new specialist genius routes', () => {
  it('mounts the next-wave specialist ask endpoints', async () => {
    const app = express();
    app.use(express.json());
    const services = {};

    app.use(createMusicProductionGeniusRouter(services));
    app.use(createStoryGeniusRouter(services));
    app.use(createLegalCivicGeniusRouter(services));
    app.use(createHealthGeniusRouter(services));
    app.use(createSecurityGeniusRouter(services));
    app.use(createBusinessGeniusRouter(services));
    app.use(createPhilosophyGeniusRouter(services));
    app.use(createLanguageGeniusRouter(services));
    app.use(createGeoCultureGeniusRouter(services));
    app.use(createEngineeringGeniusRouter(services));

    const endpoints = [
      '/api/music/ask',
      '/api/music/suno',
      '/api/music/fl-studio',
      '/api/music/pro-tools',
      '/api/music/logic',
      '/api/music/master',
      '/api/music/arrangement',
      '/api/music/daw-translate',
      '/api/story/ask',
      '/api/legal/ask',
      '/api/health/ask',
      '/api/security/ask',
      '/api/business/ask',
      '/api/philosophy/ask',
      '/api/language/ask',
      '/api/geography/ask',
      '/api/engineering/ask'
    ];

    for (const endpoint of endpoints) {
      const response = await request(app)
        .post(endpoint)
        .send({ query: 'test request' })
        .expect(200);

      expect(response.body.response).toBeTruthy();
      expect(response.body.guardrails.length).toBeGreaterThan(0);
    }
  });
});
