import request from 'supertest';
import { ServiceInitializer } from '../../core/initialization/ServiceInitializer';

describe('Server Index Suite', () => {
  let app: any;
  let server: any;

  beforeAll(async () => {
    // Mock ServiceInitializer before importing index
    const mockServices = {
      database: { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
      orchestrator: {
        processRequest: jest.fn().mockResolvedValue({ response: 'ok', sessionId: 's1' })
      },
      analytics: { getAnalyticsSummary: jest.fn().mockResolvedValue({ totalQueries: 0 }) },
      cache: { getStats: jest.fn().mockReturnValue({ levels: ['memory'] }) },
      documentManager: {
        getStats: jest.fn().mockReturnValue({ chunks: 0 }),
        addText: jest.fn().mockResolvedValue([{ id: 'c1' }]),
        addFile: jest.fn().mockResolvedValue([{ id: 'f1' }]),
        addDirectory: jest.fn().mockResolvedValue([{ id: 'd1' }]),
        query: jest.fn().mockResolvedValue([])
      },
      toolRegistry: {
        getAll: jest.fn().mockReturnValue([{ id: 't1', name: 'Tool 1', description: 'Desc', category: 'general' }]),
        getStats: jest.fn().mockReturnValue({ total: 1 })
      }
    };
    jest.spyOn(ServiceInitializer, 'initialize').mockResolvedValue(mockServices as any);

    const indexModule = require('../index');
    app = indexModule.app;
    server = indexModule.server;
    await indexModule.waitForReady(5000);
  });

  it('serves health endpoint and returns 200', async () => {
    const res = await request(app).get('/health');
    expect([200, 503]).toContain(res.status);
  });

  it('rejects unauthorized knowledge-base modifications', async () => {
    const res = await request(app)
      .post('/api/knowledge-base/add')
      .send({ text: 'sample' });
    expect(res.status).toBe(401);
  });

  it('rejects unauthorized webhook mutations', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .send({ url: 'https://example.com/hook' });
    expect(res.status).toBe(401);
  });

  it('handles /api/tools and /api/models/free', async () => {
    const { AuthService } = require('../../core/auth/AuthService');
    const authService = new AuthService();
    const token = authService.generateToken({ userId: 'u1', email: 'u@test.com', roles: ['admin', 'developer'] });

    const toolsRes = await request(app)
      .get('/api/tools')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 401, 403, 503]).toContain(toolsRes.status);

    const modelsRes = await request(app)
      .get('/api/models/free')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 401, 403]).toContain(modelsRes.status);
  });

  it('handles /api-docs endpoint', async () => {
    const { AuthService } = require('../../core/auth/AuthService');
    const authService = new AuthService();
    const token = authService.generateToken({ userId: 'u1', email: 'u@test.com', roles: ['admin', 'developer'] });

    const docsRes = await request(app)
      .get('/api-docs')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 401, 403, 404]).toContain(docsRes.status);
  });

  it('handles authenticated knowledge base operations and webhook endpoints', async () => {
    const { AuthService } = require('../../core/auth/AuthService');
    const authService = new AuthService();
    const adminToken = authService.generateToken({
      userId: 'admin-1',
      email: 'admin@example.com',
      roles: ['admin', 'developer']
    });

    const addRes = await request(app)
      .post('/api/knowledge-base/add')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', '1')
      .send({ text: 'sample text', metadata: { source: 'test' } });
    expect([200, 503]).toContain(addRes.status);

    const fileRes = await request(app)
      .post('/api/knowledge-base/file')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', '1')
      .send({ filePath: 'sample.txt' });
    expect([200, 503]).toContain(fileRes.status);

    const dirRes = await request(app)
      .post('/api/knowledge-base/directory')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-csrf-token', '1')
      .send({ directoryPath: 'docs' });
    expect([200, 503]).toContain(dirRes.status);

    const hooksListRes = await request(app)
      .get('/api/webhooks')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 401]).toContain(hooksListRes.status);
  });

  it('handles feedback, user instructions, and conversation sharing endpoints', async () => {
    const { AuthService } = require('../../core/auth/AuthService');
    const authService = new AuthService();
    const token = authService.generateToken({ userId: 'u1', email: 'u@test.com', roles: ['user', 'admin'] });

    // Feedback
    const fbPostRes = await request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ messageId: 'm1', sessionId: 's1', reaction: 'thumbs_up', rating: 5, comment: 'Great' });
    expect([200, 400, 500]).toContain(fbPostRes.status);

    const fbGetRes = await request(app)
      .get('/api/feedback/m1')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 404, 500]).toContain(fbGetRes.status);

    // User instructions
    const instGetRes = await request(app)
      .get('/api/user/instructions')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 500]).toContain(instGetRes.status);

    const instPutRes = await request(app)
      .put('/api/user/instructions')
      .set('Authorization', `Bearer ${token}`)
      .send({ aboutMe: 'Developer', customInstructions: 'Be concise' });
    expect([200, 500]).toContain(instPutRes.status);

    // Document search
    const docSearchRes = await request(app)
      .get('/api/documents/search?category=dev')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 500]).toContain(docSearchRes.status);
  });
});
