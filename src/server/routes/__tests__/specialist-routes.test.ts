import express from 'express';
import request from 'supertest';
import { createMathRouter } from '../math';
import { createMarketRouter } from '../market';
import { createGameDevRouter } from '../gamedev';

describe('specialist routes', () => {
  it('mounts math, market, and gamedev specialist endpoints', async () => {
    const app = express();
    app.use(express.json());
    app.use(createMathRouter({ mathGeniusAgent: { solve: jest.fn().mockResolvedValue({ ok: true }), verify: jest.fn().mockResolvedValue({ ok: true }) } }));
    app.use(createMarketRouter({ marketGeniusAgent: { analyze: jest.fn().mockResolvedValue({ ok: true }), backtest: jest.fn().mockResolvedValue({ ok: true }), filing: jest.fn().mockResolvedValue({ ok: true }), macro: jest.fn().mockResolvedValue({ ok: true }) } }));
    app.use(createGameDevRouter({ gameDevGeniusAgent: { answer: jest.fn().mockResolvedValue({ ok: true }), prototype: jest.fn().mockResolvedValue({ ok: true }), balance: jest.fn().mockResolvedValue({ ok: true }), review: jest.fn().mockResolvedValue({ ok: true }) } }));

    await request(app).post('/api/math/solve').send({ query: 'differentiate x^2' }).expect(200);
    await request(app).post('/api/market/analyze').send({ query: 'NVDA risk' }).expect(200);
    await request(app).post('/api/gamedev/balance').send({ query: '500 HP 20 damage every 0.5 seconds' }).expect(200);
  });
});
