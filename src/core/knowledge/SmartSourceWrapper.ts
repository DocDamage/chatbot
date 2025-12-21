/**
 * Smart Source Wrapper - Wraps existing sources with smart features
 */

import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { SmartKnowledgeSource, SmartSourceOptions } from './SmartKnowledgeSource';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { LLMAdapter } from '../providers/LLMAdapter';
import { logger } from '../observability/logger';

export class SmartSourceWrapper extends SmartKnowledgeSource {
  private wrappedSource: KnowledgeSource;

  constructor(source: KnowledgeSource, options: SmartSourceOptions = {}) {
    super(options);
    this.wrappedSource = source;
  }

  get name(): string {
    return `smart_${this.wrappedSource.name}`;
  }

  async searchBase(query: string, options?: any): Promise<KnowledgeResult[]> {
    return this.wrappedSource.search(query, options);
  }

  async isAvailable(): Promise<boolean> {
    return this.wrappedSource.isAvailable();
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    return this.wrappedSource.getById(id);
  }
}

/**
 * Create a smart wrapper for any knowledge source
 */
export function makeSmart(
  source: KnowledgeSource,
  embeddingService?: EmbeddingService,
  llmAdapter?: LLMAdapter,
  options?: Partial<SmartSourceOptions>
): SmartKnowledgeSource {
  return new SmartSourceWrapper(source, {
    embeddingService,
    llmAdapter,
    ...options,
  });
}

