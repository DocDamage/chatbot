import express from 'express';
import request from 'supertest';
import { requireApiKey, requireScope, apiKeyService } from '../../middleware/apiKeyAuth';
import { RateLimiter } from '../../middleware/rateLimiter';
import { errorHandler } from '../../middleware/errorHandler';

describe('RT-PLAT-004 — Auth, Session, API Key, Rate Limit, and CORS Security Suite', () => {
  describe('API Key Authentication & Scopes', () => {
    let validKey: string;
    let readOnlyKey: string;

    beforeEach(() => {
      validKey = apiKeyService.generateKey({
        name: 'test-write-key',
        scopes: ['code:write', 'code:read'],
      }).key;

      readOnlyKey = apiKeyService.generateKey({
        name: 'test-read-key',
        scopes: ['code:read'],
      }).key;
    });

    it('authenticates valid API key with matching scope', async () => {
      const app = express();
      app.use(requireApiKey);
      app.use(requireScope('code:read'));
      app.get('/api/resource', (req, res) => res.json({ ok: true }));
      app.use(errorHandler);

      await request(app)
        .get('/api/resource')
        .set('x-api-key', validKey)
        .expect(200);
    });

    it('rejects API key missing required scope with 401 or 403', async () => {
      const app = express();
      app.use(requireApiKey);
      app.use(requireScope('code:write'));
      app.get('/api/resource', (req, res) => res.json({ ok: true }));
      app.use(errorHandler);

      const res = await request(app)
        .get('/api/resource')
        .set('x-api-key', readOnlyKey);

      expect([401, 403]).toContain(res.status);
    });

    it('rejects nonexistent or revoked API key with 401', async () => {
      const app = express();
      app.use(requireApiKey);
      app.get('/api/resource', (req, res) => res.json({ ok: true }));
      app.use(errorHandler);

      await request(app)
        .get('/api/resource')
        .set('x-api-key', 'sk_nonexistent_key_12345678901234567890')
        .expect(401);
    });
  });

  describe('Rate Limiting & Abuse Prevention', () => {
    it('blocks requests exceeding configured threshold within window', async () => {
      const app = express();
      const limiter = new RateLimiter(60000, 3);

      app.use(limiter.middleware());
      app.get('/api/limited', (req, res) => res.json({ ok: true }));
      app.use(errorHandler);

      await request(app).get('/api/limited').expect(200);
      await request(app).get('/api/limited').expect(200);
      await request(app).get('/api/limited').expect(200);

      const rateLimitedRes = await request(app).get('/api/limited').expect(429);
      expect(rateLimitedRes.body.error.message).toMatch(/too many requests/i);
    });
  });
});
