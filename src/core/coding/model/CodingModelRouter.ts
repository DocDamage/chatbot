import { LLMAdapter } from '../../providers/LLMAdapter';
import { PrivacyRoutingMode, DegradationState } from '../../providers/local/LocalModelRoutingPolicy';

export interface CodingModelCapability {
  provider: string;
  model: string;
  contextTokens: number;
  structuredOutput: boolean;
  toolCalling: boolean;
  codeQuality: number;
  latencyMs: number;
  costPer1kTokens: number;
  local: boolean;
  healthy?: boolean;
}

export interface CodingModelSelection {
  capability: CodingModelCapability;
  adapter?: LLMAdapter;
  reason: string;
  supported: boolean;
  degradationState?: DegradationState;
  fallbackReason?: string;
  isLocal?: boolean;
}

export interface CodingModelSelectOptions {
  prompt: string;
  maxCost?: number;
  requiresStructuredOutput?: boolean;
  minContextTokens?: number;
  privacyMode?: PrivacyRoutingMode;
  maxLatencyMs?: number;
}

export class CodingModelRouter {
  private readonly capabilities: CodingModelCapability[] = [];
  private readonly adapters = new Map<string, LLMAdapter>();

  register(capability: CodingModelCapability, adapter?: LLMAdapter): void {
    const existingIndex = this.capabilities.findIndex(
      c => c.provider === capability.provider && c.model === capability.model
    );
    if (existingIndex >= 0) {
      this.capabilities[existingIndex] = capability;
    } else {
      this.capabilities.push(capability);
    }
    if (adapter) {
      this.adapters.set(`${capability.provider}:${capability.model}`, adapter);
    }
  }

  select(options: CodingModelSelectOptions): CodingModelSelection {
    const needed = Math.ceil(options.prompt.length / 4) + 1000;
    const privacyMode = options.privacyMode || 'prefer_local';

    let eligible = this.capabilities.filter(capability => {
      const satisfiesContext = capability.contextTokens >= Math.max(needed, options.minContextTokens || 0);
      const satisfiesStructured = !options.requiresStructuredOutput || capability.structuredOutput;
      const satisfiesCost = !options.maxCost || (capability.costPer1kTokens * needed) / 1000 <= options.maxCost;
      const satisfiesLatency = !options.maxLatencyMs || capability.latencyMs <= options.maxLatencyMs;
      const isHealthy = capability.healthy !== false;
      return satisfiesContext && satisfiesStructured && satisfiesCost && satisfiesLatency && isHealthy;
    });

    if (privacyMode === 'local_disabled') {
      eligible = eligible.filter(c => !c.local);
    }

    // Handle strict_local mode
    if (privacyMode === 'strict_local') {
      const localCandidates = eligible.filter(c => c.local).sort((a, b) => b.codeQuality - a.codeQuality || a.costPer1kTokens - b.costPer1kTokens);
      if (localCandidates.length > 0) {
        const selected = localCandidates[0];
        const key = `${selected.provider}:${selected.model}`;
        return {
          capability: selected,
          adapter: this.adapters.get(key),
          reason: `Selected local ${key} for strict local privacy mode (quality ${selected.codeQuality.toFixed(2)})`,
          supported: this.adapters.has(key),
          degradationState: 'none',
          isLocal: true
        };
      }
      return {
        capability: {
          provider: 'none',
          model: 'none',
          contextTokens: 0,
          structuredOutput: false,
          toolCalling: false,
          codeQuality: 0,
          latencyMs: 0,
          costPer1kTokens: 0,
          local: true
        },
        reason: 'Strict local mode required but no local coding model satisfies constraints',
        supported: false,
        degradationState: 'fallback_to_template',
        fallbackReason: 'No local model satisfies context, output, or cost requirements under strict_local privacy mode',
        isLocal: true
      };
    }

    // Prefer local mode
    if (privacyMode === 'prefer_local') {
      const localCandidates = eligible.filter(c => c.local).sort((a, b) => b.codeQuality - a.codeQuality || a.costPer1kTokens - b.costPer1kTokens);
      if (localCandidates.length > 0) {
        const selected = localCandidates[0];
        const key = `${selected.provider}:${selected.model}`;
        return {
          capability: selected,
          adapter: this.adapters.get(key),
          reason: `Selected preferred local ${key} (quality ${selected.codeQuality.toFixed(2)})`,
          supported: this.adapters.has(key),
          degradationState: 'none',
          isLocal: true
        };
      }
      // If local not available, fallback to cloud
      const cloudCandidates = eligible.filter(c => !c.local).sort((a, b) => b.codeQuality - a.codeQuality || a.costPer1kTokens - b.costPer1kTokens);
      if (cloudCandidates.length > 0) {
        const selected = cloudCandidates[0];
        const key = `${selected.provider}:${selected.model}`;
        return {
          capability: selected,
          adapter: this.adapters.get(key),
          reason: `Local model unavailable; degraded to cloud ${key} (quality ${selected.codeQuality.toFixed(2)})`,
          supported: this.adapters.has(key),
          degradationState: 'fallback_to_cloud',
          fallbackReason: 'Local coding model not available or does not meet criteria; falling back to cloud',
          isLocal: false
        };
      }
    }

    // General sorting across all eligible candidates
    const sorted = eligible.sort((a, b) => b.codeQuality - a.codeQuality || a.costPer1kTokens - b.costPer1kTokens);
    const candidate = sorted[0];

    if (!candidate) {
      return {
        capability: {
          provider: 'none',
          model: 'none',
          contextTokens: 0,
          structuredOutput: false,
          toolCalling: false,
          codeQuality: 0,
          latencyMs: 0,
          costPer1kTokens: 0,
          local: false
        },
        reason: 'No configured coding model satisfies the context, output, and cost requirements',
        supported: false,
        degradationState: 'fallback_to_template',
        fallbackReason: 'No configured coding model satisfies requirements'
      };
    }

    const key = `${candidate.provider}:${candidate.model}`;
    return {
      capability: candidate,
      adapter: this.adapters.get(key),
      reason: `Selected ${key} for coding quality ${candidate.codeQuality.toFixed(2)}`,
      supported: this.adapters.has(key),
      degradationState: 'none',
      isLocal: candidate.local
    };
  }
}
