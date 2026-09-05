import {
  RegisteredModel,
  ModelStatus
} from '../../types/model-registry';
import { ModelHealthChecker } from './ModelHealthChecker';

export const PRODUCTION_SEED_MODELS: RegisteredModel[] = [
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    enabled: true,
    verifiedAt: '2026-09-01T00:00:00.000Z',
    capabilities: {
      chat: true,
      streaming: true,
      tools: true,
      structuredOutput: true,
      vision: true,
      embeddings: false,
      reasoningClass: 'advanced',
      codingClass: 'advanced'
    },
    contextWindow: 200000,
    maxOutputTokens: 8192,
    cost: { inputPerMillion: 3.0, outputPerMillion: 15.0, source: 'config' },
    privacy: 'remote',
    status: 'available'
  },
  {
    provider: 'openai',
    model: 'gpt-4o',
    enabled: true,
    verifiedAt: '2026-09-01T00:00:00.000Z',
    capabilities: {
      chat: true,
      streaming: true,
      tools: true,
      structuredOutput: true,
      vision: true,
      embeddings: false,
      reasoningClass: 'advanced',
      codingClass: 'advanced'
    },
    contextWindow: 128000,
    maxOutputTokens: 4096,
    cost: { inputPerMillion: 2.5, outputPerMillion: 10.0, source: 'config' },
    privacy: 'remote',
    status: 'available'
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    enabled: true,
    verifiedAt: '2026-09-01T00:00:00.000Z',
    capabilities: {
      chat: true,
      streaming: true,
      tools: true,
      structuredOutput: true,
      vision: true,
      embeddings: false,
      reasoningClass: 'balanced',
      codingClass: 'balanced'
    },
    contextWindow: 128000,
    maxOutputTokens: 4096,
    cost: { inputPerMillion: 0.15, outputPerMillion: 0.60, source: 'config' },
    privacy: 'remote',
    status: 'available'
  },
  {
    provider: 'google',
    model: 'gemini-1.5-flash',
    enabled: true,
    verifiedAt: '2026-09-01T00:00:00.000Z',
    capabilities: {
      chat: true,
      streaming: true,
      tools: true,
      structuredOutput: true,
      vision: true,
      embeddings: false,
      reasoningClass: 'balanced',
      codingClass: 'basic'
    },
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    cost: { inputPerMillion: 0.075, outputPerMillion: 0.30, source: 'config' },
    privacy: 'remote',
    status: 'available'
  },
  {
    provider: 'local',
    model: 'llama-3.2-3b',
    enabled: true,
    verifiedAt: '2026-09-01T00:00:00.000Z',
    capabilities: {
      chat: true,
      streaming: true,
      tools: false,
      structuredOutput: false,
      vision: false,
      embeddings: false,
      reasoningClass: 'basic',
      codingClass: 'basic'
    },
    contextWindow: 8192,
    maxOutputTokens: 2048,
    privacy: 'local',
    status: 'available'
  },
  {
    provider: 'local',
    model: 'deepseek-coder-6.7b',
    enabled: true,
    verifiedAt: '2026-09-01T00:00:00.000Z',
    capabilities: {
      chat: true,
      streaming: true,
      tools: true,
      structuredOutput: true,
      vision: false,
      embeddings: false,
      reasoningClass: 'balanced',
      codingClass: 'advanced'
    },
    contextWindow: 16384,
    maxOutputTokens: 4096,
    privacy: 'local',
    status: 'available'
  }
];

export class ModelRegistry {
  private models = new Map<string, RegisteredModel>();
  private healthChecker: ModelHealthChecker;

  constructor(customSeed?: RegisteredModel[], healthChecker?: ModelHealthChecker) {
    this.healthChecker = healthChecker ?? new ModelHealthChecker();
    const seed = customSeed ?? PRODUCTION_SEED_MODELS;
    for (const m of seed) {
      this.registerModel(m);
    }
  }

  private getKey(provider: string, model: string): string {
    return `${provider.toLowerCase()}::${model.toLowerCase()}`;
  }

  public registerModel(m: RegisteredModel): void {
    this.models.set(this.getKey(m.provider, m.model), { ...m });
  }

  public getModel(provider: string, model: string): RegisteredModel | undefined {
    return this.models.get(this.getKey(provider, model));
  }

  public updateStatus(provider: string, model: string, status: ModelStatus): void {
    const existing = this.getModel(provider, model);
    if (existing) {
      existing.status = status;
      this.registerModel(existing);
    }
  }

  public getAllModels(): RegisteredModel[] {
    return Array.from(this.models.values());
  }

  public getAvailableModels(): RegisteredModel[] {
    return this.getAllModels().filter(m => {
      if (!m.enabled || m.status !== 'available') return false;
      return this.healthChecker.isAvailable(m.provider, m.model);
    });
  }

  public getHealthChecker(): ModelHealthChecker {
    return this.healthChecker;
  }
}
