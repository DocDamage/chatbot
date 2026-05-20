import express from 'express';
import request from 'supertest';
import { createChronoRouter } from '../chrono';
import { createPopCultureRouter } from '../pop-culture';
import { createHistoryRouter } from '../history';
import { createScienceRouter } from '../science';

describe('chrono specialist routes', () => {
  it('mounts chrono, pop culture, history, and science endpoints', async () => {
    const app = express();
    app.use(express.json());
    const services = {
      chronoKnowledgeEngine: { ask: jest.fn().mockResolvedValue({ ok: true }) },
      popCultureGeniusAgent: {
        ask: jest.fn().mockResolvedValue({ ok: true }),
        timeline: jest.fn().mockResolvedValue({ ok: true }),
        franchise: jest.fn().mockResolvedValue({ ok: true }),
        compare: jest.fn().mockResolvedValue({ ok: true })
      },
      historyGeniusAgent: {
        ask: jest.fn().mockResolvedValue({ ok: true }),
        timeline: jest.fn().mockResolvedValue({ ok: true }),
        compare: jest.fn().mockResolvedValue({ ok: true }),
        primarySources: jest.fn().mockResolvedValue({ ok: true })
      },
      scienceInventionGeniusAgent: {
        ask: jest.fn().mockResolvedValue({ ok: true }),
        invention: jest.fn().mockResolvedValue({ ok: true }),
        timeline: jest.fn().mockResolvedValue({ ok: true }),
        papers: jest.fn().mockResolvedValue({ ok: true }),
        patents: jest.fn().mockResolvedValue({ ok: true })
      }
    };
    app.use(createChronoRouter(services));
    app.use(createPopCultureRouter(services));
    app.use(createHistoryRouter(services));
    app.use(createScienceRouter(services));

    await request(app).post('/api/chrono/ask').send({ query: 'wheel', domain: 'science' }).expect(200);
    await request(app).post('/api/pop-culture/timeline').send({ query: 'hip-hop 1973 to 1999' }).expect(200);
    await request(app).post('/api/history/primary-sources').send({ query: 'Roman Republic' }).expect(200);
    await request(app).post('/api/science/patents').send({ query: 'transistor' }).expect(200);
  });
});
