import express from 'express';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createAdminRouter } from '../admin';
import { AuthService } from '../../../core/auth/AuthService';

describe('RT-PLAT-003 / RT-ADM-001: Admin API Security and Observability Suite', () => {
  let tempLogsDir: string;
  let adminToken: string;
  let userToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-key-32-chars-long!';
    const authService = new AuthService();
    adminToken = authService.generateToken({
      id: 'admin-1',
      roles: ['admin']
    });

    userToken = authService.generateToken({
      id: 'user-1',
      roles: ['user']
    });
  });

  beforeEach(() => {
    tempLogsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-logs-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempLogsDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function createTestApp(services: any = {}) {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', createAdminRouter({ ...services, logsDir: tempLogsDir }));
    return app;
  }

  it('enforces authentication and admin role across all endpoints', async () => {
    const app = createTestApp();

    // 1. Unauthenticated (401)
    const unauth = await request(app).get('/api/admin/stats');
    expect(unauth.status).toBe(401);

    // 2. Forbidden regular user (403)
    const forbidden = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${userToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('serves stats, cache clear, user lists, and analytics when authorized', async () => {
    const mockCache = {
      clear: jest.fn(async () => {}),
      getStats: () => ({ size: 5, hits: 10, misses: 2 })
    };
    const mockDocManager = {
      getStats: async () => ({ documentsCount: 15, chunksCount: 120 })
    };
    const mockAnalytics = {
      getUsageStats: () => ({ totalRequests: 100 }),
      getQueryPatterns: () => [{ pattern: 'search', count: 10 }]
    };

    const app = createTestApp({
      cache: mockCache,
      documentManager: mockDocManager,
      analytics: mockAnalytics,
      orchestrator: true
    });

    // 1. Stats
    const statsRes = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.services.cache).toBe(true);
    expect(statsRes.body.knowledgeBase.documentsCount).toBe(15);

    // 2. Cache clear
    const cacheRes = await request(app)
      .post('/api/admin/cache/clear')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(cacheRes.status).toBe(200);
    expect(cacheRes.body.success).toBe(true);
    expect(mockCache.clear).toHaveBeenCalled();

    // 3. User listing
    const usersRes = await request(app)
      .get('/api/admin/users?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.pagination).toBeDefined();

    // 4. Analytics
    const analyticsRes = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.usage.totalRequests).toBe(100);
  });

  it('reads log files with secret redaction and validates file parameters', async () => {
    const combinedLog = path.join(tempLogsDir, 'combined.log');
    fs.writeFileSync(
      combinedLog,
      JSON.stringify({ timestamp: '2026-08-25T10:00:00Z', level: 'info', message: 'User logged in with api_key="sk-secret123" and Bearer secret-jwt-token' }) + '\n' +
      '2026-08-25 10:01:00 [error] Server error on line 42\n'
    );

    const app = createTestApp();

    // 1. Read logs
    const logRes = await request(app)
      .get('/api/admin/logs?file=combined.log&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(logRes.status).toBe(200);
    expect(logRes.body.logs.length).toBe(2);
    // Secret redaction check
    expect(JSON.stringify(logRes.body.logs)).toContain('[REDACTED]');
    expect(JSON.stringify(logRes.body.logs)).not.toContain('sk-secret123');

    // 2. Invalid log file pattern
    const invalidFileRes = await request(app)
      .get('/api/admin/logs?file=../../etc/passwd')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidFileRes.status).toBe(400);

    // 3. Invalid log level
    const invalidLevelRes = await request(app)
      .get('/api/admin/logs?level=supercritical')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidLevelRes.status).toBe(400);
  });
});
