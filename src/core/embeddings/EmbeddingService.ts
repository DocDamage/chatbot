/**
 * Embedding Service - Generate embeddings for text
 * Supports multiple providers: OpenAI, Xenova Transformers (local), Ollama
 */

import OpenAI from 'openai';
import { pipeline, Pipeline } from '@xenova/transformers';
import { logger } from '../observability/logger';

export interface EmbeddingOptions {
  provider?: 'openai' | 'xenova' | 'ollama';
  model?: string;
}

export class EmbeddingService {
  private openaiClient?: OpenAI;
  private xenovaPipeline?: Pipeline;
  private ollamaUrl?: string;
  private defaultProvider: 'openai' | 'xenova' | 'ollama';
  private defaultModel: string;

  constructor(
    openaiApiKey?: string,
    ollamaUrl?: string,
    defaultProvider: 'openai' | 'xenova' | 'ollama' = 'xenova',
    defaultModel: string = 'Xenova/all-MiniLM-L6-v2'
  ) {
    this.defaultProvider = defaultProvider;
    this.defaultModel = defaultModel;
    this.ollamaUrl = ollamaUrl || 'http://localhost:11434';

    if (openaiApiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
    }

    // Initialize Xenova pipeline (local, free)
    this.initializeXenova();
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const provider = options?.provider || this.defaultProvider;
    const model = options?.model || this.defaultModel;

    try {
      switch (provider) {
        case 'openai':
          return await this.embedOpenAI(text, model);
        case 'xenova':
          return await this.embedXenova(text, model);
        case 'ollama':
          return await this.embedOllama(text, model);
        default:
          return await this.embedXenova(text, model);
      }
    } catch (error: any) {
      logger.error('Embedding generation failed', { provider, error: error.message });
      // Fallback to Xenova
      if (provider !== 'xenova') {
        return await this.embedXenova(text, model);
      }
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    return Promise.all(texts.map(text => this.embed(text, options)));
  }

  /**
   * OpenAI embeddings
   */
  private async embedOpenAI(text: string, model: string): Promise<number[]> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized. Provide OPENAI_API_KEY.');
    }

    const response = await this.openaiClient.embeddings.create({
      model: model || 'text-embedding-3-small',
      input: text
    });

    return response.data[0].embedding;
  }

  /**
   * Xenova Transformers (local, free)
   */
  private async embedXenova(text: string, model: string): Promise<number[]> {
    if (!this.xenovaPipeline) {
      await this.initializeXenova();
    }

    if (!this.xenovaPipeline) {
      throw new Error('Xenova pipeline not initialized');
    }

    const result = await this.xenovaPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  }

  /**
   * Initialize Xenova pipeline
   */
  private async initializeXenova(): Promise<void> {
    try {
      if (!this.xenovaPipeline) {
        this.xenovaPipeline = await pipeline(
          'feature-extraction',
          this.defaultModel,
          { quantized: true } // Use quantized model for faster loading
        );
        logger.info('Xenova embedding pipeline initialized', { model: this.defaultModel });
      }
    } catch (error: any) {
      logger.warn('Failed to initialize Xenova pipeline', { error: error.message });
      // Will fallback to other providers
    }
  }

  /**
   * Ollama embeddings
   */
  private async embedOllama(text: string, model: string): Promise<number[]> {
    const axios = require('axios');
    const response = await axios.post(`${this.ollamaUrl}/api/embeddings`, {
      model: model || 'llama2',
      prompt: text
    });

    return response.data.embedding;
  }

  /**
   * Get embedding dimensions
   */
  getDimensions(provider?: 'openai' | 'xenova' | 'ollama'): number {
    const p = provider || this.defaultProvider;
    switch (p) {
      case 'openai':
        return 1536; // text-embedding-3-small
      case 'xenova':
        return 384; // all-MiniLM-L6-v2
      case 'ollama':
        return 4096; // llama2 (varies by model)
      default:
        return 384;
    }
  }

  /**
   * Get available free embedding models
   */
  static getFreeModels(): Array<{ provider: string; model: string; dimensions: number; description: string }> {
    return [
      {
        provider: 'xenova',
        model: 'Xenova/all-MiniLM-L6-v2',
        dimensions: 384,
        description: 'Fast, efficient, local embeddings (default)'
      },
      {
        provider: 'xenova',
        model: 'Xenova/multilingual-e5-base',
        dimensions: 768,
        description: 'Multilingual embeddings'
      },
      {
        provider: 'xenova',
        model: 'Xenova/bge-small-en-v1.5',
        dimensions: 384,
        description: 'BGE small English embeddings'
      },
      {
        provider: 'ollama',
        model: 'llama2',
        dimensions: 4096,
        description: 'Ollama Llama 2 embeddings (requires Ollama)'
      },
      {
        provider: 'ollama',
        model: 'nomic-embed-text',
        dimensions: 768,
        description: 'Ollama Nomic embeddings (specialized for embeddings)'
      }
    ];
  }
}

