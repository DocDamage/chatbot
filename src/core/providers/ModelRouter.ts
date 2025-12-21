/**
 * Model Router - Intelligent model selection based on task type
 * Research: Stanford HAI Index 2025, MIT CSAIL Studies
 */

import { ModelProvider, TaskType, ModelCapability, ModelSelection } from '../../types/model-routing';
import { LLMAdapter, LLMGenerateOptions } from './LLMAdapter';
import { logger } from '../observability/logger';

export class ModelRouter {
  private capabilities: Map<string, ModelCapability> = new Map();
  private adapters: Map<ModelProvider, LLMAdapter> = new Map();

  constructor() {
    this.initializeCapabilities();
  }

  /**
   * Register an adapter for a provider
   */
  registerAdapter(provider: ModelProvider, adapter: LLMAdapter): void {
    this.adapters.set(provider, adapter);
    logger.info(`Registered adapter for ${provider}`);
  }

  /**
   * Select the best model for a given task
   */
  selectModel(
    taskType: TaskType,
    options: LLMGenerateOptions,
    costLimit?: number
  ): ModelSelection {
    const candidates = Array.from(this.capabilities.values())
      .filter(cap => cap.taskTypes.includes(taskType) || cap.taskTypes.includes(TaskType.GENERAL))
      .filter(cap => {
        // Check if adapter is available
        return this.adapters.has(cap.provider);
      })
      .filter(cap => {
        // Check cost limit
        if (costLimit) {
          const estimatedCost = this.estimateCost(cap, options);
          return estimatedCost <= costLimit;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by quality score (descending), then by cost (ascending)
        if (Math.abs(a.qualityScore - b.qualityScore) > 0.1) {
          return b.qualityScore - a.qualityScore;
        }
        return a.costPer1kTokens - b.costPer1kTokens;
      });

    if (candidates.length === 0) {
      // Fallback to template
      return {
        provider: ModelProvider.TEMPLATE,
        model: 'template',
        confidence: 0.5,
        reasoning: 'No suitable model found, using template fallback',
        estimatedCost: 0,
        estimatedLatency: 10
      };
    }

    const selected = candidates[0];
    const estimatedCost = this.estimateCost(selected, options);
    const estimatedLatency = selected.latencyMs;

    // Calculate confidence based on quality score and task match
    const confidence = selected.qualityScore * 0.8 + (selected.taskTypes.includes(taskType) ? 0.2 : 0.1);

    return {
      provider: selected.provider,
      model: selected.model,
      confidence,
      reasoning: `Selected ${selected.model} for ${taskType} (quality: ${selected.qualityScore.toFixed(2)}, cost: $${estimatedCost.toFixed(4)})`,
      estimatedCost,
      estimatedLatency
    };
  }

  /**
   * Route a request to the appropriate model
   */
  async route(
    taskType: TaskType,
    options: LLMGenerateOptions,
    costLimit?: number
  ) {
    const selection = this.selectModel(taskType, options, costLimit);
    const adapter = this.adapters.get(selection.provider);

    if (!adapter) {
      throw new Error(`No adapter found for provider: ${selection.provider}`);
    }

    logger.info('Model routing decision', {
      taskType,
      selectedModel: selection.model,
      confidence: selection.confidence,
      estimatedCost: selection.estimatedCost
    });

    return {
      adapter,
      selection
    };
  }

  /**
   * Estimate cost for a capability
   */
  private estimateCost(capability: ModelCapability, options: LLMGenerateOptions): number {
    const estimatedTokens = Math.ceil(
      (options.prompt.length + (options.systemPrompt?.length || 0)) / 4
    ) + (options.maxTokens || 1000);
    return (estimatedTokens / 1000) * capability.costPer1kTokens;
  }

  /**
   * Initialize model capabilities based on research
   */
  private initializeCapabilities(): void {
    // GPT-4 - Best for complex reasoning
    this.capabilities.set('gpt-4', {
      provider: ModelProvider.OPENAI,
      model: 'gpt-4',
      taskTypes: [TaskType.COMPLEX_REASONING, TaskType.ANALYSIS, TaskType.CODE_GENERATION],
      maxTokens: 8192,
      supportsStreaming: true,
      costPer1kTokens: 0.03,
      latencyMs: 2000,
      qualityScore: 0.95
    });

    // GPT-3.5-turbo - Good for simple queries, cost-effective
    this.capabilities.set('gpt-3.5-turbo', {
      provider: ModelProvider.OPENAI,
      model: 'gpt-3.5-turbo',
      taskTypes: [TaskType.SIMPLE_QUERY, TaskType.GENERAL, TaskType.CREATIVE_WRITING],
      maxTokens: 4096,
      supportsStreaming: true,
      costPer1kTokens: 0.002,
      latencyMs: 800,
      qualityScore: 0.80
    });

    // Claude 3.5 Sonnet - Excellent for analysis and creative tasks
    this.capabilities.set('claude-3-5-sonnet', {
      provider: ModelProvider.ANTHROPIC,
      model: 'claude-3-5-sonnet-20241022',
      taskTypes: [TaskType.ANALYSIS, TaskType.CREATIVE_WRITING, TaskType.COMPLEX_REASONING],
      maxTokens: 8192,
      supportsStreaming: true,
      costPer1kTokens: 0.003,
      latencyMs: 1500,
      qualityScore: 0.92
    });

    // Ollama - Free, local, good for general tasks
    this.capabilities.set('ollama-llama2', {
      provider: ModelProvider.OLLAMA,
      model: 'llama2',
      taskTypes: [TaskType.GENERAL, TaskType.SIMPLE_QUERY],
      maxTokens: 4096,
      supportsStreaming: true,
      costPer1kTokens: 0,
      latencyMs: 3000,
      qualityScore: 0.70
    });

    // Template - Fallback
    this.capabilities.set('template', {
      provider: ModelProvider.TEMPLATE,
      model: 'template',
      taskTypes: [TaskType.GENERAL],
      maxTokens: 1000,
      supportsStreaming: false,
      costPer1kTokens: 0,
      latencyMs: 10,
      qualityScore: 0.30
    });
  }

  /**
   * Get all available models
   */
  getAvailableModels(): ModelCapability[] {
    return Array.from(this.capabilities.values())
      .filter(cap => this.adapters.has(cap.provider));
  }
}

