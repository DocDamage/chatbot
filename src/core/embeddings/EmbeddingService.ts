/**
 * Embedding Service - Generate embeddings for text
 * Supports multiple providers: OpenAI, local Transformers.js, Ollama
 */

import OpenAI from 'openai';
import { logger } from '../observability/logger';

export interface EmbeddingOptions {
  provider?: 'openai' | 'xenova' | 'ollama';
  model?: string;
}

export class EmbeddingService {
  private openaiClient?: OpenAI;
  private localPipeline?: any;
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

    // Initialize local Transformers.js pipeline (free, local)
    this.initializeLocalTransformers();
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
          return await this.embedLocal(text, model);
        case 'ollama':
          return await this.embedOllama(text, model);
        default:
          return await this.embedLocal(text, model);
      }
    } catch (error: any) {
      logger.error('Embedding generation failed', { provider, error: error.message });
      // Fallback to local embeddings
      if (provider !== 'xenova') {
        return await this.embedLocal(text, model);
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
   * Local Transformers.js embeddings.
   * The provider name remains "xenova" for existing config compatibility.
   */
  private async embedLocal(text: string, model: string): Promise<number[]> {
    if (!this.localPipeline) {
      await this.initializeLocalTransformers();
    }

    if (!this.localPipeline) {
      if (process.env.EMBEDDING_USE_TRANSFORMERS === 'true') {
        logger.warn('Local embedding pipeline not initialized, using deterministic fallback embeddings');
      }
      return this.fallbackEmbedding(text);
    }

    try {
      const result = await this.localPipeline(text, { pooling: 'mean', normalize: true });
      return Array.from(result.data);
    } catch (error: any) {
      logger.warn('Local embedding pipeline failed, using deterministic fallback embeddings', {
        error: error.message
      });
      this.localPipeline = undefined;
      return this.fallbackEmbedding(text);
    }
  }

  /**
   * Initialize local Transformers.js pipeline
   */
  private async initializeLocalTransformers(): Promise<void> {
    if (process.env.EMBEDDING_USE_TRANSFORMERS !== 'true') {
      return;
    }

    try {
      if (!this.localPipeline) {
        const { pipeline } = await import('@huggingface/transformers');
        this.localPipeline = await pipeline(
          'feature-extraction',
          this.defaultModel
        );
        logger.info('Local embedding pipeline initialized', { model: this.defaultModel });
      }
    } catch (error: any) {
      logger.warn('Failed to initialize local embedding pipeline', { error: error.message });
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

  private fallbackEmbedding(text: string, dimensions: number = 384): number[] {
    const vector = new Array(dimensions).fill(0);
    const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);

    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
      }
      const index = Math.abs(hash) % dimensions;
      vector[index] += 1;
    }

    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    return norm > 0 ? vector.map((value) => value / norm) : vector;
  }

  async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
    return this.embed(text, options);
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

