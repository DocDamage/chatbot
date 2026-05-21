import express from 'express';
import request from 'supertest';
import { createGamingRouter } from '../gaming';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(createGamingRouter({
    gamingGeniusAgent: {
      ask: jest.fn().mockResolvedValue({ mode: 'gaming', response: 'ok' })
    }
  }));
  return app;
}

describe('gaming playbook routes', () => {
  it('lists available playbooks', async () => {
    const app = makeApp();

    await request(app)
      .get('/api/gaming/playbooks')
      .expect(200)
      .expect(response => {
        expect(response.body.playbooks.map((item: any) => item.kind)).toEqual(expect.arrayContaining([
          'engine_selection',
          'asset_pipeline',
          'design_review',
          'modding_safety',
          'prompt_pack'
        ]));
      });
  });

  it('creates a general playbook by kind', async () => {
    const app = makeApp();

    await request(app)
      .post('/api/gaming/playbook')
      .send({ kind: 'design_review', goal: 'review my combat loop', genre: 'action RPG' })
      .expect(200)
      .expect(response => {
        expect(response.body.kind).toBe('design_review');
        expect(response.body.checklist.length).toBeGreaterThan(0);
      });
  });

  it('creates engine, asset, and prompt playbooks through shortcuts', async () => {
    const app = makeApp();

    await request(app).post('/api/gaming/engine').send({ goal: 'pick an engine', genre: 'JRPG' }).expect(200).expect(response => {
      expect(response.body.kind).toBe('engine_selection');
    });
    await request(app).post('/api/gaming/assets').send({ goal: 'organize sprite sheets' }).expect(200).expect(response => {
      expect(response.body.kind).toBe('asset_pipeline');
    });
    await request(app).post('/api/gaming/prompts').send({ goal: 'write agent prompts' }).expect(200).expect(response => {
      expect(response.body.kind).toBe('prompt_pack');
    });
  });

  it('rejects unsupported playbook kinds', async () => {
    const app = makeApp();

    await request(app)
      .post('/api/gaming/playbook')
      .send({ kind: 'unknown', goal: 'bad kind' })
      .expect(400);
  });
});
