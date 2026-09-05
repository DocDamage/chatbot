import {
  ROUTING_DOMAINS,
  routingDomainSchema,
  userKnowledgeOverridesSchema,
  domainRoutePolicySchema,
  routingDecisionSchema,
} from './knowledge-router';

describe('Knowledge Router Schemas (CRK-P08)', () => {
  it('defines the 15 canonical routing domains (§1767)', () => {
    expect(ROUTING_DOMAINS).toHaveLength(15);
    expect(ROUTING_DOMAINS).toContain('coding');
    expect(ROUTING_DOMAINS).toContain('coding_debug');
    expect(ROUTING_DOMAINS).toContain('repository');
    expect(ROUTING_DOMAINS).toContain('game_dev');
    expect(ROUTING_DOMAINS).toContain('web_dev');
    expect(ROUTING_DOMAINS).toContain('database');
    expect(ROUTING_DOMAINS).toContain('devops');
    expect(ROUTING_DOMAINS).toContain('general');
    expect(ROUTING_DOMAINS).toContain('history');
    expect(ROUTING_DOMAINS).toContain('science');
    expect(ROUTING_DOMAINS).toContain('research');
    expect(ROUTING_DOMAINS).toContain('math');
    expect(ROUTING_DOMAINS).toContain('market');
    expect(ROUTING_DOMAINS).toContain('six_sigma');
    expect(ROUTING_DOMAINS).toContain('creative_reference');
  });

  it('validates user knowledge overrides with noOnline flag', () => {
    const override = {
      mode: 'custom',
      includePacks: ['core-official-docs'],
      excludePacks: ['general-knowledge'],
      noOnline: true,
    };
    const parsed = userKnowledgeOverridesSchema.parse(override);
    expect(parsed.noOnline).toBe(true);
    expect(parsed.includePacks).toContain('core-official-docs');
  });

  it('validates a domain route policy and routing decision with telemetry', () => {
    const policy = {
      domain: 'coding_debug',
      packPrecedence: ['core-official-docs', 'developer-qa', 'curated-code'],
      allowOnlineFallback: true,
    };
    const parsedPolicy = domainRoutePolicySchema.parse(policy);
    expect(parsedPolicy.domain).toBe('coding_debug');

    const decision = {
      domain: 'coding_debug',
      candidatePacks: ['core-official-docs', 'developer-qa', 'curated-code'],
      selectedPacks: ['core-official-docs', 'developer-qa'],
      unavailablePacks: ['curated-code'],
      allowWeb: false,
      overridesApplied: false,
      telemetry: {
        evaluatedAt: new Date().toISOString(),
        durationMs: 4,
        domain: 'coding_debug',
        requestedPacks: ['core-official-docs', 'developer-qa', 'curated-code'],
        resolvedPacks: ['core-official-docs', 'developer-qa'],
        missingPacks: ['curated-code'],
        noOnlinePreference: false,
      },
    };

    const parsedDecision = routingDecisionSchema.parse(decision);
    expect(parsedDecision.selectedPacks).toHaveLength(2);
    expect(parsedDecision.unavailablePacks).toContain('curated-code');
  });
});
