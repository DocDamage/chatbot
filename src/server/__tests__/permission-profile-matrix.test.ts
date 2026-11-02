import express from 'express';
import request from 'supertest';
import { AuthService } from '../../core/auth/AuthService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { errorHandler } from '../../middleware/errorHandler';

const secret = 'permission-matrix-test-secret-at-least-32-chars';

describe('RT-PLAT-003 — Permission and Profile Matrix Test Suite', () => {
  const originalEnv = { ...process.env };
  let auth: AuthService;

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
    auth = new AuthService(secret);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const makeToken = (id: string, roles: string[]) => auth.generateToken({ id, roles });

  const app = express();
  app.use(express.json());

  // Test routes for different role requirements
  app.get('/api/admin-only', requireAuth, requireRole('admin'), (req, res) => res.json({ ok: true, scope: 'admin' }));
  app.get('/api/dev-or-admin', requireAuth, requireRole('admin', 'developer'), (req, res) => res.json({ ok: true, scope: 'dev' }));
  app.get('/api/user-or-above', requireAuth, requireRole('admin', 'developer', 'user'), (req, res) => res.json({ ok: true, scope: 'user' }));
  app.use(errorHandler);

  it('rejects unauthenticated requests with 401 across all protected routes', async () => {
    await request(app).get('/api/admin-only').expect(401);
    await request(app).get('/api/dev-or-admin').expect(401);
    await request(app).get('/api/user-or-above').expect(401);
  });

  it('enforces RBAC role boundaries: standard user cannot access dev or admin routes', async () => {
    const userToken = makeToken('user-1', ['user']);

    await request(app)
      .get('/api/user-or-above')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    await request(app)
      .get('/api/dev-or-admin')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    await request(app)
      .get('/api/admin-only')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('enforces RBAC role boundaries: developer can access dev and user routes, but not admin routes', async () => {
    const devToken = makeToken('dev-1', ['developer']);

    await request(app)
      .get('/api/user-or-above')
      .set('Authorization', `Bearer ${devToken}`)
      .expect(200);

    await request(app)
      .get('/api/dev-or-admin')
      .set('Authorization', `Bearer ${devToken}`)
      .expect(200);

    await request(app)
      .get('/api/admin-only')
      .set('Authorization', `Bearer ${devToken}`)
      .expect(403);
  });

  it('admin role grants access across all routes', async () => {
    const adminToken = makeToken('admin-1', ['admin']);

    await request(app)
      .get('/api/user-or-above')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app)
      .get('/api/dev-or-admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app)
      .get('/api/admin-only')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('rejects tokens with malformed or tampered signatures', async () => {
    const validToken = makeToken('user-1', ['user']);
    const tamperedToken = validToken.slice(0, -5) + 'abcde';

    await request(app)
      .get('/api/user-or-above')
      .set('Authorization', `Bearer ${tamperedToken}`)
      .expect(401);
  });
});
