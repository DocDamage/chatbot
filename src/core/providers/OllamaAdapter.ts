/**
 * Ollama Adapter - Free, local LLM using Ollama API
 * Runs models locally on the user's machine
 */

import axios, { AxiosInstance } from 'axios';
import { LLMAdapter, LLMGenerateOptions, LLMResponse } from './LLMAdapter';
import { logger } from '../observability/logger';

export class OllamaAdapter implements LLMAdapter {
  private client: AxiosInstance;
  private baseUrl: string;
  private model: string;
  private defaultModel = 'llama2'; // Default free model

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'llama2') {
    this.baseUrl = baseUrl;
    this.model = model;
    this.defaultModel = model;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 60000, // 60 second timeout for local models
    });
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = (options.model || this.model).replace(/^ollama:/, '');

    try {
      // Build the prompt with system prompt if provided
      let fullPrompt = options.prompt;
      if (options.systemPrompt) {
        fullPrompt = `${options.systemPrompt}\n\nUser: ${options.prompt}\nAssistant:`;
      }

      const body = {
        model,
        ...(options.jsonSchema ? {
          messages: [...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []), { role: 'user', content: options.prompt }],
          format: options.jsonSchema,
        } : { prompt: fullPrompt }),
        stream: false,
        think: options.jsonSchema ? /^(?:qwen3:|deepseek-r1:|gpt-oss:)/.test(model) : process.env.OLLAMA_THINK === 'true',
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 1000,
          num_ctx: options.contextTokens ?? Number(process.env.OLLAMA_CONTEXT_TOKENS || 8192),
        }
      };
      const response = options.jsonSchema ? await this.client.post('/api/chat', body, { timeout: 180000 }) : await this.client.post('/api/generate', body);

      const content = (options.jsonSchema ? response.data.message?.content : response.data.response) || '';
      const latency = Date.now() - startTime;
      
      // Ollama returns token counts if available
      const tokensUsed = response.data.eval_count || this.estimateTokens(content);

      logger.info(`Ollama generation completed`, { model, latency, tokensUsed });

      return {
        content: content.trim(),
        model: `ollama:${model}`,
        tokensUsed,
        cost: 0, // Free!
        latency
      };
    } catch (error: any) {
      logger.error('Ollama generation failed', { 
        error: error.message, 
        model,
        baseUrl: this.baseUrl 
      });

      // Check if Ollama is running
      if (error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
        throw new Error(
          `Ollama is not running. Please install and start Ollama:\n` +
          `1. Install from https://ollama.ai\n` +
          `2. Run: ollama pull ${model}\n` +
          `3. Make sure Ollama is running on ${this.baseUrl}`
        );
      }

      throw error;
    }
  }

  estimateCost(options: LLMGenerateOptions): number {
    // Ollama is completely free!
    return 0;
  }

  getModelName(): string {
    return `ollama:${this.model}`;
  }

  /**
   * Check if Ollama is available and list available models
   */
  async checkAvailability(): Promise<{ available: boolean; models?: string[] }> {
    try {
      const response = await this.client.get('/api/tags');
      return {
        available: true,
        models: response.data.models?.map((m: any) => m.name) || []
      };
    } catch (error) {
      return { available: false };
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

