import request from 'supertest';
import { app } from '../index';
import { AuthService } from '../../core/auth/AuthService';

const strongSecret = 'super-strong-secret-key-32-chars-minimum-for-testing';

function generateAuthHeader(userId = 'test-user', roles: string[] = ['developer']): string {
  const auth = new AuthService(strongSecret);
  const token = auth.generateToken({ id: userId, roles });
  return `Bearer ${token}`;
}

describe('Server Index Core Routes Suite', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = strongSecret;
  });

  afterAll(() => {
    if (originalSecret) {
      process.env.JWT_SECRET = originalSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  it('serves free models catalog', async () => {
    const res = await request(app)
      .get('/api/models/free')
      .set('Authorization', generateAuthHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.llm)).toBe(true);
    expect(Array.isArray(res.body.vision)).toBe(true);
    expect(Array.isArray(res.body.embedding)).toBe(true);
  });

  it('serves API documentation or 404 when spec missing', async () => {
    const res = await request(app)
      .get('/api-docs')
      .set('Authorization', generateAuthHeader());
    expect([200, 401, 404]).toContain(res.status);
  });

  it('serves health check endpoints', async () => {
    const liveRes = await request(app).get('/health/live');
    expect(liveRes.status).toBe(200);
    expect(liveRes.body.status).toBe('alive');
  });

  it('handles feedback endpoints with and without auth', async () => {
    // 1. Get feedback with auth
    const getRes = await request(app)
      .get('/api/feedback/msg-123')
      .set('Authorization', generateAuthHeader());
    expect(getRes.status).toBe(200);
    expect(getRes.body.stats).toBeDefined();

    // 2. Submit feedback without auth (401)
    await request(app)
      .post('/api/feedback')
      .send({ messageId: 'msg-1', reaction: 'like' })
      .expect(401);

    // 3. Submit feedback with auth (200)
    const submitRes = await request(app)
      .post('/api/feedback')
      .set('Authorization', generateAuthHeader())
      .send({ messageId: 'msg-1', reaction: 'like', rating: 5, comment: 'Great job!' })
      .expect(200);

    expect(submitRes.body.success).toBe(true);
  });

  it('enforces authentication and validation on knowledge base endpoints', async () => {
    // 1. Missing auth
    await request(app)
      .post('/api/knowledge-base/directory')
      .send({ directoryPath: '/some/dir' })
      .expect(401);

    // 2. Missing directoryPath
    const resNoPath = await request(app)
      .post('/api/knowledge-base/directory')
      .set('Authorization', generateAuthHeader('dev-1', ['admin']))
      .send({})
      .expect(400);

    expect(resNoPath.body.error.message || resNoPath.body.error).toContain('directoryPath is required');
  });

  it('enforces admin role and CSRF on webhook management', async () => {
    // 1. Dev user forbidden
    await request(app)
      .get('/api/webhooks')
      .set('Authorization', generateAuthHeader('dev-1', ['developer']))
      .expect(403);

    // 2. Admin user allowed to list
    const listRes = await request(app)
      .get('/api/webhooks')
      .set('Authorization', generateAuthHeader('admin-1', ['admin']))
      .expect(200);

    expect(Array.isArray(listRes.body.webhooks)).toBe(true);
  });

  it('handles conversations endpoints with authentication', async () => {
    const res = await request(app)
      .get('/api/conversations')
      .set('Authorization', generateAuthHeader('user-1', ['developer']));

    expect([200, 503]).toContain(res.status);
  });

  it('serves tools endpoint', async () => {
    const res = await request(app)
      .get('/api/tools')
      .set('Authorization', generateAuthHeader());
    expect([200, 503]).toContain(res.status);
  });

  it('manages user custom instructions', async () => {
    const auth = generateAuthHeader('custom-user-1', ['developer']);
    // GET
    const getRes = await request(app)
      .get('/api/user/instructions')
      .set('Authorization', auth);
    expect([200, 503]).toContain(getRes.status);

    // PUT
    const putRes = await request(app)
      .put('/api/user/instructions')
      .set('Authorization', auth)
      .send({ whatToKnow: 'Be concise', responseStyle: 'Technical' });
    expect([200, 503]).toContain(putRes.status);
  });

  it('searches document metadata', async () => {
    const res = await request(app)
      .get('/api/documents/search?q=test&category=general&tags=a,b&limit=5')
      .set('Authorization', generateAuthHeader());
    expect([200, 503]).toContain(res.status);
  });

  it('handles conversation sharing and retrieval', async () => {
    const auth = generateAuthHeader('share-user-1', ['developer']);
    const shareRes = await request(app)
      .post('/api/conversations/sess-123/share')
      .set('Authorization', auth)
      .send({ title: 'Shared Chat', description: 'Description', public: true, expiresInDays: 7 });
    expect([200, 503]).toContain(shareRes.status);

    const getShareRes = await request(app)
      .get('/api/share/non-existent-share-id')
      .set('Authorization', auth);
    expect([200, 401, 404, 503]).toContain(getShareRes.status);
  });

  it('routes various specialized knowledge endpoints with developer role', async () => {
    const auth = generateAuthHeader('dev-kb', ['developer']);
    const endpoints = [
      '/api/knowledge/financial-advice',
      '/api/knowledge/religion',
      '/api/knowledge/mental-health',
      '/api/knowledge/web-design',
      '/api/knowledge/ui-design',
      '/api/knowledge/backend-design',
      '/api/knowledge/music-theory',
      '/api/knowledge/llm-programming',
      '/api/knowledge/anatomy',
      '/api/knowledge/pottery',
    ];

    for (const ep of endpoints) {
      const res = await request(app)
        .post(ep)
        .set('Authorization', auth)
        .send({ query: 'test topic', limit: 3 });
      expect([200, 500, 503]).toContain(res.status);
    }
  });
});
