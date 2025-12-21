/**
 * Provider Abstraction - LLM Adapter Interface
 * Allows swapping providers without rewriting code
 */

import OpenAI from 'openai';
import { logger } from '../observability/logger';

export interface LLMGenerateOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  cost?: number;
  latency?: number;
}

export interface LLMAdapter {
  generate(options: LLMGenerateOptions): Promise<LLMResponse>;
  estimateCost(options: LLMGenerateOptions): number;
  getModelName(): string;
}

/**
 * OpenAI Adapter Implementation
 */
export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  private model: string;
  private defaultModel = 'gpt-3.5-turbo';
  private fallbackModel = 'gpt-3.5-turbo';

  constructor(apiKey: string, model: string = 'gpt-3.5-turbo') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.defaultModel = model;
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = options.model || this.model;

    try {
      const messages = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system' as const, content: options.systemPrompt });
      }
      messages.push({ role: 'user' as const, content: options.prompt });

      const completion = await this.client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000
      });

      const content = completion.choices[0]?.message?.content || '';
      const latency = Date.now() - startTime;
      const tokensUsed = completion.usage?.total_tokens || 0;
      const cost = this.estimateCostForTokens(tokensUsed, model);

      logger.info(`LLM generation completed`, { model, latency, tokensUsed, cost });

      return {
        content,
        model,
        tokensUsed,
        cost,
        latency
      };
    } catch (error: any) {
      logger.error('LLM generation failed', { error: error.message, model });
      
      // Try fallback model if different
      if (model !== this.fallbackModel) {
        logger.info(`Attempting fallback model: ${this.fallbackModel}`);
        return this.generate({ ...options, model: this.fallbackModel });
      }
      
      throw error;
    }
  }

  estimateCost(options: LLMGenerateOptions): number {
    // Rough estimation based on prompt length
    const estimatedTokens = Math.ceil((options.prompt.length + (options.systemPrompt?.length || 0)) / 4) + (options.maxTokens || 1000);
    const model = options.model || this.model;
    return this.estimateCostForTokens(estimatedTokens, model);
  }

  private estimateCostForTokens(tokens: number, model: string): number {
    // GPT-3.5-turbo pricing (rough estimates)
    if (model.includes('gpt-4')) {
      return (tokens / 1000) * 0.03; // $0.03 per 1K tokens
    } else if (model.includes('gpt-3.5-turbo')) {
      return (tokens / 1000) * 0.002; // $0.002 per 1K tokens
    }
    return (tokens / 1000) * 0.002; // Default estimate
  }

  getModelName(): string {
    return this.model;
  }
}

/**
 * Template/Fallback Adapter for graceful degradation
 */
export class TemplateAdapter implements LLMAdapter {
  private responses: Map<string, string> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    const prompt = options.prompt.toLowerCase();
    
    // Simple keyword matching for fallback responses
    for (const [keyword, response] of this.responses.entries()) {
      if (prompt.includes(keyword.toLowerCase())) {
        return {
          content: response,
          model: 'template',
          latency: 10,
          cost: 0
        };
      }
    }

    return {
      content: "I'm currently experiencing technical difficulties, but I'm here to help. Could you rephrase your question?",
      model: 'template',
      latency: 10,
      cost: 0
    };
  }

  estimateCost(): number {
    return 0;
  }

  getModelName(): string {
    return 'template';
  }

  private initializeTemplates(): void {
    this.responses.set('hello', 'Hello! How can I help you today?');
    this.responses.set('hi', 'Hi there! What would you like to know?');
    this.responses.set('help', 'I can answer questions, have conversations, and assist with various topics. What do you need help with?');
    this.responses.set('thanks', "You're welcome! Is there anything else I can help with?");
  }
}

