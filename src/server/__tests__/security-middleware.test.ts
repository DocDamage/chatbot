import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { securityHeaders } from '../../middleware/security';

describe('RT-SEC-004: Security Middleware and CSP Suite', () => {
  it('applies helmet security headers to responses', async () => {
    const app = express();
    app.use(securityHeaders);
    app.get('/test', (_req, res) => res.send('ok'));

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});
