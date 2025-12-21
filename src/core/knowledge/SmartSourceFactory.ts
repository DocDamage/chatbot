/**
 * Smart Source Factory - Creates enhanced versions of all knowledge sources
 */

import { KnowledgeSource } from './KnowledgeSource';
import { SmartSourceWrapper, makeSmart } from './SmartSourceWrapper';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { LLMAdapter } from '../providers/LLMAdapter';
import { logger } from '../observability/logger';

export class SmartSourceFactory {
  private embeddingService?: EmbeddingService;
  private llmAdapter?: LLMAdapter;

  constructor(embeddingService?: EmbeddingService, llmAdapter?: LLMAdapter) {
    this.embeddingService = embeddingService;
    this.llmAdapter = llmAdapter;
  }

  /**
   * Create a smart wrapper for any source
   */
  createSmartSource(source: KnowledgeSource): KnowledgeSource {
    return makeSmart(source, this.embeddingService, this.llmAdapter, {
      enableQueryExpansion: true,
      enableSemanticRanking: true,
      enableCaching: true,
      maxResults: 10,
      minConfidence: 0.5,
    });
  }

  /**
   * Enhance all sources in a collection
   */
  enhanceAllSources(sources: KnowledgeSource[]): KnowledgeSource[] {
    return sources.map(source => this.createSmartSource(source));
  }
}

