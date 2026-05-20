import express from 'express';
import request from 'supertest';
import { createSixSigmaRouter } from '../sixsigma';

describe('sixsigma routes', () => {
  it('mounts Blackbelt specialist endpoints', async () => {
    const app = express();
    app.use(express.json());
    app.use(createSixSigmaRouter({
      sixSigmaBlackBeltAgent: {
        ask: jest.fn().mockResolvedValue({ ok: true }),
        calculate: jest.fn().mockResolvedValue({ ok: true }),
        project: jest.fn().mockResolvedValue({ ok: true }),
        certification: jest.fn().mockResolvedValue({ ok: true }),
        simulate: jest.fn().mockResolvedValue({ ok: true }),
        export: jest.fn().mockResolvedValue({ ok: true }),
        studyPlan: jest.fn().mockResolvedValue({ ok: true })
      }
    }));

    await request(app).post('/api/sixsigma/ask').send({ query: 'What is DMAIC?' }).expect(200);
    await request(app).post('/api/sixsigma/calculate').send({ query: 'calculate cpk' }).expect(200);
    await request(app).post('/api/sixsigma/project').send({ query: 'late deliveries' }).expect(200);
    await request(app).post('/api/sixsigma/study-plan').send({ query: 'CSSBB prep' }).expect(200);
  });
});
