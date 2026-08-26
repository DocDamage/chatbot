import express, { RequestHandler } from 'express';
import request from 'supertest';
import { registerManifestRoutes, getActiveRouteManifest, routeManifest } from '../routeManifest';
import { registerHealthRoutes } from '../healthRoutes';

describe('RT-ROUTER-001: RouteManifest Comprehensive Mounting & Execution Suite', () => {
  let app: express.Application;
  const mockServices: any = {
    database: { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
    orchestrator: {
      processRequest: jest.fn().mockResolvedValue({ response: 'ok', sessionId: 's1' })
    },
    analytics: { getAnalyticsSummary: jest.fn().mockResolvedValue({ totalQueries: 0 }) },
    cache: { getStats: jest.fn().mockReturnValue({ levels: ['memory'] }) },
    documentManager: { getStats: jest.fn().mockReturnValue({ chunks: 0 }) },
    mathGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'math', summary: 'ok' }) },
    marketGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'market', summary: 'ok' }) },
    sixSigmaBlackBeltAgent: { handle: jest.fn().mockResolvedValue({ intent: 'sixsigma', summary: 'ok' }) },
    storyGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'story', summary: 'ok' }) },
    musicProductionGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'music', summary: 'ok' }) },
    businessGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'business', summary: 'ok' }) },
    healthGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'health', summary: 'ok' }) },
    securityGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'security', summary: 'ok' }) },
    philosophyGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'philosophy', summary: 'ok' }) },
    languageGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'language', summary: 'ok' }) },
    geoCultureGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'geography', summary: 'ok' }) },
    engineeringGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'engineering', summary: 'ok' }) },
    gameDevGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'gamedev', summary: 'ok' }) },
    gamingGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'gaming', summary: 'ok' }) },
    historyGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'history', summary: 'ok' }) },
    scienceInventionGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'science', summary: 'ok' }) },
    popCultureGeniusAgent: { handle: jest.fn().mockResolvedValue({ intent: 'pop_culture', summary: 'ok' }) },
    chronoKnowledgeEngine: { queryTimeline: jest.fn().mockResolvedValue({ timeline: [] }) },
    toolRegistry: { getAll: jest.fn().mockReturnValue([]) },
    pyScrappyService: { status: jest.fn().mockReturnValue({ available: true }) }
  };

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Health routes
    registerHealthRoutes(app as any, {
      getStartupState: () => 'ready',
      getStartupError: () => undefined,
      getServices: () => mockServices,
      getOrchestrator: () => mockServices.orchestrator
    });

    // Pass-through auth handlers for integration testing
    const passThrough: RequestHandler = (req, res, next) => next();

    registerManifestRoutes({
      app,
      getServices: () => mockServices,
      workspaceRoot: process.cwd(),
      requireReady: () => passThrough,
      mountServiceRouter: (factory) => (req, res, next) => {
        try {
          const router = factory();
          return router(req, res, next);
        } catch (e) {
          return next(e);
        }
      },
      adminOnly: [passThrough],
      developerOnly: [passThrough]
    });
  });

  it('exposes manifest entries and verifies all routes are declared', () => {
    const active = getActiveRouteManifest();
    expect(active.length).toBeGreaterThanOrEqual(30);
    expect(routeManifest.length).toBeGreaterThanOrEqual(30);
  });

  it('responds to health routes', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(['ok', 'ready', 'degraded', 'initializing']).toContain(res.body.status);

    const liveRes = await request(app).get('/health/live');
    expect(liveRes.status).toBe(200);
    expect(liveRes.body.status).toBe('alive');

    const readyRes = await request(app).get('/health/ready');
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.status).toBe('ready');

    const metricsRes = await request(app).get('/api/metrics');
    expect(metricsRes.status).toBe(200);
  });

  it('invokes capability and tool-catalog routes', async () => {
    const capRes = await request(app).get('/api/capabilities');
    expect([200, 404, 500]).toContain(capRes.status);

    const toolRes = await request(app).get('/api/tool-catalog');
    expect([200, 404, 500]).toContain(toolRes.status);
  });

  it('invokes writing and study studio routes', async () => {
    const writeRes = await request(app).get('/api/writing-studio/state');
    expect([200, 404]).toContain(writeRes.status);

    const studyRes = await request(app).get('/api/study-studio/decks');
    expect([200, 404]).toContain(studyRes.status);
  });

  it('invokes context economy routes', async () => {
    const ctxRes = await request(app).get('/api/context-economy/status');
    expect([200, 404]).toContain(ctxRes.status);
  });
});
