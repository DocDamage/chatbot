import { CapabilityRegistry } from '../CapabilityRegistry';

describe('B75-08: Capability Registry Deep Decision Matrix', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = CapabilityRegistry.getInstance();
    registry.clearOverrides();
  });

  afterEach(() => {
    registry.clearOverrides();
  });

  it('filters capabilities by deployment profile and user role', () => {
    const hostedUser = registry.getCapabilities('hosted', 'user');
    expect(hostedUser.length).toBeGreaterThan(0);

    const localDev = registry.getCapabilities('local', 'developer');
    expect(localDev.length).toBeGreaterThanOrEqual(hostedUser.length);

    const admin = registry.getCapabilities('local', 'admin');
    expect(admin.length).toBeGreaterThanOrEqual(localDev.length);
  });

  it('retrieves single capabilities and manages enable/disable overrides', () => {
    const cap = registry.getCapabilityById('browser_jobs', 'local', 'developer');
    expect(cap).toBeDefined();
    expect(cap?.id).toBe('browser_jobs');

    const disabled = registry.disableCapability('browser_jobs');
    expect(disabled).toBe(true);

    const capDisabled = registry.getCapabilityById('browser_jobs', 'local', 'developer');
    expect(capDisabled?.healthState).toBe('disabled');

    const enabled = registry.restoreCapabilityPolicy('browser_jobs');
    expect(enabled).toBe(true);

    registry.clearOverrides();
    const restored = registry.getCapabilityById('browser_jobs', 'local', 'developer');
    expect(restored?.healthState).not.toBe('disabled');
  });
});
