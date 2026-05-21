import { routeManifest } from './routeManifest';

describe('routeManifest', () => {
  it('documents privileged route groups and readiness policy', () => {
    expect(routeManifest).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'code', mount: '/api/code', privilege: 'developer', readiness: true }),
      expect.objectContaining({ name: 'files', mount: '/api/files', privilege: 'developer', readiness: false }),
      expect.objectContaining({ name: 'audio', mount: '/api/audio', privilege: 'developer', readiness: false }),
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
});
