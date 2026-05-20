/**
 * Model Router - Intelligent model selection based on task type
 * Research: Stanford HAI Index 2025, MIT CSAIL Studies
 */

import { ModelProvider, TaskType, ModelCapability, ModelSelection } from '../../types/model-routing';
import { LLMAdapter, LLMGenerateOptions } from './LLMAdapter';
import { HuggingFaceAdapter } from './HuggingFaceAdapter';
import { logger } from '../observability/logger';

export { ModelProvider, TaskType };

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
   * Includes both paid and free alternatives
   */
  private initializeCapabilities(): void {
    // ===== PAID MODELS =====
    
    // GPT-4 - Best for complex reasoning (PAID)
    this.capabilities.set('gpt-4', {
      provider: ModelProvider.OPENAI,
      model: 'gpt-4',
      taskTypes: [
        TaskType.COMPLEX_REASONING,
        TaskType.ANALYSIS,
        TaskType.CODE_GENERATION,
        TaskType.MATH_SYMBOLIC,
        TaskType.MATH_PROOF,
        TaskType.MATH_NUMERIC,
        TaskType.MARKET_RESEARCH,
        TaskType.MARKET_RISK,
        TaskType.MARKET_BACKTEST,
        TaskType.GAME_DESIGN,
        TaskType.GAME_CODE,
        TaskType.GAME_BALANCE,
        TaskType.GAME_PROTOTYPE,
        TaskType.SIXSIGMA_QA,
        TaskType.SIXSIGMA_CALCULATION,
        TaskType.SIXSIGMA_PROJECT_COACHING,
        TaskType.SIXSIGMA_COMPLIANCE,
        TaskType.SIXSIGMA_CERTIFICATION,
        TaskType.SIXSIGMA_SIMULATION,
        TaskType.SIXSIGMA_EXPORT
      ],
      maxTokens: 8192,
      supportsStreaming: true,
      costPer1kTokens: 0.03,
      latencyMs: 2000,
      qualityScore: 0.95
    });

    // GPT-3.5-turbo - Good for simple queries, cost-effective (PAID)
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

    // Claude 3.5 Sonnet - Excellent for analysis and creative tasks (PAID)
    this.capabilities.set('claude-3-5-sonnet', {
      provider: ModelProvider.ANTHROPIC,
      model: 'claude-3-5-sonnet-20241022',
      taskTypes: [
        TaskType.ANALYSIS,
        TaskType.CREATIVE_WRITING,
        TaskType.COMPLEX_REASONING,
        TaskType.MATH_PROOF,
        TaskType.MARKET_RESEARCH,
        TaskType.MARKET_RISK,
        TaskType.GAME_DESIGN,
        TaskType.GAME_PROTOTYPE,
        TaskType.SIXSIGMA_QA,
        TaskType.SIXSIGMA_PROJECT_COACHING,
        TaskType.SIXSIGMA_COMPLIANCE,
        TaskType.SIXSIGMA_CERTIFICATION
      ],
      maxTokens: 8192,
      supportsStreaming: true,
      costPer1kTokens: 0.003,
      latencyMs: 1500,
      qualityScore: 0.92
    });

    // ===== FREE MODELS (Ollama) =====
    
    // Ollama Llama 2 - Free, local, good for general tasks
    this.capabilities.set('ollama-llama2', {
      provider: ModelProvider.OLLAMA,
      model: 'llama2',
      taskTypes: [TaskType.GENERAL, TaskType.SIMPLE_QUERY, TaskType.CREATIVE_WRITING],
      maxTokens: 4096,
      supportsStreaming: true,
      costPer1kTokens: 0,
      latencyMs: 3000,
      qualityScore: 0.70
    });

    // Ollama Mistral - Free, better quality than Llama 2
    this.capabilities.set('ollama-mistral', {
      provider: ModelProvider.OLLAMA,
      model: 'mistral',
      taskTypes: [TaskType.GENERAL, TaskType.ANALYSIS, TaskType.CREATIVE_WRITING],
      maxTokens: 8192,
      supportsStreaming: true,
      costPer1kTokens: 0,
      latencyMs: 2500,
      qualityScore: 0.75
    });

    // Ollama Llama 3 - Free, latest and best quality
    this.capabilities.set('ollama-llama3', {
      provider: ModelProvider.OLLAMA,
      model: 'llama3',
      taskTypes: [
        TaskType.GENERAL,
        TaskType.ANALYSIS,
        TaskType.CREATIVE_WRITING,
        TaskType.CODE_GENERATION,
        TaskType.MATH_NUMERIC,
        TaskType.GAME_CODE,
        TaskType.GAME_BALANCE,
        TaskType.GAME_DESIGN,
        TaskType.SIXSIGMA_QA,
        TaskType.SIXSIGMA_CALCULATION,
        TaskType.SIXSIGMA_SIMULATION,
        TaskType.SIXSIGMA_EXPORT
      ],
      maxTokens: 8192,
      supportsStreaming: true,
      costPer1kTokens: 0,
      latencyMs: 2500,
      qualityScore: 0.80
    });

    // Ollama CodeLlama - Free, specialized for code
    this.capabilities.set('ollama-codellama', {
      provider: ModelProvider.OLLAMA,
      model: 'codellama',
      taskTypes: [TaskType.CODE_GENERATION, TaskType.ANALYSIS],
      maxTokens: 4096,
      supportsStreaming: true,
      costPer1kTokens: 0,
      latencyMs: 3000,
      qualityScore: 0.75
    });

    // Ollama Phi-2 - Free, small but efficient
    this.capabilities.set('ollama-phi2', {
      provider: ModelProvider.OLLAMA,
      model: 'phi',
      taskTypes: [TaskType.SIMPLE_QUERY, TaskType.GENERAL],
      maxTokens: 2048,
      supportsStreaming: true,
      costPer1kTokens: 0,
      latencyMs: 2000,
      qualityScore: 0.65
    });

    // Ollama Gemma - Free, Google's open model
    this.capabilities.set('ollama-gemma', {
      provider: ModelProvider.OLLAMA,
      model: 'gemma',
      taskTypes: [TaskType.GENERAL, TaskType.SIMPLE_QUERY, TaskType.CREATIVE_WRITING],
      maxTokens: 4096,
      supportsStreaming: true,
      costPer1kTokens: 0,
      latencyMs: 2500,
      qualityScore: 0.72
    });

    // ===== FREE MODELS (Hugging Face) =====
    
    // Hugging Face Mistral - Free via Inference API
    this.capabilities.set('hf-mistral', {
      provider: ModelProvider.HUGGINGFACE,
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      taskTypes: [TaskType.GENERAL, TaskType.ANALYSIS, TaskType.CREATIVE_WRITING],
      maxTokens: 4096,
      supportsStreaming: false,
      costPer1kTokens: 0,
      latencyMs: 4000,
      qualityScore: 0.75
    });

    // Hugging Face Llama 2 - Free via Inference API
    this.capabilities.set('hf-llama2', {
      provider: ModelProvider.HUGGINGFACE,
      model: 'meta-llama/Llama-2-7b-chat-hf',
      taskTypes: [TaskType.GENERAL, TaskType.SIMPLE_QUERY, TaskType.CREATIVE_WRITING],
      maxTokens: 4096,
      supportsStreaming: false,
      costPer1kTokens: 0,
      latencyMs: 5000,
      qualityScore: 0.70
    });

    // Hugging Face Zephyr - Free via Inference API
    this.capabilities.set('hf-zephyr', {
      provider: ModelProvider.HUGGINGFACE,
      model: 'HuggingFaceH4/zephyr-7b-beta',
      taskTypes: [TaskType.GENERAL, TaskType.CREATIVE_WRITING],
      maxTokens: 4096,
      supportsStreaming: false,
      costPer1kTokens: 0,
      latencyMs: 4000,
      qualityScore: 0.73
    });

    // Template - Fallback (Free)
    this.capabilities.set('template', {
      provider: ModelProvider.TEMPLATE,
      model: 'template',
      taskTypes: [TaskType.GENERAL, TaskType.SIMPLE_QUERY],
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

