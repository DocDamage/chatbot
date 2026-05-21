import express from 'express';
import request from 'supertest';
import setupRouter from './setup';
import { AuthService } from '../../core/auth/AuthService';
import { errorHandler } from '../../middleware/errorHandler';

describe('setup routes', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalCsrfToken = process.env.CSRF_TOKEN;
  let adminToken: string;
  let developerToken: string;
  let app: express.Express;

  beforeEach(() => {
    process.env.JWT_SECRET = 'setup-route-test-secret-at-least-32-chars';
    process.env.CSRF_TOKEN = 'setup-route-csrf-token';
    const auth = new AuthService();
    adminToken = auth.generateToken({ id: 'admin-user', roles: ['admin'] });
    developerToken = auth.generateToken({ id: 'developer-user', roles: ['developer'] });

    app = express();
    app.use(express.json());
    app.use('/api/setup', setupRouter);
    app.use(errorHandler);
  });

  afterEach(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }

    if (originalCsrfToken === undefined) {
      delete process.env.CSRF_TOKEN;
    } else {
      process.env.CSRF_TOKEN = originalCsrfToken;
    }
  });

  it('requires admin authentication for setup provider metadata', async () => {
    await request(app).get('/api/setup/providers').expect(401);
    await request(app)
      .get('/api/setup/providers')
      .set('Authorization', `Bearer ${developerToken}`)
      .expect(401);

    const response = await request(app)
      .get('/api/setup/providers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.providers[0]).not.toHaveProperty('key');
  });

  it('disables plaintext API key export even for admins', async () => {
    const response = await request(app)
      .get('/api/setup/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(410);

    expect(response.body).toEqual({
      success: false,
      error: 'Plaintext API key export is disabled'
    });
  });

  it('requires CSRF for browser-originated state changes', async () => {
    await request(app)
      .post('/api/setup/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', 'session=test')
      .send({ envContent: 'OPENAI_API_KEY=sk-test' })
      .expect(401);
  });
});
