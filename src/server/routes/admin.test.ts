import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { AuthService } from '../../core/auth/AuthService';
import { apiErrorSchema } from '../../middleware/apiErrorSchema';
import { errorHandler } from '../../middleware/errorHandler';
import { createAdminRouter } from './admin';

const strongSecret = 'admin-route-test-secret-admin-route-test-secret';

function adminToken(): string {
  return new AuthService(strongSecret).generateToken({
    id: 'admin-user',
    roles: ['admin'],
  });
}

function developerToken(): string {
  return new AuthService(strongSecret).generateToken({
    id: 'dev-user',
    roles: ['developer'],
  });
}

function createApp(services: any): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter(services));
  app.use(apiErrorSchema);
  app.use(errorHandler);
  return app;
}

describe('admin routes', () => {
  const originalEnv = { ...process.env };
  let tempDir: string | undefined;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: strongSecret,
      NODE_ENV: 'test',
    };
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-admin-logs-'));
  });

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
    process.env = originalEnv;
  });

  it('requires an admin token for cache clearing', async () => {
    const app = createApp({ cache: { clear: jest.fn() } });

    await request(app).post('/api/admin/cache/clear').expect(401);

    await request(app)
      .post('/api/admin/cache/clear')
      .set('Authorization', `Bearer ${developerToken()}`)
      .expect(403);
  });

  it('clears every available cache service with a clear capability', async () => {
    const clear = jest.fn();
    const flushAll = jest.fn();
    const app = createApp({
      cache: { clear },
      semanticCache: { flushAll },
    });

    await request(app)
      .post('/api/admin/cache/clear')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200)
      .expect(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.results).toEqual([
          { name: 'cache', cleared: true, method: 'clear' },
          { name: 'semanticCache', cleared: true, method: 'flushAll' },
        ]);
      });

    expect(clear).toHaveBeenCalledTimes(1);
    expect(flushAll).toHaveBeenCalledTimes(1);
  });

  it('handles cache clear failures and unavailable cache services', async () => {
    // 1. 503 when no cache service configured
    const appEmpty = createApp({});
    await request(appEmpty)
      .post('/api/admin/cache/clear')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(503);

    // 2. 500 when clear rejects
    const appFailed = createApp({
      cache: {
        clear: jest.fn().mockRejectedValue(new Error('Redis connection failed'))
      }
    });
    await request(appFailed)
      .post('/api/admin/cache/clear')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(500)
      .expect(response => {
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('No caches were cleared');
      });
  });

  it('serves comprehensive stats including attached subsystem metrics', async () => {
    const app = createApp({
      orchestrator: true,
      cache: { getStats: () => ({ hits: 10, misses: 2 }) },
      documentManager: { getStats: async () => ({ documentsCount: 42 }) },
      analytics: { getUsageStats: () => ({ activeUsers: 5 }) }
    });

    await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200)
      .expect(response => {
        expect(response.body.system).toBeDefined();
        expect(response.body.services.cache).toBe(true);
        expect(response.body.cache).toEqual({ hits: 10, misses: 2 });
        expect(response.body.knowledgeBase).toEqual({ documentsCount: 42 });
        expect(response.body.analytics).toEqual({ activeUsers: 5 });
      });
  });

  it('serves paginated user list', async () => {
    const app = createApp({});

    await request(app)
      .get('/api/admin/users?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200)
      .expect(response => {
        expect(Array.isArray(response.body.users)).toBe(true);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(10);
      });
  });

  it('serves analytics insights and handles unavailable analytics service', async () => {
    // 1. 503 when no analytics service
    const appEmpty = createApp({});
    await request(appEmpty)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(503);

    // 2. 200 when analytics service exists
    const appWithAnalytics = createApp({
      analytics: {
        getUsageStats: () => ({ totalQueries: 100 }),
        getQueryPatterns: () => ({ topQuery: 'fl studio' })
      }
    });
    await request(appWithAnalytics)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200)
      .expect(response => {
        expect(response.body.usage.totalQueries).toBe(100);
        expect(response.body.patterns.topQuery).toBe('fl studio');
      });
  });

  it('returns bounded, filtered, and redacted log entries for JSON and raw text logs', async () => {
    if (!tempDir) throw new Error('tempDir missing');
    fs.writeFileSync(
      path.join(tempDir, 'combined.log'),
      [
        JSON.stringify({
          timestamp: '2026-05-20T10:00:00.000Z',
          level: 'info',
          message: 'normal line',
        }),
        '2026-05-20 10:00:30 [WARN] Memory approaching threshold password="plain_password"',
        JSON.stringify({
          timestamp: '2026-05-20T10:01:00.000Z',
          level: 'error',
          message: 'failed with token=super-secret',
          authorization: 'Bearer abc.def.ghi',
        }),
        'Unformatted plain log line without brackets',
        '',
      ].join('\n'),
      'utf8'
    );

    const app = createApp({ logsDir: tempDir, cache: { clear: jest.fn() } });

    // Filter by level
    await request(app)
      .get('/api/admin/logs?level=error&limit=50')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200)
      .expect(response => {
        expect(response.body.file).toBe('combined.log');
        expect(response.body.limit).toBe(50);
        expect(response.body.logs).toHaveLength(1);
        expect(response.body.logs[0].level).toBe('error');
        expect(response.body.logs[0].message).toBe('failed with token=[REDACTED]');
        expect(response.body.logs[0].raw).not.toContain('super-secret');
        expect(response.body.logs[0].raw).not.toContain('abc.def.ghi');
      });

    // Check raw text parsing and password redaction
    await request(app)
      .get('/api/admin/logs?level=warn')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200)
      .expect(response => {
        expect(response.body.logs).toHaveLength(1);
        expect(response.body.logs[0].level).toBe('warn');
        expect(response.body.logs[0].raw).toContain('password=[REDACTED]');
      });
  });

  it('rejects invalid log level and invalid log file patterns', async () => {
    const app = createApp({ logsDir: tempDir, cache: { clear: jest.fn() } });

    await request(app)
      .get('/api/admin/logs?level=super_critical')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(400)
      .expect(response => {
        expect(response.body.error).toContain('Invalid log level requested');
      });

    await request(app)
      .get('/api/admin/logs?file=../combined.log')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(400)
      .expect(response => {
        expect(response.body.error.code).toBe('INVALID_LOG_FILE');
      });
  });

  it('returns an empty log list when the selected log file does not exist', async () => {
    const app = createApp({ logsDir: tempDir, cache: { clear: jest.fn() } });

    await request(app)
      .get('/api/admin/logs?file=error.log')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200)
      .expect(response => {
        expect(response.body.logs).toEqual([]);
        expect(response.body.notice).toBe('No log file available');
      });
  });

  it('covers partial cache clear, alternate clear methods, and missing methods', async () => {
    const appPartial = createApp({
      cache: { reset: jest.fn().mockResolvedValue(undefined) },
      semanticCache: { flush: jest.fn().mockRejectedValue(new Error('Flush error')) },
      responseCache: { unrecognized: true }
    });

    await request(appPartial)
      .post('/api/admin/cache/clear')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200)
      .expect(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Some caches were cleared');
        expect(response.body.results).toEqual(expect.arrayContaining([
          { name: 'cache', cleared: true, method: 'reset' },
          { name: 'semanticCache', cleared: false, method: 'flush', error: 'Flush error' },
          { name: 'responseCache', cleared: false, error: 'Cache does not expose a clear method' }
        ]));
      });
  });

  it('covers logs directory resolution fallback, limit clamping, truncation, and non-ENOENT errors', async () => {
    if (!tempDir) throw new Error('tempDir missing');

    // 1. logDirectory fallback and LOGS_DIR fallback
    const appWithLogDir = createApp({ logDirectory: tempDir });
    fs.writeFileSync(path.join(tempDir, 'combined.log'), 'test line\n', 'utf8');
    await request(appWithLogDir)
      .get('/api/admin/logs?limit=5000') // tests clamp to max
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200)
      .expect(response => {
        expect(response.body.limit).toBe(1000);
      });

    await request(appWithLogDir)
      .get('/api/admin/logs?limit=-5') // tests clamp to min
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200)
      .expect(response => {
        expect(response.body.limit).toBe(1);
      });

    // 2. Default users query without pagination params
    await request(appWithLogDir)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200)
      .expect(response => {
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(20);
      });

    // 3. Stats without services
    const appBare = createApp({});
    await request(appBare)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(200)
      .expect(response => {
        expect(response.body.services.orchestrator).toBe(false);
      });

    // 4. Null cache service
    const appNullCache = createApp({ cache: null });
    await request(appNullCache)
      .post('/api/admin/cache/clear')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(503);

    // 5. non-ENOENT error in readLogTail
    const appThrowingLogs = createApp({ logsDir: tempDir });
    const originalReadFile = fs.promises.readFile;
    jest.spyOn(fs.promises, 'stat').mockRejectedValueOnce(new Error('Permission denied'));
    await request(appThrowingLogs)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${adminToken()}`)
      .expect(500);
  });
});
