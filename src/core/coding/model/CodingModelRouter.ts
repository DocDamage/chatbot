import { LLMAdapter, LLMGenerateOptions } from '../../providers/LLMAdapter';

export interface CodingModelCapability { provider: string; model: string; contextTokens: number; structuredOutput: boolean; toolCalling: boolean; codeQuality: number; latencyMs: number; costPer1kTokens: number; local: boolean; }
export interface CodingModelSelection { capability: CodingModelCapability; adapter?: LLMAdapter; reason: string; supported: boolean; }

export class CodingModelRouter {
  private readonly capabilities: CodingModelCapability[] = [];
  private readonly adapters = new Map<string, LLMAdapter>();
  register(capability: CodingModelCapability, adapter?: LLMAdapter): void { this.capabilities.push(capability); if (adapter) this.adapters.set(`${capability.provider}:${capability.model}`, adapter); }

  select(options: { prompt: string; maxCost?: number; requiresStructuredOutput?: boolean; minContextTokens?: number }): CodingModelSelection {
    const needed = Math.ceil(options.prompt.length / 4) + 1000;
    const candidate = this.capabilities.filter(capability => capability.contextTokens >= Math.max(needed, options.minContextTokens || 0) && (!options.requiresStructuredOutput || capability.structuredOutput) && (!options.maxCost || capability.costPer1kTokens * needed / 1000 <= options.maxCost)).sort((a, b) => b.codeQuality - a.codeQuality || a.costPer1kTokens - b.costPer1kTokens)[0];
    if (!candidate) return { capability: { provider: 'none', model: 'none', contextTokens: 0, structuredOutput: false, toolCalling: false, codeQuality: 0, latencyMs: 0, costPer1kTokens: 0, local: false }, reason: 'No configured coding model satisfies the context, output, and cost requirements', supported: false };
    return { capability: candidate, adapter: this.adapters.get(`${candidate.provider}:${candidate.model}`), reason: `Selected ${candidate.provider}:${candidate.model} for coding quality ${candidate.codeQuality.toFixed(2)}`, supported: this.adapters.has(`${candidate.provider}:${candidate.model}`) };
  }
}
