import express from 'express';
import request from 'supertest';
import { ConfigValidator } from '../../core/config/ConfigValidator';
import { AuthService } from '../../core/auth/AuthService';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth';
import { errorHandler } from '../../middleware/errorHandler';
import { RateLimiter } from '../../middleware/rateLimiter';
import { createCodeRouter } from '../routes/code';
import { createAudioRouter } from '../routes/audio';
import { createFilesRouter } from '../routes/files';
import { createKnowledgeOnlineRouter } from '../routes/knowledge-online';
import { createKnowledgeOsRouter } from '../routes/knowledge-os';
import { createPlansRouter } from '../routes/plans';
import { validateWebhookUrl } from '../security/webhookUrl';

const strongSecret = 'release-test-secret-release-test-secret';

const developerToken = () => new AuthService(strongSecret).generateToken({
  id: 'dev-user',
  roles: ['developer'],
});

const adminToken = () => new AuthService(strongSecret).generateToken({
  id: 'admin-user',
  roles: ['admin'],
});

describe('release security controls', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: strongSecret,
      NODE_ENV: 'test',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects production wildcard CORS with credentials', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = '*';

    const result = ConfigValidator.validate();

    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toMatch(/CORS_ORIGIN|Wildcard CORS/);
  });

  it('requires a JWT secret instead of falling back to an insecure default', () => {
    delete process.env.JWT_SECRET;

    expect(() => new AuthService()).toThrow(/JWT_SECRET is required/);
  });

  it('blocks anonymous workspace file access and allows developer tokens', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/files', requireAuth, requireRole('admin', 'developer'));
    app.use(createFilesRouter(process.cwd()));

    await request(app).get('/api/files/tree').expect(401);

    await request(app)
      .get('/api/files/tree')
      .set('Authorization', `Bearer ${developerToken()}`)
      .expect(200);
  });

  it('blocks anonymous command verification and allows developer verification', async () => {
    const app = express();
    const verify = jest.fn().mockResolvedValue({ ok: true });
    app.use(express.json());
    app.use('/api/code', requireAuth, requireRole('admin', 'developer'));
    app.use(createCodeRouter({
      codingAgent: {
        verify,
      },
    }));
    app.use(errorHandler);

    await request(app)
      .post('/api/code/verify')
      .send({ mode: 'implement', commands: ['npm run type-check'] })
      .expect(401);

    await request(app)
      .post('/api/code/verify')
      .set('Authorization', `Bearer ${developerToken()}`)
      .send({ mode: 'implement', commands: ['npm run type-check'] })
      .expect(200);

    expect(verify).toHaveBeenCalledWith(['npm run type-check']);
  });

  it('protects high-risk file, audio, plan, code, and online-knowledge route groups', async () => {
    const workspaceRoot = process.cwd();
    const routeGroups = [
      {
        mount: '/api/audio',
        router: createAudioRouter(workspaceRoot),
        anonymousRequest: (app: express.Express) => request(app).get('/api/audio/files'),
        authorizedRequest: (app: express.Express) => request(app).get('/api/audio/files'),
      },
      {
        mount: '/api/plans',
        router: createPlansRouter(workspaceRoot),
        anonymousRequest: (app: express.Express) => request(app).get('/api/plans'),
        authorizedRequest: (app: express.Express) => request(app).get('/api/plans'),
      },
      {
        mount: '/api/code',
        router: createCodeRouter({
          codingAgent: {
            searchFiles: jest.fn().mockResolvedValue([]),
          },
        }),
        anonymousRequest: (app: express.Express) => request(app).get('/api/code/files/search?q=index'),
        authorizedRequest: (app: express.Express) => request(app).get('/api/code/files/search?q=index'),
      },
      {
        mount: '/api/knowledge-online',
        router: createKnowledgeOnlineRouter({}),
        anonymousRequest: (app: express.Express) => request(app).post('/api/knowledge-online/miss').send({ message: 'gap' }),
        authorizedRequest: (app: express.Express) => request(app).post('/api/knowledge-online/miss').send({ message: 'gap' }),
      },
    ];

    for (const group of routeGroups) {
      const app = express();
      app.use(express.json());
      app.use(group.mount, requireAuth, requireRole('admin', 'developer'));
      app.use(group.router);
      app.use(errorHandler);

      await group.anonymousRequest(app).expect(401);
      await group.authorizedRequest(app)
        .set('Authorization', `Bearer ${developerToken()}`)
        .expect(200);
    }
  });

  it('protects settings reads and writes with admin-only policy', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/settings', requireAuth, requireRole('admin'));
    app.get('/api/settings', (_req, res) => res.json({ ok: true }));
    app.put('/api/settings', (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    await request(app).get('/api/settings').expect(401);
    await request(app).put('/api/settings').send({ provider: 'template' }).expect(401);

    await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${developerToken()}`)
      .expect(401);

    await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ provider: 'template' })
      .expect(200);
  });

  it('protects Knowledge OS routes with admin-only policy', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/knowledge-os', requireAuth, requireRole('admin'));
    app.use(createKnowledgeOsRouter({
      entityLinkingService: { stats: jest.fn().mockResolvedValue({ total: 0, byType: {} }) },
      knowledgeGraphIndexer: { stats: jest.fn().mockResolvedValue({ nodes: 0, edges: 0 }) },
      privateMemoryStore: { stats: jest.fn().mockResolvedValue({ total: 0, approved: 0, pending: 0 }) },
      governanceEvidenceService: { listReports: jest.fn().mockResolvedValue([]) },
      documentManager: { getStats: jest.fn().mockResolvedValue({ documents: 0 }) },
    }));
    app.use(errorHandler);

    await request(app).get('/api/knowledge-os/summary').expect(401);

    await request(app)
      .get('/api/knowledge-os/summary')
      .set('Authorization', `Bearer ${developerToken()}`)
      .expect(401);

    await request(app)
      .get('/api/knowledge-os/summary')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200);
  });

  it('validates webhook URLs against SSRF and production transport policy', () => {
    expect(() => validateWebhookUrl('file:///tmp/hook')).toThrow(/http or https/);
    expect(() => validateWebhookUrl('http://127.0.0.1:8080/hook')).toThrow(/private or loopback/);

    process.env.NODE_ENV = 'production';
    expect(() => validateWebhookUrl('http://example.com/hook')).toThrow(/https/);
    expect(validateWebhookUrl('https://example.com/hook')).toBe('https://example.com/hook');
  });

  it('keeps optional auth public while attaching valid users and ignoring invalid tokens', async () => {
    const app = express();
    app.use(optionalAuth);
    app.get('/public', (req, res) => {
      res.json({ userId: req.user?.userId || null });
    });

    await request(app).get('/public').expect(200, { userId: null });

    await request(app)
      .get('/public')
      .set('Authorization', 'Bearer invalid-token')
      .expect(200, { userId: null });

    await request(app)
      .get('/public')
      .set('Authorization', `Bearer ${developerToken()}`)
      .expect(200, { userId: 'dev-user' });
  });

  it('can fail closed when the rate limiter backend is unavailable', async () => {
    const app = express();
    const limiter = new RateLimiter(60000, 10, undefined, undefined, false);
    (limiter as any).useRedis = true;
    (limiter as any).redisClient = {
      incr: jest.fn().mockRejectedValue(new Error('redis unavailable')),
    };

    app.use(limiter.middleware());
    app.get('/limited', (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    await request(app)
      .get('/limited')
      .expect(503)
      .expect(response => {
        expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
      });
  });
});
