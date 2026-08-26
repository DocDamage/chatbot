/**
 * Phase PX-17: Mock API & Developer Utility Router
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { DeveloperUtilityPackService } from '../../core/developer/DeveloperUtilityPackService';

export function createMockApiRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const service = new DeveloperUtilityPackService(workspaceRoot);

  router.get('/api/mock-api/status', (_req, res) => {
    res.json({
      status: 'ready',
      collectionsCount: service.getCollections().length,
      chaosEnabled: service.getChaosConfig().enabled
    });
  });

  // Collections schema
  router.get('/api/mock-api/collections', (_req, res) => {
    res.json({ collections: service.getCollections() });
  });

  router.post('/api/mock-api/collections', asyncHandler(async (req, res) => {
    const collection = service.createCollection(req.body);
    res.status(201).json({ collection });
  }));

  router.post('/api/mock-api/import', asyncHandler(async (req, res) => {
    const collection = service.importMockData({
      name: req.body.collection || req.body.name || 'imported',
      format: req.body.format || 'json',
      content: String(req.body.content || '')
    });
    res.status(201).json({ collection, endpoint: `/api/mock-api/collections/${collection.name}` });
  }));

  router.post('/api/mock-api/reset', asyncHandler(async (req, res) => {
    service.resetMockData(req.body.seed ? Number(req.body.seed) : undefined);
    res.json({ success: true, message: 'Mock data reset to initial seed' });
  }));

  // Dynamic CRUD for collections
  router.get('/api/mock-api/collections/:name', asyncHandler(async (req, res) => {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined;
    const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : 'asc';
    const includeRelations = req.query.includeRelations === 'true';

    const result = service.listRecords(req.params.name, {
      page,
      limit,
      sortBy,
      sortOrder,
      includeRelations
    });
    res.json(result);
  }));

  router.get('/api/mock-api/collections/:name/:id', asyncHandler(async (req, res) => {
    const includeRelations = req.query.includeRelations === 'true';
    const record = service.getRecordById(req.params.name, req.params.id, includeRelations);
    if (!record) {
      return res.status(404).json({ error: `Record '${req.params.id}' not found in '${req.params.name}'` });
    }
    res.json({ data: record });
  }));

  router.post('/api/mock-api/collections/:name', asyncHandler(async (req, res) => {
    const record = service.insertRecord(req.params.name, req.body);
    res.status(201).json({ data: record });
  }));

  router.patch('/api/mock-api/collections/:name/:id', asyncHandler(async (req, res) => {
    const record = service.updateRecord(req.params.name, req.params.id, req.body);
    res.json({ data: record });
  }));

  router.delete('/api/mock-api/collections/:name/:id', asyncHandler(async (req, res) => {
    const success = service.deleteRecord(req.params.name, req.params.id);
    res.json({ success });
  }));

  // Chaos Simulation Endpoints
  router.get('/api/mock-api/chaos/config', (_req, res) => {
    res.json({ config: service.getChaosConfig(), history: service.getChaosAuditHistory() });
  });

  router.post('/api/mock-api/chaos/config', asyncHandler(async (req, res) => {
    service.setChaosConfig(req.body);
    res.json({ config: service.getChaosConfig() });
  }));

  router.post('/api/mock-api/chaos/preset', asyncHandler(async (req, res) => {
    service.applyChaosPreset(req.body.preset);
    res.json({ config: service.getChaosConfig() });
  }));

  // OpenAPI Import
  router.post('/api/mock-api/openapi/import', asyncHandler(async (req, res) => {
    const result = service.importOpenApiSpec(req.body.spec);
    res.status(201).json(result);
  }));

  // Skill Export (Book-to-Skill)
  router.post('/api/mock-api/skill/export', asyncHandler(async (req, res) => {
    const bundle = service.exportSkillBundle(req.body);
    res.status(201).json({ bundle });
  }));

  // Capability Pack Scaffolding
  router.post('/api/mock-api/packs/scaffold', asyncHandler(async (req, res) => {
    const skeleton = service.scaffoldCapabilityPack(req.body);
    res.status(201).json(skeleton);
  }));

  // Project Doctor
  router.get('/api/mock-api/doctor', asyncHandler(async (_req, res) => {
    const report = service.runProjectDoctor();
    res.json({ report });
  }));

  return router;
}
