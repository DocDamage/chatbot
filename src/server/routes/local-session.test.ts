import express from 'express';
import request from 'supertest';
import { createLocalSessionRouter } from './local-session';
import { AuthService } from '../../core/auth/AuthService';

describe('local session boundary', () => {
  const original = { ...process.env };
  const app = express().use('/api/auth', createLocalSessionRouter());
  beforeEach(() => {
    process.env.DEPLOYMENT_MODE = 'local';
    process.env.HOST = '127.0.0.1';
    process.env.PORT = '3001';
    process.env.JWT_SECRET = 'local-session-test-secret-at-least-32-characters';
  });
  afterEach(() => { process.env = { ...original }; });

  it('issues a short-lived local owner token only for the local app', async () => {
    const response = await request(app).post('/api/auth/local-session').set('Host', '127.0.0.1:3001').set('Origin', 'http://127.0.0.1:3001');
    expect(response.status).toBe(200);
    const payload = new AuthService().verifyToken(response.body.token);
    expect(payload).toMatchObject({ userId: 'local-user', roles: ['admin', 'developer'] });
    expect(payload!.exp! - payload!.iat!).toBeLessThanOrEqual(86400);
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it.each(['hosted', 'development', 'test'])('does not expose local sign-in in %s mode', async mode => {
    process.env.DEPLOYMENT_MODE = mode;
    expect((await request(app).post('/api/auth/local-session').set('Host', '127.0.0.1:3001')).status).toBe(404);
  });
  it('rejects cross-origin pages and DNS-rebinding hostnames', async () => {
    expect((await request(app).post('/api/auth/local-session').set('Host', '127.0.0.1:3001').set('Origin', 'https://other.example')).status).toBe(403);
    expect((await request(app).post('/api/auth/local-session').set('Host', 'other.example:3001')).status).toBe(403);
    expect((await request(app).post('/api/auth/local-session').set('Host', '127.0.0.1:3001').set('Sec-Fetch-Site', 'cross-site')).status).toBe(403);
  });
  it('fails closed if the server is configured to listen on all interfaces', async () => {
    process.env.HOST = '0.0.0.0';
    expect((await request(app).post('/api/auth/local-session').set('Host', '127.0.0.1:3001')).status).toBe(404);
  });
});
