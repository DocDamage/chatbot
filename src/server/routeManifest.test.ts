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
});
