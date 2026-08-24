/**
 * Local Model Routing Policy & Telemetry Engine
 * Deterministically routes requests considering privacy constraints,
 * capability matching, resource budgets, quality, latency, and cost.
 */

import { LLMAdapter } from '../LLMAdapter';
import { logger } from '../../observability/logger';

export type PrivacyRoutingMode =
  | 'strict_local'
  | 'prefer_local'
  | 'cloud_allowed'
  | 'local_disabled';

export type DegradationState =
  | 'none'
  | 'context_truncated'
  | 'fallback_to_cloud'
  | 'fallback_to_template'
  | 'overloaded_queued'
  | 'overloaded_rejected';

export interface RoutingCandidate {
  provider: string;
  model: string;
  isLocal: boolean;
  contextTokens: number;
  qualityScore: number; // 0-1
  latencyMs: number;
  costPer1kTokens: number;
  structuredOutput: boolean;
  toolCalling: boolean;
  vision: boolean;
  embeddings?: boolean;
  healthy: boolean;
  available: boolean;
  adapter?: LLMAdapter;
}

export interface RoutingRequest {
  prompt: string;
  systemPrompt?: string;
  taskType?: string;
  privacyMode?: PrivacyRoutingMode;
  minContextTokens?: number;
  requiresStructuredOutput?: boolean;
  requiresTools?: boolean;
  requiresVision?: boolean;
  requiresEmbeddings?: boolean;
  maxLatencyMs?: number;
  maxCost?: number;
}

export interface LocalRoutingDecision {
  selected: RoutingCandidate;
  providerId: string;
  selectedModel: string;
  isLocal: boolean;
  degradationState: DegradationState;
  fallbackReason?: string;
  confidence: number;
  reasoning: string;
  supported: boolean;
}

export class LocalModelRoutingPolicy {
  private candidates: RoutingCandidate[] = [];
  private defaultPrivacyMode: PrivacyRoutingMode;

  constructor(options: { defaultPrivacyMode?: PrivacyRoutingMode } = {}) {
    this.defaultPrivacyMode = options.defaultPrivacyMode || 'prefer_local';
  }

  registerCandidate(candidate: RoutingCandidate): void {
    const existingIdx = this.candidates.findIndex(
      c => c.provider === candidate.provider && c.model === candidate.model
    );
    if (existingIdx !== -1) {
      this.candidates[existingIdx] = candidate;
    } else {
      this.candidates.push(candidate);
    }
  }

  unregisterProvider(provider: string): void {
    this.candidates = this.candidates.filter(c => c.provider !== provider);
  }

  listCandidates(): RoutingCandidate[] {
    return [...this.candidates];
  }

  /**
   * Deterministically select the best model candidate for the request.
   */
  route(request: RoutingRequest): LocalRoutingDecision {
    const privacyMode = request.privacyMode || this.defaultPrivacyMode;
    const promptTokens = Math.ceil((request.prompt.length + (request.systemPrompt?.length || 0)) / 4) + 1000;
    const requiredContext = Math.max(promptTokens, request.minContextTokens || 0);

    let candidates = [...this.candidates];

    // Filter out local models if local is disabled (e.g. hosted mode)
    if (privacyMode === 'local_disabled') {
      candidates = candidates.filter(c => !c.isLocal);
    }

    // Filter candidates satisfying hard capability constraints
    const satisfiesCapabilities = (c: RoutingCandidate) => {
      if (c.contextTokens < requiredContext) return false;
      if (request.requiresStructuredOutput && !c.structuredOutput) return false;
      if (request.requiresTools && !c.toolCalling) return false;
      if (request.requiresVision && !c.vision) return false;
      if (request.requiresEmbeddings && !c.embeddings) return false;
      if (request.maxLatencyMs && c.latencyMs > request.maxLatencyMs) return false;
      if (request.maxCost !== undefined && (c.costPer1kTokens * requiredContext) / 1000 > request.maxCost) return false;
      return true;
    };

    // Strict local mode: must be local and healthy
    if (privacyMode === 'strict_local') {
      const localCandidates = candidates.filter(c => c.isLocal && c.healthy && c.available && satisfiesCapabilities(c));
      if (localCandidates.length > 0) {
        const sorted = this.sortCandidates(localCandidates);
        const best = sorted[0];
        return {
          selected: best,
          providerId: best.provider,
          selectedModel: best.model,
          isLocal: true,
          degradationState: 'none',
          confidence: 0.95,
          reasoning: `Selected local model ${best.provider}:${best.model} strictly adhering to local-only privacy mode (quality: ${best.qualityScore.toFixed(2)})`,
          supported: Boolean(best.adapter)
        };
      }

      // If no local model meets criteria under strict_local, fallback to template with degradation reason
      const fallbackTemplate: RoutingCandidate = {
        provider: 'template',
        model: 'template',
        isLocal: true,
        contextTokens: 4096,
        qualityScore: 0.1,
        latencyMs: 5,
        costPer1kTokens: 0,
        structuredOutput: false,
        toolCalling: false,
        vision: false,
        embeddings: false,
        healthy: true,
        available: true
      };

      const reason = 'Strict local mode required but no local model satisfied capability or availability criteria';
      logger.warn('Strict local routing failed', { reason });

      return {
        selected: fallbackTemplate,
        providerId: 'template',
        selectedModel: 'template',
        isLocal: true,
        degradationState: 'fallback_to_template',
        fallbackReason: reason,
        confidence: 0.3,
        reasoning: reason,
        supported: true
      };
    }

    // Prefer local mode: check local candidates first
    if (privacyMode === 'prefer_local') {
      const localCandidates = candidates.filter(c => c.isLocal && c.healthy && c.available && satisfiesCapabilities(c));
      if (localCandidates.length > 0) {
        const sorted = this.sortCandidates(localCandidates);
        const best = sorted[0];
        return {
          selected: best,
          providerId: best.provider,
          selectedModel: best.model,
          isLocal: true,
          degradationState: 'none',
          confidence: 0.90,
          reasoning: `Selected preferred local model ${best.provider}:${best.model} (quality: ${best.qualityScore.toFixed(2)})`,
          supported: Boolean(best.adapter)
        };
      }

      // If local not available, check cloud candidates
      const cloudCandidates = candidates.filter(c => !c.isLocal && c.healthy && c.available && satisfiesCapabilities(c));
      if (cloudCandidates.length > 0) {
        const sorted = this.sortCandidates(cloudCandidates);
        const best = sorted[0];
        const reason = 'Local model unavailable or overloaded; degraded to cloud model';
        logger.info('Degrading from local to cloud model', { provider: best.provider, model: best.model });
        return {
          selected: best,
          providerId: best.provider,
          selectedModel: best.model,
          isLocal: false,
          degradationState: 'fallback_to_cloud',
          fallbackReason: reason,
          confidence: 0.85,
          reasoning: `${reason} (${best.provider}:${best.model})`,
          supported: Boolean(best.adapter)
        };
      }
    }

    // Cloud allowed or general mode: sort all eligible candidates
    const eligible = candidates.filter(c => c.healthy && c.available && satisfiesCapabilities(c));
    if (eligible.length > 0) {
      const sorted = this.sortCandidates(eligible);
      const best = sorted[0];
      return {
        selected: best,
        providerId: best.provider,
        selectedModel: best.model,
        isLocal: best.isLocal,
        degradationState: 'none',
        confidence: 0.88,
        reasoning: `Selected ${best.provider}:${best.model} (quality: ${best.qualityScore.toFixed(2)})`,
        supported: Boolean(best.adapter)
      };
    }

    // Fallback template
    const template: RoutingCandidate = {
      provider: 'template',
      model: 'template',
      isLocal: true,
      contextTokens: 4096,
      qualityScore: 0.1,
      latencyMs: 5,
      costPer1kTokens: 0,
      structuredOutput: false,
      toolCalling: false,
      vision: false,
      embeddings: false,
      healthy: true,
      available: true
    };

    return {
      selected: template,
      providerId: 'template',
      selectedModel: 'template',
      isLocal: true,
      degradationState: 'fallback_to_template',
      fallbackReason: 'No configured provider satisfied capability, context, or cost constraints',
      confidence: 0.3,
      reasoning: 'Fallback to template',
      supported: true
    };
  }

  /**
   * Deterministic candidate sorting:
   * 1. Higher quality score (descending)
   * 2. Lower latency (ascending)
   * 3. Lower cost (ascending)
   * 4. Alphabetical tie-break on provider:model
   */
  private sortCandidates(candidates: RoutingCandidate[]): RoutingCandidate[] {
    return [...candidates].sort((a, b) => {
      const qualityDiff = b.qualityScore - a.qualityScore;
      if (Math.abs(qualityDiff) > 0.05) {
        return qualityDiff;
      }
      const latencyDiff = a.latencyMs - b.latencyMs;
      if (Math.abs(latencyDiff) > 50) {
        return latencyDiff;
      }
      const costDiff = a.costPer1kTokens - b.costPer1kTokens;
      if (Math.abs(costDiff) > 0.0001) {
        return costDiff;
      }
      return `${a.provider}:${a.model}`.localeCompare(`${b.provider}:${b.model}`);
    });
  }
}
