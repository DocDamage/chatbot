import {
  RegisteredModel,
  ModelRoutingRequirements,
  ModelRoutingDecision,
  UserFacingModelPolicy
} from '../../types/model-registry';
import { ModelRegistry } from './ModelRegistry';
import { ModelFallbackPlanner } from './ModelFallbackPlanner';

export class ModelPolicyEngine {
  private registry: ModelRegistry;
  private fallbackPlanner: ModelFallbackPlanner;

  constructor(registry: ModelRegistry, fallbackPlanner?: ModelFallbackPlanner) {
    this.registry = registry;
    this.fallbackPlanner = fallbackPlanner ?? new ModelFallbackPlanner();
  }

  public route(requirements: ModelRoutingRequirements): ModelRoutingDecision {
    const available = this.registry.getAvailableModels();

    if (available.length === 0) {
      throw new Error('No models currently available in registry');
    }

    // Explicit model selection (§2074)
    if (requirements.explicitModel) {
      const target = available.find(
        m => m.provider === requirements.explicitModel?.provider &&
             m.model === requirements.explicitModel?.model
      );
      if (target) {
        const fallbacks = this.fallbackPlanner.buildFallbackChain(target, available, requirements);
        return {
          selected: target,
          policy: requirements.policy,
          fallbackChain: fallbacks,
          rationale: `User explicitly selected model ${target.provider}/${target.model}`,
          matchScore: 1.0
        };
      }
    }

    // Filter candidates strictly meeting hard capability & privacy constraints
    const candidates = available.filter(m => {
      if (requirements.policy === UserFacingModelPolicy.LOCAL || requirements.preferPrivacy === 'local') {
        if (m.privacy !== 'local') return false;
      }
      if (requirements.requiresTools && !m.capabilities.tools) return false;
      if (requirements.requiresStructuredOutput && !m.capabilities.structuredOutput) return false;
      if (requirements.requiresVision && !m.capabilities.vision) return false;
      if (requirements.costCeilingPerMillion && m.cost?.outputPerMillion) {
        if (m.cost.outputPerMillion > requirements.costCeilingPerMillion) return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      throw new Error(`No available model satisfies requirements for policy ${requirements.policy}`);
    }

    // Score candidates based on requested policy
    const scored = candidates.map(m => ({
      model: m,
      score: this.scoreForPolicy(m, requirements)
    }));

    scored.sort((a, b) => b.score - a.score);
    const primary = scored[0].model;
    const fallbacks = this.fallbackPlanner.buildFallbackChain(primary, available, requirements);

    return {
      selected: primary,
      policy: requirements.policy,
      fallbackChain: fallbacks,
      rationale: `Model ${primary.provider}/${primary.model} chosen for policy ${requirements.policy} (score: ${scored[0].score})`,
      matchScore: scored[0].score
    };
  }

  private scoreForPolicy(model: RegisteredModel, req: ModelRoutingRequirements): number {
    let score = 0.50;

    switch (req.policy) {
      case UserFacingModelPolicy.FAST:
        // Prefer lower cost and fast models
        if (model.cost?.inputPerMillion && model.cost.inputPerMillion < 0.5) score += 0.35;
        if (model.model.includes('flash') || model.model.includes('mini')) score += 0.25;
        break;

      case UserFacingModelPolicy.CODING:
        if (model.capabilities.codingClass === 'advanced') score += 0.35;
        else if (model.capabilities.codingClass === 'balanced') score += 0.15;
        if (model.capabilities.tools) score += 0.15;
        break;

      case UserFacingModelPolicy.REASONING:
        if (model.capabilities.reasoningClass === 'advanced') score += 0.40;
        else if (model.capabilities.reasoningClass === 'balanced') score += 0.20;
        break;

      case UserFacingModelPolicy.LOCAL:
        if (model.privacy === 'local') score += 0.45;
        if (model.capabilities.codingClass === 'advanced') score += 0.15;
        break;

      case UserFacingModelPolicy.BALANCED:
      case UserFacingModelPolicy.AUTO:
      default:
        if (model.capabilities.reasoningClass === 'advanced' || model.capabilities.reasoningClass === 'balanced') {
          score += 0.20;
        }
        if (model.cost?.outputPerMillion && model.cost.outputPerMillion <= 15.0) {
          score += 0.15;
        }
        break;
    }

    return Number(score.toFixed(2));
  }
}
