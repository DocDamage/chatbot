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

  it('runs the local-only deterministic Lattice workflow', async () => {
    const app = makeApp();
    const response = await request(app)
      .post('/api/gaming/lattice')
      .send({ width: 8, height: 8, seed: 42, enemyCount: 2 })
      .expect(200);

    expect(response.body.scenario.world.seed).toBe(42);
    expect(response.body.simulation.totalTicks).toBe(50);
    expect(response.body.asciiMap).toContain('#');

    const normalized = await request(app)
      .post('/api/gaming/lattice')
      .send({ width: 'invalid', height: 999, enemyCount: -4 })
      .expect(200);
    expect(normalized.body.scenario.world.dimensions).toEqual({ width: 8, height: 32 });
    expect(normalized.body.scenario.world.entities.filter((item: any) => item.archetype === 'enemy')).toHaveLength(0);
  });

  it('keeps Lattice simulation disabled in hosted mode', async () => {
    const original = process.env.DEPLOYMENT_MODE;
    process.env.DEPLOYMENT_MODE = 'hosted';
    try {
      await request(makeApp()).post('/api/gaming/lattice').send({ seed: 42 }).expect(403);
    } finally {
      if (original === undefined) delete process.env.DEPLOYMENT_MODE;
      else process.env.DEPLOYMENT_MODE = original;
    }
  });

  it('rejects unsupported playbook kinds', async () => {
    const app = makeApp();

    await request(app)
      .post('/api/gaming/playbook')
      .send({ kind: 'unknown', goal: 'bad kind' })
      .expect(400);
  });
});
