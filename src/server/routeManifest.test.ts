import express, { RequestHandler } from 'express';
import request from 'supertest';
import { registerManifestRoutes, routeManifest } from './routeManifest';

describe('routeManifest', () => {
  it('documents privileged route groups and readiness policy', () => {
    expect(routeManifest).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'code', mount: '/api/code', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'files', mount: '/api/files', privilege: 'developer', readiness: false }),
      expect.objectContaining({ name: 'audio', mount: '/api/audio', privilege: 'developer', readiness: false }),
      expect.objectContaining({ name: 'task-artifacts', mount: '/api/task-artifacts', readiness: false }),
      expect.objectContaining({ name: 'local-tools', mount: '/api/local-tools', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'project-intelligence', mount: '/api/project-intelligence', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'project-memory', mount: '/api/project-memory', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'document-workspace', mount: '/api/document-workspace', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'mock-api', mount: '/api/mock-api', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'website-workspace', mount: '/api/website-workspace', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'desktop-companion', mount: '/api/desktop-companion', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'tool-catalog', mount: '/api/tool-catalog', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'sec', mount: '/api/sec', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'education', mount: '/api/education', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'knowledge-online', mount: '/api/knowledge-online', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'admin', mount: '/api/admin', privilege: 'admin' }),
      expect.objectContaining({ name: 'export', mount: '/api/export', privilege: 'admin' }),
    ]));
  });

  it('keeps every privileged route auditable', () => {
    const privileged = routeManifest.filter(route => route.privilege);

    expect(privileged).not.toHaveLength(0);
    expect(privileged.every(route => route.auditAction)).toBe(true);
  });

  it('mounts relative routers under their declared API path with guards', () => {
    const registrations: any[][] = [];
    const marker = (name: string) => Object.assign(() => undefined, { marker: name });

    registerManifestRoutes({
      app: { use: (...handlers: any[]) => registrations.push(handlers) },
      getServices: () => ({}),
      workspaceRoot: process.cwd(),
      adminOnly: [marker('admin')],
      developerOnly: [marker('developer')],
      requireReady: () => marker('ready'),
      mountServiceRouter: () => marker('router')
    });

    const capabilityMount = registrations.find(args => args[0] === '/api/capabilities');
    expect(capabilityMount).toBeDefined();
    expect(capabilityMount?.some(handler => handler.marker === 'developer')).toBe(true);
    expect(capabilityMount?.some(handler => handler.marker === 'ready')).toBe(true);
    expect(capabilityMount?.some(handler => handler.marker === 'router')).toBe(true);

    const projectMount = registrations.find(args => args[0] === '/api/project-intelligence');
    expect(projectMount?.some(handler => handler.marker === 'router')).toBe(false);
  });

  it('does not construct mounted absolute routers for unrelated or lookalike paths', async () => {
    const registrations: any[][] = [];
    const factoryConstructed = jest.fn();
    const observedUrls: string[] = [];
    const developerGuard = jest.fn((req: any, res: any, next: any) => {
      if (req.headers['x-test-developer'] !== 'allow') {
        res.sendStatus(401);
        return;
      }
      next();
    });
    const readinessGuard = jest.fn((_: any, __: any, next: any) => next());

    registerManifestRoutes({
      app: { use: (...handlers: any[]) => registrations.push(handlers) },
      getServices: () => ({}),
      workspaceRoot: process.cwd(),
      adminOnly: [],
      developerOnly: [developerGuard],
      requireReady: () => readinessGuard,
      mountServiceRouter: () => {
        let router: RequestHandler | undefined;
        return (req, res, next) => {
          if (!router) {
            factoryConstructed();
            router = (request, response) => {
              observedUrls.push(request.url);
              response.status(204).end();
            };
          }
          return router(req, res, next);
        };
      },
    });

    const prefixIndex = registrations.findIndex(args => args[0] === '/api/desktop-companion');
    expect(prefixIndex).toBeGreaterThanOrEqual(0);
    const mountedGuards = registrations[prefixIndex];
    const absoluteRouterGuard = registrations[prefixIndex + 1];
    expect(absoluteRouterGuard).toHaveLength(1);

    const nested = express();
    nested.use(...mountedGuards);
    nested.use(...absoluteRouterGuard);
    nested.use((_req, res) => res.sendStatus(404));
    const app = express();
    app.use('/root', nested);

    await request(app).get('/root/api/feedback').expect(404);
    await request(app).get('/root/api/desktop-companionary').expect(404);
    expect(factoryConstructed).not.toHaveBeenCalled();
    expect(developerGuard).not.toHaveBeenCalled();
    expect(readinessGuard).not.toHaveBeenCalled();

    await request(app).get('/root/api/desktop-companion').expect(401);
    expect(factoryConstructed).not.toHaveBeenCalled();
    expect(readinessGuard).not.toHaveBeenCalled();

    await request(app).get('/root/api/desktop-companion').set('x-test-developer', 'allow').expect(204);
    await request(app).get('/root/api/desktop-companion?mode=compact').set('x-test-developer', 'allow').expect(204);
    await request(app).get('/root/api/desktop-companion/capabilities?mode=full').set('x-test-developer', 'allow').expect(204);
    await request(app).get('/root/API/DESKTOP-COMPANION?mode=mixed').set('x-test-developer', 'allow').expect(204);
    expect(factoryConstructed).toHaveBeenCalledTimes(1);
    expect(observedUrls).toEqual([
      '/api/desktop-companion',
      '/api/desktop-companion?mode=compact',
      '/api/desktop-companion/capabilities?mode=full',
      '/API/DESKTOP-COMPANION?mode=mixed',
    ]);
    expect(developerGuard).toHaveBeenCalledTimes(5);
    expect(readinessGuard).toHaveBeenCalledTimes(4);
  });
});
