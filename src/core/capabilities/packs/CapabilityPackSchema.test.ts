import { validateCapabilityPackManifest, CapabilityPackManifest } from './CapabilityPackManifest';
import validFixture from './__fixtures__/valid-manifest.json';
import invalidFixture from './__fixtures__/invalid-manifest.json';

describe('CapabilityPackSchema (PX02-T01)', () => {
  it('validates a compliant capability pack manifest', () => {
    const result = validateCapabilityPackManifest(validFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('pack-context-economy');
      expect(result.data.maturity).toBe('experimental');
      expect(result.data.capabilities[0].id).toBe('context-economy');
      expect(result.data.tools?.[0].id).toBe('retrieve_original_context');
    }
  });

  it('rejects an invalid manifest missing required fields with formatted errors', () => {
    const result = validateCapabilityPackManifest(invalidFixture);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('schemaVersion'))).toBe(true);
      expect(result.errors.some(e => e.includes('id'))).toBe(true);
    }
  });

  it('allows unknown fields forward-compatibly', () => {
    const forwardCompatibleManifest = {
      ...validFixture,
      futureField: 'compatible-value',
      futureConfig: { enabled: true, flags: [1, 2, 3] }
    };
    const result = validateCapabilityPackManifest(forwardCompatibleManifest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).futureField).toBe('compatible-value');
    }
  });
});
