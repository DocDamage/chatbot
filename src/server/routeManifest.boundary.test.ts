import { getActiveRouteManifest, routeManifest } from './routeManifest';

describe('route manifest production boundary', () => {
  it('classifies every route with availability and release status', () => {
    expect(routeManifest).not.toHaveLength(0);
    expect(routeManifest.every(entry => entry.availability && entry.status)).toBe(true);
  });

  it('excludes local-only integrations from hosted registration', () => {
    const hostedNames = getActiveRouteManifest('hosted').map(entry => entry.name);
    expect(hostedNames).not.toEqual(expect.arrayContaining([
      'code', 'plans', 'files', 'audio', 'local-tools', 'sprite-lab', 'sprite-studio', 'game-studio', 'music-studio', 'flstudio', 'capabilities'
    ]));
    expect(hostedNames).toEqual(expect.arrayContaining(['rag-query', 'admin', 'knowledge-online']));
  });

  it('retains local-only integrations for trusted local mode', () => {
    const localNames = getActiveRouteManifest('local').map(entry => entry.name);
    expect(localNames).toEqual(expect.arrayContaining([
      'local-tools', 'sprite-lab', 'sprite-studio', 'game-studio', 'music-studio', 'flstudio', 'capabilities'
    ]));
  });
});
