import {
  RegisteredModel,
  ModelRoutingRequirements,
  FallbackStep
} from '../../types/model-registry';

export class ModelFallbackPlanner {
  /**
   * Constructs an ordered fallback chain for the primary model (§2091-2112):
   * primary -> compatible same-policy alternate -> compatible alternate provider -> local model (when allowed)
   */
  public buildFallbackChain(
    primary: RegisteredModel,
    availableModels: RegisteredModel[],
    requirements: ModelRoutingRequirements
  ): RegisteredModel[] {
    const chain: RegisteredModel[] = [];
    const seen = new Set<string>([`${primary.provider}::${primary.model}`]);

    const isCompatible = (candidate: RegisteredModel): boolean => {
      // Must not violate tool requirement
      if (requirements.requiresTools && !candidate.capabilities.tools) {
        return false;
      }
      // Must not violate structured output requirement
      if (requirements.requiresStructuredOutput && !candidate.capabilities.structuredOutput) {
        return false;
      }
      // Must not violate vision requirement
      if (requirements.requiresVision && !candidate.capabilities.vision) {
        return false;
      }
      // Must not violate privacy requirement
      if (requirements.preferPrivacy === 'local' && candidate.privacy !== 'local') {
        return false;
      }
      return true;
    };

    // 1. Compatible same-provider alternate
    for (const m of availableModels) {
      const key = `${m.provider}::${m.model}`;
      if (!seen.has(key) && m.provider === primary.provider && isCompatible(m)) {
        seen.add(key);
        chain.push(m);
      }
    }

    // 2. Compatible alternate remote provider
    for (const m of availableModels) {
      const key = `${m.provider}::${m.model}`;
      if (!seen.has(key) && m.provider !== primary.provider && m.privacy === 'remote' && isCompatible(m)) {
        seen.add(key);
        chain.push(m);
      }
    }

    // 3. Compatible local model (when allowed / available)
    if (requirements.preferPrivacy !== 'remote') {
      for (const m of availableModels) {
        const key = `${m.provider}::${m.model}`;
        if (!seen.has(key) && m.privacy === 'local' && isCompatible(m)) {
          seen.add(key);
          chain.push(m);
        }
      }
    }

    return chain;
  }

  /**
   * Simulates a fallback transition, validating constraints and returning the fallback step log.
   */
  public recordTransition(
    current: RegisteredModel,
    next: RegisteredModel,
    reason: string
  ): FallbackStep {
    const preserved: string[] = [];
    if (next.capabilities.tools) preserved.push('tools');
    if (next.capabilities.structuredOutput) preserved.push('structuredOutput');
    if (next.capabilities.vision) preserved.push('vision');
    if (next.privacy === current.privacy) preserved.push(`privacy:${next.privacy}`);

    return {
      from: { provider: current.provider, model: current.model },
      to: { provider: next.provider, model: next.model },
      reason,
      preservedCapabilities: preserved
    };
  }
}
