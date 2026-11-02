import { ModelRegistry } from '../ModelRegistry';
import { ModelPolicyEngine } from '../ModelPolicyEngine';
import { ModelFallbackPlanner } from '../ModelFallbackPlanner';
import { UserFacingModelPolicy } from '../../../types/model-registry';

describe('Model Registry & Policy Engine (§2006-2144, CRK-P10)', () => {
  let registry: ModelRegistry;
  let policyEngine: ModelPolicyEngine;
  let fallbackPlanner: ModelFallbackPlanner;

  beforeEach(() => {
    registry = new ModelRegistry();
    fallbackPlanner = new ModelFallbackPlanner();
    policyEngine = new ModelPolicyEngine(registry, fallbackPlanner);
  });

  it('T01 & T04: should route according to user policies (FAST, CODING, LOCAL)', () => {
    // FAST policy should prefer low-cost/fast models
    const fastDecision = policyEngine.route({
      policy: UserFacingModelPolicy.FAST
    });
    expect(['gemini-1.5-flash', 'gpt-4o-mini']).toContain(fastDecision.selected.model);

    // CODING policy should prefer advanced coding class
    const codingDecision = policyEngine.route({
      policy: UserFacingModelPolicy.CODING,
      requiresTools: true
    });
    expect(codingDecision.selected.capabilities.codingClass).toBe('advanced');
    expect(codingDecision.selected.capabilities.tools).toBe(true);

    // LOCAL policy must strictly pick a local model
    const localDecision = policyEngine.route({
      policy: UserFacingModelPolicy.LOCAL
    });
    expect(localDecision.selected.privacy).toBe('local');
  });

  it('T05: should enforce hard capability constraints (tools & vision)', () => {
    const decision = policyEngine.route({
      policy: UserFacingModelPolicy.LOCAL,
      requiresTools: true // Only deepseek-coder supports tools among local seed models
    });

    expect(decision.selected.model).toBe('deepseek-coder-6.7b');
    expect(decision.selected.capabilities.tools).toBe(true);
  });

  it('T06: fallback chain must preserve hard requirements and never drop tools silently', () => {
    const decision = policyEngine.route({
      policy: UserFacingModelPolicy.CODING,
      requiresTools: true
    });

    expect(decision.fallbackChain.length).toBeGreaterThan(0);
    for (const fallback of decision.fallbackChain) {
      expect(fallback.capabilities.tools).toBe(true);
    }
  });

  it('T06 & T07: dynamic health check triggers observable failover when provider is rate-limited', () => {
    // Initially anthropic / claude is selected for REASONING
    const decision1 = policyEngine.route({
      policy: UserFacingModelPolicy.REASONING
    });
    expect(decision1.selected.provider).toBe('anthropic');

    // Simulate rate-limiting on Anthropic Claude
    registry.getHealthChecker().recordError('anthropic', 'claude-3-5-sonnet', 'rate-limited', 'Rate limit 429');

    // Subsequent route should automatically bypass rate-limited provider and choose GPT-4o
    const decision2 = policyEngine.route({
      policy: UserFacingModelPolicy.REASONING
    });
    expect(decision2.selected.provider).toBe('openai');
    expect(decision2.selected.model).toBe('gpt-4o');

    // Health checker reports rate-limited
    expect(registry.getHealthChecker().getHealthState('anthropic', 'claude-3-5-sonnet')).toBe('rate-limited');
  });

  it('Phase 10 Exit Gate: handles user explicit model selection (§2074)', () => {
    const explicitDecision = policyEngine.route({
      policy: UserFacingModelPolicy.AUTO,
      explicitModel: { provider: 'google', model: 'gemini-1.5-flash' }
    });

    expect(explicitDecision.selected.provider).toBe('google');
    expect(explicitDecision.selected.model).toBe('gemini-1.5-flash');
    expect(explicitDecision.matchScore).toBe(1.0);
  });
});
