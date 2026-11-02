import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { AuthService } from '../../core/auth/AuthService';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth';
import { errorHandler } from '../../middleware/errorHandler';
import { ReaService } from '../../core/rea/ReaService';
import { createReaRouter } from './rea';
import { createChatRouter } from './v1/chat';
import { createChatRouterV2 } from './v2/chat';
import { getActiveRouteManifest } from '../routeManifest';
import { createLegacyChatHandlers } from './legacy-chat';
import { ConversationManager } from '../../core/conversation/ConversationManager';
jest.mock('../../core/observability/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

describe('REA authenticated HTTP boundaries', () => {
  const originalEnv = { ...process.env };
  let root: string, service: ReaService, app: express.Express, auth: AuthService;
  beforeEach(() => {
    process.env.JWT_SECRET = 'rea-test-signing-value-with-enough-length'; process.env.DEPLOYMENT_MODE = 'local';
    auth = new AuthService();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rea-http-'));
    service = new ReaService({ enabled: true, node: process.execPath, entry: process.execPath,
      dataRoot: path.join(root, 'data'), allowedRoots: [root], timeoutMs: 1000, maxInputBytes: 1024, maxFiles: 10 },
    async (_config, _target, _operation, directory) => { fs.writeFileSync(path.join(directory, 'evidence.json'), '{}'); return []; });
    app = express(); app.use(express.json());
    app.use('/api/rea', requireAuth, requireRole('developer', 'admin'), createReaRouter({ reaService: service }));
    const chat = { processRequest: jest.fn(async () => ({ response: 'accepted' })) };
    app.post('/api/chat', optionalAuth, ...createLegacyChatHandlers({ getServices: () => ({ dailyChat: chat }), getOrchestrator: () => chat,
      waitForReady: async () => {}, getConversationManager: () => new ConversationManager() }));
    app.use('/api/v1', optionalAuth, createChatRouter(chat)); app.use('/api/v2', optionalAuth, createChatRouterV2(chat));
    app.use(errorHandler);
  });
  afterEach(() => { process.env = { ...originalEnv }; fs.rmSync(root, { recursive: true, force: true }); });
  const token = (id: string, role = 'developer') => auth.generateToken({ id, roles: [role] });

  it('requires authentication and developer privileges, and excludes hosted mounting', async () => {
    await request(app).get('/api/rea/status').expect(401);
    await request(app).get('/api/rea/status').auth(token('user', 'user'), { type: 'bearer' }).expect(403);
    await request(app).get('/api/rea/status').auth(token('alice'), { type: 'bearer' }).expect(200);
    expect(getActiveRouteManifest('hosted').some(route => route.name === 'rea')).toBe(false);
  });
  it('accepts uploads, protects saved results and evidence by owner, and deletes saved files', async () => {
    const started = await request(app).post('/api/rea/upload').auth(token('alice'), { type: 'bearer' })
      .attach('artifact', Buffer.from('module.exports = 42;'), 'app.js').expect(202);
    const id = started.body.id;
    await new Promise(resolve => setTimeout(resolve, 15));
    await request(app).get(`/api/rea/jobs/${id}`).auth(token('bob'), { type: 'bearer' }).expect(404);
    await request(app).get(`/api/rea/jobs/${id}/evidence`).auth(token('bob'), { type: 'bearer' }).expect(404);
    await request(app).get(`/api/rea/jobs/${id}/evidence`).auth(token('alice'), { type: 'bearer' }).expect(200);
    await request(app).delete(`/api/rea/jobs/${id}`).auth(token('bob'), { type: 'bearer' }).expect(404);
    await request(app).delete(`/api/rea/jobs/${id}`).auth(token('alice'), { type: 'bearer' }).expect(204);
    expect(fs.existsSync(service.jobs.directory(id))).toBe(false);
  });
  it('returns input errors for missing bodies, oversize uploads and unsupported operations', async () => {
    await request(app).post('/api/rea/jobs').auth(token('alice'), { type: 'bearer' }).send({}).expect(400);
    await request(app).post('/api/rea/upload').auth(token('alice'), { type: 'bearer' }).attach('artifact', Buffer.alloc(1025), 'large.js').expect(413);
    await request(app).post('/api/rea/upload').auth(token('alice'), { type: 'bearer' }).field('operation', 'execute').attach('artifact', Buffer.from('42'), 'app.js').expect(400);
  });
  it.each(['/api/chat', '/api/v1/chat', '/api/v2/chat', '/api/v2/chat/stream'])('guards explicit REA commands at %s', async endpoint => {
    const body = { message: '/rea analyze "app.js"', sessionId: 'rea-test', userId: 'spoofed' };
    await request(app).post(endpoint).send(body).expect(403);
    for (const message of [' \n /rea status', '<script>0</script>/rea status', 'javascript:/rea status']) {
      await request(app).post(endpoint).send({ ...body, message }).expect(403);
    }
    await request(app).post(endpoint).auth(token('user', 'user'), { type: 'bearer' }).send(body).expect(403);
    await request(app).post(endpoint).auth(token('alice'), { type: 'bearer' }).send(body).expect(200);
    process.env.DEPLOYMENT_MODE = 'hosted';
    await request(app).post(endpoint).auth(token('alice'), { type: 'bearer' }).send(body).expect(403);
  });
});
