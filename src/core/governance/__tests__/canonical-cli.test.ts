import { CanonicalCliRegistry } from '../CanonicalCliRegistry';
import { CanonicalCliCommandName } from '../../../types/cli-scripts';

describe('CanonicalCliRegistry (§46)', () => {
  let registry: CanonicalCliRegistry;

  beforeEach(() => {
    registry = new CanonicalCliRegistry();
  });

  it('registers all 16 canonical commands', () => {
    const list = registry.list();
    expect(list.length).toBe(16);

    const categories = ['chat', 'knowledge', 'eval', 'check'] as const;
    for (const cat of categories) {
      const catList = registry.list(cat);
      expect(catList.length).toBeGreaterThan(0);
    }
  });

  it('executes command successfully in development environment', async () => {
    const result = await registry.execute('chat:runtime:smoke', {
      environment: 'development',
      authenticated: false,
      bypassAuthRequested: false,
      args: []
    });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('chat:runtime:smoke');
    expect(result.securityViolation).toBeUndefined();
  });

  it('rejects unauthenticated protected command in production', async () => {
    const result = await registry.execute('chat:runtime:golden', {
      environment: 'production',
      authenticated: false,
      bypassAuthRequested: false,
      args: []
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(401);
    expect(result.securityViolation).toBe('UNAUTHENTICATED_PROD_EXECUTION');
  });

  it('strictly prohibits auth bypass requests in production (§46 invariant)', async () => {
    const result = await registry.execute('knowledge:install', {
      environment: 'production',
      authenticated: false,
      bypassAuthRequested: true,
      args: ['--pack', 'official_docs', '--bypass-auth']
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(403);
    expect(result.securityViolation).toBe('PROD_AUTH_BYPASS_ATTEMPT');
  });

  it('allows authenticated execution in production', async () => {
    const result = await registry.execute('knowledge:install', {
      environment: 'production',
      authenticated: true,
      bypassAuthRequested: false,
      args: ['--pack', 'official_docs']
    });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('returns failure on unknown command', async () => {
    const result = await registry.execute('unknown:cmd' as CanonicalCliCommandName, {
      environment: 'development',
      authenticated: false,
      bypassAuthRequested: false,
      args: []
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown CLI command');
  });
});
