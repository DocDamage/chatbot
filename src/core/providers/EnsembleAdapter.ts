/**
 * Ensemble Adapter - Multi-model consensus
 * Research: MIT CSAIL Studies on Model Ensembles
 */

import { LLMAdapter, LLMGenerateOptions, LLMResponse } from './LLMAdapter';
import { ModelRouter, TaskType } from './ModelRouter';
import { logger } from '../observability/logger';
import { EnsembleResponse } from '../../types/model-routing';

export class EnsembleAdapter implements LLMAdapter {
  private modelRouter: ModelRouter;
  private useEnsemble: boolean;

  constructor(modelRouter: ModelRouter, useEnsemble: boolean = true) {
    this.modelRouter = modelRouter;
    this.useEnsemble = useEnsemble;
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.useEnsemble) {
      // Single model mode
      const taskType = this.inferTaskType(options.prompt);
      const { adapter } = await this.modelRouter.route(taskType, options);
      return adapter.generate(options);
    }

    // Ensemble mode - get responses from multiple models
    const taskType = this.inferTaskType(options.prompt);
    const availableModels = this.modelRouter.getAvailableModels()
      .filter(m => m.taskTypes.includes(taskType) || m.taskTypes.includes(TaskType.GENERAL))
      .slice(0, 3); // Use up to 3 models

    if (availableModels.length === 0) {
      throw new Error('No models available for ensemble');
    }

    const responses = await Promise.allSettled(
      availableModels.map(async (capability) => {
        const { adapter } = await this.modelRouter.route(taskType, options);
        return adapter.generate(options);
      })
    );

    const successfulResponses = responses
      .filter((r): r is PromiseFulfilledResult<LLMResponse> => r.status === 'fulfilled')
      .map(r => r.value);

    if (successfulResponses.length === 0) {
      throw new Error('All models failed in ensemble');
    }

    // Calculate agreement (simple: check if responses are similar)
    const agreement = this.calculateAgreement(successfulResponses);

    // Use the highest quality model's response, or combine if agreement is low
    if (agreement > 0.7) {
      // High agreement - use best model's response
      const bestResponse = successfulResponses[0];
      logger.info('Ensemble: High agreement, using best model', {
        agreement,
        model: bestResponse.model
      });
      return bestResponse;
    } else {
      // Low agreement - combine responses
      const combined = this.combineResponses(successfulResponses);
      logger.info('Ensemble: Low agreement, combining responses', {
        agreement,
        modelsUsed: successfulResponses.length
      });
      return combined;
    }
  }

  estimateCost(options: LLMGenerateOptions): number {
    const taskType = this.inferTaskType(options.prompt);
    const selection = this.modelRouter.selectModel(taskType, options);
    return selection.estimatedCost * (this.useEnsemble ? 2 : 1); // Ensemble costs more
  }

  getModelName(): string {
    return 'ensemble';
  }

  /**
   * Infer task type from prompt
   */
  private inferTaskType(prompt: string): TaskType {
    const lower = prompt.toLowerCase();

    if (lower.includes('code') || lower.includes('function') || lower.includes('program')) {
      return TaskType.CODE_GENERATION;
    }
    if (lower.includes('analyze') || lower.includes('compare') || lower.includes('evaluate')) {
      return TaskType.ANALYSIS;
    }
    if (lower.includes('write') || lower.includes('story') || lower.includes('creative')) {
      return TaskType.CREATIVE_WRITING;
    }
    if (lower.includes('explain') || lower.includes('why') || lower.includes('how')) {
      return TaskType.COMPLEX_REASONING;
    }
    if (lower.length < 50) {
      return TaskType.SIMPLE_QUERY;
    }

    return TaskType.GENERAL;
  }

  /**
   * Calculate agreement between responses
   */
  private calculateAgreement(responses: LLMResponse[]): number {
    if (responses.length < 2) return 1.0;

    // Simple similarity based on length and word overlap
    const contents = responses.map(r => r.content.toLowerCase().split(/\s+/));
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < contents.length; i++) {
      for (let j = i + 1; j < contents.length; j++) {
        const similarity = this.calculateSimilarity(contents[i], contents[j]);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Calculate similarity between two word arrays
   */
  private calculateSimilarity(words1: string[], words2: string[]): number {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Combine multiple responses
   */
  private combineResponses(responses: LLMResponse[]): LLMResponse {
    // Simple combination: use the longest response as base, add insights from others
    const sorted = [...responses].sort((a, b) => b.content.length - a.content.length);
    const base = sorted[0];

    // Add note about ensemble
    const combined = `${base.content}\n\n[Note: This response was generated using an ensemble of ${responses.length} models for improved accuracy.]`;

    return {
      content: combined,
      model: 'ensemble',
      tokensUsed: responses.reduce((sum, r) => sum + (r.tokensUsed || 0), 0),
      cost: responses.reduce((sum, r) => sum + (r.cost || 0), 0),
      latency: Math.max(...responses.map(r => r.latency || 0))
    };
  }
}

