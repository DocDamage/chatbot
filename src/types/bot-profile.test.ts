/**
 * Unit Tests for BotProfile Schemas (CRK-P02-T01)
 *
 * Verifies profile schema validation, default attributes, version audits,
 * and strict secret exclusion.
 */

import {
  botProfileSchema,
  botProfileVersionSchema,
  BotProfile,
  BotProfileVersion,
} from './bot-profile';

describe('BotProfile Schemas (CRK-P02-T01)', () => {
  const validProfile: BotProfile = {
    id: 'coding-assistant-v1',
    name: 'Senior Coding Assistant',
    description: 'Specialized profile for software engineering and debugging',
    version: 1,
    systemPolicyId: 'policy-coding-strict',
    responseStyle: 'adaptive',
    knowledgePolicyId: 'knowledge-official-docs',
    modelPolicyId: 'model-coding-preferred',
    memoryPolicyId: 'memory-session-only',
    toolPolicyId: 'tool-git-and-terminal',
    citationPolicy: 'always-when-grounded',
    enabled: true,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('validates a complete BotProfile with all policy bindings', () => {
    const parsed = botProfileSchema.parse(validProfile);
    expect(parsed.id).toBe('coding-assistant-v1');
    expect(parsed.responseStyle).toBe('adaptive');
    expect(parsed.citationPolicy).toBe('always-when-grounded');
  });

  it('applies canonical defaults for omitted optional fields', () => {
    const minimal = {
      id: 'default-bot',
      name: 'Default Assistant',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsed = botProfileSchema.parse(minimal);
    expect(parsed.version).toBe(1);
    expect(parsed.systemPolicyId).toBe('default-policy');
    expect(parsed.responseStyle).toBe('adaptive');
    expect(parsed.knowledgePolicyId).toBe('default');
    expect(parsed.citationPolicy).toBe('auto');
    expect(parsed.enabled).toBe(true);
    expect(parsed.isDefault).toBe(false);
  });

  it('rejects profiles containing secrets or credentials (§907)', () => {
    const maliciousProfile = {
      ...validProfile,
      apiKey: 'sk-1234567890abcdef',
    };

    expect(() => botProfileSchema.parse(maliciousProfile)).toThrow();
  });

  it('rejects invalid profile IDs with special characters or whitespace', () => {
    expect(() => botProfileSchema.parse({ ...validProfile, id: 'invalid id with spaces' })).toThrow();
    expect(() => botProfileSchema.parse({ ...validProfile, id: 'invalid/slashes' })).toThrow();
  });

  it('validates a BotProfileVersion audit record', () => {
    const auditRecord: BotProfileVersion = {
      profileId: validProfile.id,
      version: 2,
      previousVersion: 1,
      changedFields: ['responseStyle', 'citationPolicy'],
      author: 'admin@example.org',
      timestamp: new Date().toISOString(),
      activationState: 'active',
      rolloutPercentage: 100,
      snapshot: { ...validProfile, version: 2, responseStyle: 'concise' },
    };

    const parsed = botProfileVersionSchema.parse(auditRecord);
    expect(parsed.version).toBe(2);
    expect(parsed.previousVersion).toBe(1);
    expect(parsed.changedFields).toContain('responseStyle');
    expect(parsed.snapshot.responseStyle).toBe('concise');
  });
});
