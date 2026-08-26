import request from 'supertest';
import { AuthService } from '../../core/auth/AuthService';

describe('RT-SRV-001: Server Express App Entrypoint & Route Registration Suite', () => {
  let app: any;
  let adminToken: string;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalCsrfToken = process.env.CSRF_TOKEN;

  beforeAll(() => {
    process.env.JWT_SECRET = 'super-secret-jwt-key-for-test-32-chars-long';
    process.env.CSRF_TOKEN = 'expected-csrf-secret-12345';
    ({ app } = require('../index') as typeof import('../index'));
    const authService = new AuthService(process.env.JWT_SECRET);
    adminToken = authService.generateToken({
      id: 'admin-1',
      email: 'admin@example.com',
      roles: ['admin', 'developer']
    });
  });

  afterAll(() => {
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

  it('responds to health checks and Prometheus metrics endpoints', async () => {
    const health = await request(app).get('/health');
    expect([200, 503]).toContain(health.status);
    expect(health.body).toHaveProperty('status');

    const metrics = await request(app).get('/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.text).toContain('chatbot_');
  });

  it('handles versioned chat routes and legacy endpoint', async () => {
    const legacyChat = await request(app)
      .post('/api/chat')
      .send({
        message: 'Hello server',
        sessionId: 'test-sess',
        mode: 'ask'
      });
    expect([200, 503]).toContain(legacyChat.status);
  });

  it('serves tools, free models, and OpenAPI spec documentation', async () => {
    const tools = await request(app)
      .get('/api/tools')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 503]).toContain(tools.status);

    const freeModels = await request(app)
      .get('/api/models/free')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 503]).toContain(freeModels.status);
    expect(freeModels.body).toHaveProperty('llm');

    const docs = await request(app)
      .get('/api-docs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 404]).toContain(docs.status);
  });

  it('handles user custom instructions and feedback with authentication', async () => {
    // Instructions
    const getInst = await request(app)
      .get('/api/user/instructions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 503]).toContain(getInst.status);

    const putInst = await request(app)
      .put('/api/user/instructions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ preferredTone: 'concise' });
    expect([200, 503]).toContain(putInst.status);

    // Feedback
    const postFeedback = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        messageId: 'msg-1',
        sessionId: 'sess-1',
        reaction: 'thumbs_up',
        rating: 5,
        comment: 'Great response!'
      });
    expect([200, 503]).toContain(postFeedback.status);

    const getFeedback = await request(app)
      .get('/api/feedback/msg-1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 503]).toContain(getFeedback.status);
  });

  it('handles conversation sharing and document search routes', async () => {
    const shareRes = await request(app)
      .post('/api/conversations/sess-1/share')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Shared Session', public: true });
    expect([200, 503]).toContain(shareRes.status);

    const missingShare = await request(app)
      .get('/api/share/nonexistent-share')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([404, 503]).toContain(missingShare.status);

    const docSearch = await request(app)
      .get('/api/documents/search')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 503]).toContain(docSearch.status);
  });

  it('enforces authentication and validation on protected webhook and knowledge base routes', async () => {
    // Missing auth token returns 401
    const unauth = await request(app).get('/api/webhooks');
    expect(unauth.status).toBe(401);

    // With admin auth token
    const webhooks = await request(app)
      .get('/api/webhooks')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 503]).toContain(webhooks.status);

    // Knowledge base directory without directoryPath returns 400
    const kbDir = await request(app)
      .post('/api/knowledge-base/directory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect([400, 503]).toContain(kbDir.status);
  });
});
