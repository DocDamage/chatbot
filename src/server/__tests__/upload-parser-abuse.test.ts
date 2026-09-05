import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../middleware/errorHandler';

describe('RT-PLAT-009 — Upload, Parser, and Decompression Abuse Suite', () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.post('/api/upload/test-json', (req, res) => {
    res.json({ receivedBytes: JSON.stringify(req.body).length });
  });
  app.use(errorHandler);

  it('rejects oversized JSON payload exceeding parser limits with 413 or 400', async () => {
    const hugeString = 'a'.repeat(2 * 1024 * 1024); // 2MB string > 1MB limit

    const res = await request(app)
      .post('/api/upload/test-json')
      .send({ data: hugeString });

    expect([413, 400]).toContain(res.status);
  });

  it('handles deeply nested JSON objects safely without call stack overflow', async () => {
    let deeplyNested: any = { value: 1 };
    for (let i = 0; i < 50; i++) {
      deeplyNested = { nested: deeplyNested };
    }

    const res = await request(app)
      .post('/api/upload/test-json')
      .send(deeplyNested);

    expect(res.status).toBe(200);
  });
});
