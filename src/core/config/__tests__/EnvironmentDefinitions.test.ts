import {
  ENVIRONMENT_DEFINITIONS,
  ENVIRONMENT_DEFINITION_MAP,
  resolveDeploymentMode,
  isHostedMode
} from '../EnvironmentDefinitions';

describe('RT-PLAT-001 / RT-CONF-002: EnvironmentDefinitions and Deployment Profile Suite', () => {
  it('resolves explicit and fallback deployment modes correctly', () => {
    // 1. Explicit DEPLOYMENT_MODE
    expect(resolveDeploymentMode({ DEPLOYMENT_MODE: 'hosted' })).toBe('hosted');
    expect(resolveDeploymentMode({ DEPLOYMENT_MODE: 'local' })).toBe('local');
    expect(resolveDeploymentMode({ DEPLOYMENT_MODE: 'test' })).toBe('test');
    expect(resolveDeploymentMode({ DEPLOYMENT_MODE: 'development' })).toBe('development');

    // 2. Inferred from NODE_ENV
    expect(resolveDeploymentMode({ NODE_ENV: 'test' })).toBe('test');
    expect(resolveDeploymentMode({ NODE_ENV: 'production' })).toBe('hosted');
    expect(resolveDeploymentMode({ NODE_ENV: 'development' })).toBe('development');
    expect(resolveDeploymentMode({})).toBe('development');

    // 3. isHostedMode helper
    expect(isHostedMode({ DEPLOYMENT_MODE: 'hosted' })).toBe(true);
    expect(isHostedMode({ NODE_ENV: 'production' })).toBe(true);
    expect(isHostedMode({ DEPLOYMENT_MODE: 'local' })).toBe(false);
  });

  it('maps and categorizes all environment definitions', () => {
    expect(ENVIRONMENT_DEFINITIONS.length).toBeGreaterThan(50);
    expect(ENVIRONMENT_DEFINITION_MAP.get('JWT_SECRET')?.secret).toBe(true);
    expect(ENVIRONMENT_DEFINITION_MAP.get('NODE_ENV')?.defaultValue).toBe('development');
    expect(ENVIRONMENT_DEFINITION_MAP.get('OLLAMA_BASE_URL')?.requirement).toBe('local-only');

    const secrets = ENVIRONMENT_DEFINITIONS.filter(d => d.secret);
    expect(secrets.length).toBeGreaterThan(5);
  });
});
