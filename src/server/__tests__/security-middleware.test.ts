import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { securityHeaders, corsOptions } from '../../middleware/security';

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

  it('evaluates corsOptions across environment configurations', () => {
    // 1. Static corsOptions exported object
    expect(corsOptions).toBeDefined();
    expect(corsOptions.credentials).toBe(true);
    expect(corsOptions.optionsSuccessStatus).toBe(200);

    // 2. Test CORS origin evaluation with CORS_ORIGIN set
    const originalEnv = { ...process.env };
    try {
      process.env.CORS_ORIGIN = 'https://app.example.com, https://admin.example.com ';
      jest.isolateModules(() => {
        const { corsOptions: dynamicCors } = require('../../middleware/security');
        expect(dynamicCors.origin).toEqual(['https://app.example.com', 'https://admin.example.com']);
      });

      // 3. Test CORS origin in production mode without CORS_ORIGIN
      delete process.env.CORS_ORIGIN;
      process.env.NODE_ENV = 'production';
      jest.isolateModules(() => {
        const { corsOptions: prodCors } = require('../../middleware/security');
        expect(prodCors.origin).toBe(false);
      });

      // 4. Test CORS origin in development mode without CORS_ORIGIN
      process.env.NODE_ENV = 'development';
      jest.isolateModules(() => {
        const { corsOptions: devCors } = require('../../middleware/security');
        expect(devCors.origin).toBe(true);
      });
    } finally {
      process.env = originalEnv;
    }
  });
});
