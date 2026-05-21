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
      .expect(401);
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

  it('returns bounded, filtered, and redacted log entries', async () => {
    if (!tempDir) throw new Error('tempDir missing');
    fs.writeFileSync(
      path.join(tempDir, 'combined.log'),
      [
        JSON.stringify({
          timestamp: '2026-05-20T10:00:00.000Z',
          level: 'info',
          message: 'normal line',
        }),
        JSON.stringify({
          timestamp: '2026-05-20T10:01:00.000Z',
          level: 'error',
          message: 'failed with token=super-secret',
          authorization: 'Bearer abc.def.ghi',
        }),
        '',
      ].join('\n'),
      'utf8'
    );

    const app = createApp({ logsDir: tempDir, cache: { clear: jest.fn() } });

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
  });

  it('rejects log path traversal and unknown log files', async () => {
    const app = createApp({ logsDir: tempDir, cache: { clear: jest.fn() } });

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
});
