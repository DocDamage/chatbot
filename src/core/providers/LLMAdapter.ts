/**
 * Provider Abstraction - LLM Adapter Interface
 * Allows swapping providers without rewriting code
 */

import OpenAI from 'openai';
import axios, { AxiosInstance } from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
  private httpClient: AxiosInstance;
  private model: string;
  private defaultModel = 'gpt-3.5-turbo';
  private fallbackModel = 'gpt-3.5-turbo';

  constructor(apiKey: string, model: string = 'gpt-3.5-turbo', baseURL?: string) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.model = model;
    this.defaultModel = model;

    // Create HTTP client with connection pooling
    this.httpClient = axios.create({
      baseURL: baseURL || 'https://api.openai.com',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      httpAgent: new (require('http').Agent)({
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 50,
        maxFreeSockets: 10,
      }),
      httpsAgent: new (require('https').Agent)({
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 50,
        maxFreeSockets: 10,
      }),
    });
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

    if (this.isCapabilityQuestion(prompt)) {
      return {
        content: [
          'I can help you chat through ideas, answer questions, summarize information, work with documents in the knowledge base, explain code, draft text, and troubleshoot this app.',
          'Right now I am running in local fallback mode, so I can still be useful for lightweight help without calling an external LLM provider.'
        ].join(' '),
        model: 'template',
        latency: 10,
        cost: 0
      };
    }
    
    // Simple keyword matching for fallback responses
    for (const [keyword, response] of this.responses.entries()) {
      if (this.matchesKeyword(prompt, keyword)) {
        return {
          content: response,
          model: 'template',
          latency: 10,
          cost: 0
        };
      }
    }

    return {
      content: "I can help with general questions, brainstorming, summaries, simple explanations, and app troubleshooting. For deeper reasoning or more natural conversation, connect an external model provider such as Ollama, OpenAI, or Hugging Face.",
      model: 'template',
      latency: 10,
      cost: 0
    };
  }

  estimateCost(_options?: LLMGenerateOptions): number {
    return 0;
  }

  getModelName(): string {
    return 'template';
  }

  private initializeTemplates(): void {
    this.responses.set('hello', 'Hello! How can I help you today?');
    this.responses.set('hi', 'Hi there! What would you like to know?');
    this.responses.set('help', 'I can answer questions, have conversations, and assist with various topics. What do you need help with?');
    this.responses.set('capabilities', 'I can answer questions, summarize information, explain code, help troubleshoot the app, and work with knowledge-base context when relevant.');
    this.responses.set('thanks', "You're welcome! Is there anything else I can help with?");
  }

  private isCapabilityQuestion(prompt: string): boolean {
    return [
      'what can you do',
      'what are you able to do',
      'how can you help',
      'what can you help',
      'your capabilities',
      'what do you do'
    ].some(phrase => prompt.includes(phrase));
  }

  private matchesKeyword(prompt: string, keyword: string): boolean {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escapedKeyword}\\b`, 'i').test(prompt);
  }
}

export class OpenAICompatibleAdapter extends OpenAIAdapter {
  private providerName: string;
  private modelName: string;

  constructor(providerName: string, apiKey: string, baseURL: string, model: string) {
    super(apiKey, model, baseURL);
    this.providerName = providerName;
    this.modelName = model;
  }

  getModelName(): string {
    return `${this.providerName}:${this.modelName}`;
  }
}

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20241022') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = options.model || this.model;
    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt,
      messages: [{ role: 'user', content: options.prompt }]
    });

    const content = response.content
      .map(block => block.type === 'text' ? block.text : '')
      .join('');

    return {
      content,
      model,
      tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      latency: Date.now() - startTime,
      cost: this.estimateCost(options)
    };
  }

  estimateCost(options: LLMGenerateOptions): number {
    const estimatedTokens = Math.ceil((options.prompt.length + (options.systemPrompt?.length || 0)) / 4) + (options.maxTokens || 1000);
    return (estimatedTokens / 1000) * 0.003;
  }

  getModelName(): string {
    return this.model;
  }
}

export class GeminiAdapter implements LLMAdapter {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = options.model || this.model;
    const geminiModel = this.client.getGenerativeModel({
      model,
      systemInstruction: options.systemPrompt
    });

    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens || 1000
      }
    });

    return {
      content: result.response.text(),
      model,
      latency: Date.now() - startTime,
      cost: this.estimateCost(options)
    };
  }

  estimateCost(options: LLMGenerateOptions): number {
    const estimatedTokens = Math.ceil((options.prompt.length + (options.systemPrompt?.length || 0)) / 4) + (options.maxTokens || 1000);
    return (estimatedTokens / 1000) * 0.0005;
  }

  getModelName(): string {
    return this.model;
  }
}

