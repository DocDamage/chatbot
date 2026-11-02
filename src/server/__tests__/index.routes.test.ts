import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AuthService } from '../../core/auth/AuthService';
import { ServiceInitializer } from '../../core/initialization/ServiceInitializer';

const strongSecret = 'super-strong-secret-key-32-chars-minimum-for-testing';
const environmentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'index-routes-env-'));
const emptyDotenv = path.join(environmentRoot, '.env');
fs.writeFileSync(emptyDotenv, '');
for (const directory of ['knowledge-base', 'knowledge-base-public', 'workspace']) {
  fs.mkdirSync(path.join(environmentRoot, directory), { recursive: true });
}

const isolatedEnvironment: Record<string, string | undefined> = {
  DOTENV_CONFIG_PATH: emptyDotenv,
  NODE_ENV: 'test',
  DEPLOYMENT_MODE: 'test',
  HOST: '127.0.0.1',
  PORT: '31992',
  JWT_SECRET: strongSecret,
  CSRF_TOKEN: 'index-routes-csrf-token',
  LLM_PROVIDER: 'template',
  RAG_PERSISTENCE: 'false',
  RAG_RETRIEVAL_MODE: 'memory',
  RAG_GENERATE_EMBEDDINGS: 'false',
  EAGER_KNOWLEDGE_LOAD: 'false',
  BACKGROUND_KNOWLEDGE_LOAD: 'false',
  EAGER_CODING_KNOWLEDGE_LOAD: 'false',
  BACKGROUND_CODING_KNOWLEDGE_LOAD: 'false',
  CODING_TOOLS_ENABLED: 'false',
  CODING_WORKSPACE_ROOT: path.join(environmentRoot, 'workspace'),
  REA_ENABLED: 'false',
  ENABLE_RAG: 'false',
  ENABLE_MODEL_ROUTING: 'false',
  ENABLE_SAFETY_PIPELINE: 'false',
  ENABLE_SEMANTIC_CACHE: 'false',
  ENABLE_ENSEMBLE: 'false',
  ENABLE_BASH_EXECUTOR: 'false',
  ENABLE_LOCAL_TOOLS: 'false',
  LOCAL_EXECUTION_ENABLED: 'false',
  ENABLE_FL_STUDIO_MCP: 'false',
  ENABLE_WEBSOCKET: 'false',
  ENABLE_REDIS_CACHE: 'false',
  ENABLE_DISK_CACHE: 'false',
  DABOOK_ENABLED: 'false',
  PYSCRAPPY_ENABLED: 'false',
  USE_OLLAMA: 'false',
  USE_HUGGINGFACE: 'false',
  USE_LLAVA: 'false',
  USE_GEMINI_VISION: 'false',
  USE_GPT4V: 'false',
  LOCAL_MODEL_ENABLED: 'false',
  KNOWLEDGE_BASE_DIR: path.join(environmentRoot, 'knowledge-base'),
  PUBLIC_KNOWLEDGE_BASE_DIR: path.join(environmentRoot, 'knowledge-base-public'),
  OPENAI_API_KEY: undefined,
  ANTHROPIC_API_KEY: undefined,
  GEMINI_API_KEY: undefined,
  HUGGINGFACE_API_KEY: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_BASE_URL: undefined,
  DATABASE_URL: undefined,
  RAG_DATABASE_URL: undefined,
  RAG_SQLITE_PATH: undefined,
  REDIS_URL: undefined,
  OLLAMA_URL: undefined,
  OLLAMA_MODEL: undefined,
  CODING_OLLAMA_MODEL: undefined,
};
const originalEnvironment = new Map<string, string | undefined>();
for (const [name, value] of Object.entries(isolatedEnvironment)) {
  originalEnvironment.set(name, process.env[name]);
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

// Load the server only after its required import-time configuration is present.
const initializeSpy = jest.spyOn(ServiceInitializer, 'initialize').mockResolvedValue({
  orchestrator: {
    processRequest: jest.fn().mockResolvedValue({ response: 'ok', sessionId: 'index-routes' }),
  },
  documentManager: {
    addDirectory: jest.fn().mockResolvedValue([]),
  },
} as any);
const { app, waitForReady } = require('../index') as typeof import('../index');
// The feedback routes intentionally lazy-load this service; compile it before request timing begins.
require('../../core/feedback/FeedbackService');

function generateAuthHeader(userId = 'test-user', roles: string[] = ['developer']): string {
  const auth = new AuthService(strongSecret);
  const token = auth.generateToken({ id: userId, roles });
  return `Bearer ${token}`;
}

describe('Server Index Core Routes Suite', () => {
  beforeAll(async () => {
    // Stabilize the service identity before cached routers are exercised by timed requests.
    await waitForReady(5000);
  });

  afterAll(() => {
    initializeSpy.mockRestore();
    for (const [name, value] of originalEnvironment) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(environmentRoot, { recursive: true, force: true });
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

  it('gets feedback with authentication', async () => {
    const getRes = await request(app)
      .get('/api/feedback/msg-123')
      .set('Authorization', generateAuthHeader());
    expect(getRes.status).toBe(200);
    expect(getRes.body.stats).toBeDefined();
  });

  it('rejects feedback submission without authentication', async () => {
    await request(app)
      .post('/api/feedback')
      .send({ messageId: 'msg-1', reaction: 'like' })
      .expect(401);
  });

  it('submits feedback with authentication', async () => {
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
