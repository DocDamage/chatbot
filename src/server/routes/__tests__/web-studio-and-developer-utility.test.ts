/**
 * Route tests for Phase PX-16 Web Studio & Phase PX-17 Developer Utility Pack
 */

import request from 'supertest';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createWebsiteWorkspaceRouter } from '../website-workspace';
import { createMockApiRouter } from '../mock-api';

describe('Web Studio & Developer Utility Routes', () => {
  let app: express.Application;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'routes-test-'));
    app = express();
    app.use(express.json());
    app.use(createWebsiteWorkspaceRouter(tempDir));
    app.use(createMockApiRouter(tempDir));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Website Workspace / Web Studio Routes (PX-16)', () => {
    it('GET /api/website-workspace/project returns default project', async () => {
      const res = await request(app).get('/api/website-workspace/project');
      expect(res.status).toBe(200);
      expect(res.body.project).toBeDefined();
      expect(res.body.project.schemaVersion).toBe('2.0.0');
    });

    it('POST /api/website-workspace/preview returns sandboxed HTML', async () => {
      const res = await request(app)
        .post('/api/website-workspace/preview')
        .send({ slug: 'home' });

      expect(res.status).toBe(200);
      expect(res.body.html).toContain('<!doctype html>');
      expect(res.body.html).toContain('Content-Security-Policy');
    });

    it('GET /api/website-workspace/templates returns block templates', async () => {
      const res = await request(app).get('/api/website-workspace/templates');
      expect(res.status).toBe(200);
      expect(res.body.templates.length).toBeGreaterThan(5);
    });

    it('GET /api/website-workspace/audit returns accessibility audit score', async () => {
      const res = await request(app).get('/api/website-workspace/audit');
      expect(res.status).toBe(200);
      expect(res.body.report.score).toBeGreaterThan(70);
    });

    it('GET /api/website-workspace/export returns multi-page bundle', async () => {
      const res = await request(app).get('/api/website-workspace/export');
      expect(res.status).toBe(200);
      expect(res.body.bundle.files.length).toBeGreaterThan(0);
      expect(res.body.validation.valid).toBe(true);
    });
  });

  describe('Mock API & Developer Utility Routes (PX-17)', () => {
    it('GET /api/mock-api/status returns status and collections count', async () => {
      const res = await request(app).get('/api/mock-api/status');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.collectionsCount).toBeGreaterThanOrEqual(1);
    });

    it('POST and GET /api/mock-api/collections/:name performs CRUD operations', async () => {
      // Create record
      const postRes = await request(app)
        .post('/api/mock-api/collections/users')
        .send({ id: 10, name: 'Margaret Hamilton', email: 'margaret@apollo.org', role: 'admin' });

      expect(postRes.status).toBe(201);
      expect(postRes.body.data.name).toBe('Margaret Hamilton');

      // List records
      const listRes = await request(app).get('/api/mock-api/collections/users');
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((u: any) => u.name === 'Margaret Hamilton')).toBe(true);

      // Get record by ID
      const getRes = await request(app).get('/api/mock-api/collections/users/10');
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.email).toBe('margaret@apollo.org');

      // Delete record
      const delRes = await request(app).delete('/api/mock-api/collections/users/10');
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });

    it('POST /api/mock-api/chaos/preset configures chaos simulation preset', async () => {
      const res = await request(app)
        .post('/api/mock-api/chaos/preset')
        .send({ preset: 'INTERMITTENT_503' });

      expect(res.status).toBe(200);
      expect(res.body.config.enabled).toBe(true);
      expect(res.body.config.errorRate).toBe(0.33);
    });

    it('POST /api/mock-api/skill/export generates source-preserving skill bundle', async () => {
      const res = await request(app)
        .post('/api/mock-api/skill/export')
        .send({
          skillId: 'git-rebase-flow',
          displayName: 'Git Rebase Flow',
          description: 'Step-by-step interactive rebase procedures',
          sourceDocuments: [
            {
              name: 'git-manual.md',
              content: '# Git Rebase\nUse git rebase -i to squash commits.'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.bundle.skillId).toBe('git-rebase-flow');
      expect(res.body.bundle.sourceDigests['git-manual.md']).toBeDefined();
    });

    it('POST /api/mock-api/packs/scaffold generates capability pack skeleton', async () => {
      const res = await request(app)
        .post('/api/mock-api/packs/scaffold')
        .send({
          packId: 'local-analytics-pack',
          displayName: 'Local Analytics Pack',
          description: 'Privacy-first embedded analytics engine',
          author: 'Dev Team',
          includeSkill: true
        });

      expect(res.status).toBe(201);
      expect(res.body.manifest.id).toBe('local-analytics-pack');
      expect(res.body.files.length).toBeGreaterThan(2);
    });

    it('POST /api/mock-api/import and reset import and reset mock data', async () => {
      // Import CSV
      const importRes = await request(app)
        .post('/api/mock-api/import')
        .send({
          collection: 'products',
          format: 'csv',
          content: 'id,name,price\n1,Widget,9.99\n2,Gadget,19.99'
        });
      expect(importRes.status).toBe(201);
      expect(importRes.body.collection.records.length).toBe(2);

      // Reset
      const resetRes = await request(app)
        .post('/api/mock-api/reset')
        .send({ seed: 42 });
      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
    });

    it('PATCH and 404 handling on /api/mock-api/collections/:name/:id', async () => {
      // Create record
      await request(app)
        .post('/api/mock-api/collections/users')
        .send({ id: 99, name: 'Alice Smith', email: 'alice@test.com' });

      // Patch record
      const patchRes = await request(app)
        .patch('/api/mock-api/collections/users/99')
        .send({ name: 'Alice Johnson' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.name).toBe('Alice Johnson');

      // 404 for non-existent record
      const notFoundRes = await request(app).get('/api/mock-api/collections/users/9999');
      expect(notFoundRes.status).toBe(404);
    });

    it('Chaos configuration and OpenAPI import endpoints', async () => {
      // GET /chaos/config
      const chaosGet = await request(app).get('/api/mock-api/chaos/config');
      expect(chaosGet.status).toBe(200);
      expect(chaosGet.body.config).toBeDefined();

      // POST /chaos/config
      const chaosPost = await request(app)
        .post('/api/mock-api/chaos/config')
        .send({ enabled: true, latencyMs: 50 });
      expect(chaosPost.status).toBe(200);

      // POST /openapi/import
      const openApiRes = await request(app)
        .post('/api/mock-api/openapi/import')
        .send({
          spec: {
            openapi: '3.0.0',
            info: { title: 'Test API', version: '1.0.0' },
            paths: {
              '/users': {
                get: { summary: 'Get Users', responses: { '200': { description: 'OK' } } }
              }
            }
          }
        });
      expect(openApiRes.status).toBe(201);
    });

    it('MockApiWorkspaceService parses CSV, JSON, normalizes names, and handles error branches', () => {
      const { MockApiWorkspaceService } = require('../../../core/local-tools/MockApiWorkspaceService');
      const service = new MockApiWorkspaceService(tempDir);

      // Import JSON array
      const jsonCol = service.importText({
        collection: 'inventory',
        content: JSON.stringify([{ id: 1, item: 'Laptop' }, { id: 2, item: 'Mouse' }])
      });
      expect(jsonCol.name).toBe('inventory');
      expect(jsonCol.records.length).toBe(2);

      // List specific collection
      expect(service.list('inventory').length).toBe(1);
      expect(service.list().length).toBeGreaterThanOrEqual(1);
      expect(service.status().collections.length).toBeGreaterThanOrEqual(1);

      // Error branches
      expect(() => service.importText({ content: '' })).toThrow('mock data content is required');
      expect(() => service.importText({ content: 'only-one-line' })).toThrow('CSV mock data needs a header row');
      expect(() => service.importText({ format: 'json', content: '["primitive string not object"]' })).toThrow('JSON mock data must be an object');
    });
  });
});
