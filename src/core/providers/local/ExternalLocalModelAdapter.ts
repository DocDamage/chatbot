/**
 * External Local Model Adapter
 * Connects to separately operated OpenAI-compatible local model servers
 * (Warpdrv, llama.cpp, Ollama, vLLM, LM Studio) without process management.
 */

import axios, { AxiosInstance } from 'axios';
import { LLMAdapter, LLMGenerateOptions, LLMResponse } from '../LLMAdapter';
import { logger } from '../../observability/logger';
import { LocalEndpointPolicy } from './LocalEndpointPolicy';
import { LocalResourceManager, LocalResourceLease, ResourceBudgetConfig } from './LocalResourceManager';
import { LocalModelDiscovery, LocalEndpointStatus } from './LocalModelDiscovery';
import { RuntimeProfile } from '../../config/EnvironmentDefinitions';

export interface ExternalLocalModelConfig {
  providerName?: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  profile?: RuntimeProfile;
  allowlist?: string[];
  resourceBudget?: ResourceBudgetConfig;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface LocalEmbeddingResponse {
  embeddings: number[][];
  model: string;
  tokensUsed: number;
}

export class ExternalLocalModelAdapter implements LLMAdapter {
  private providerName: string;
  private rawBaseUrl: string;
  private normalizedUrl: string;
  private defaultModel: string;
  private apiKey?: string;
  private profile: RuntimeProfile;
  private allowlist: string[];
  private timeoutMs: number;
  private maxRetries: number;

  private httpClient: AxiosInstance;
  private resourceManager: LocalResourceManager;
  private discovery: LocalModelDiscovery;

  constructor(config: ExternalLocalModelConfig) {
    this.providerName = config.providerName || 'local-openai';
    this.rawBaseUrl = config.baseUrl;
    this.defaultModel = config.model;
    this.apiKey = config.apiKey;
    this.profile = config.profile || 'local';
    this.allowlist = config.allowlist || [];
    this.timeoutMs = config.timeoutMs || 60000;
    this.maxRetries = config.maxRetries ?? 1;

    // Validate endpoint policy at construction time
    this.normalizedUrl = LocalEndpointPolicy.assert(this.rawBaseUrl, this.profile, this.allowlist);

    this.resourceManager = new LocalResourceManager(config.resourceBudget);
    this.discovery = new LocalModelDiscovery();

    this.httpClient = axios.create({
      baseURL: this.normalizedUrl,
      timeout: this.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
      }
    });
  }

  getModelName(): string {
    return `${this.providerName}:${this.defaultModel}`;
  }

  getProviderName(): string {
    return this.providerName;
  }

  getBaseUrl(): string {
    return this.normalizedUrl;
  }

  estimateCost(_options: LLMGenerateOptions): number {
    return 0; // Local model execution has zero direct API provider cost
  }

  async probe(): Promise<LocalEndpointStatus> {
    return this.discovery.probeEndpoint(this.normalizedUrl, {
      providerName: this.providerName,
      apiKey: this.apiKey,
      profile: this.profile,
      allowlist: this.allowlist,
      timeoutMs: Math.min(5000, this.timeoutMs)
    });
  }

  getResourceMetrics() {
    return this.resourceManager.getMetrics();
  }

  async generate(
    options: LLMGenerateOptions,
    extraOptions: { signal?: AbortSignal; requestId?: string } = {}
  ): Promise<LLMResponse> {
    // Re-verify policy in case profile or target changed
    LocalEndpointPolicy.assert(this.normalizedUrl, this.profile, this.allowlist);

    const startTime = Date.now();
    const model = options.model || this.defaultModel;
    const reqId = extraOptions.requestId || `local-req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Acquire resource lease
    let lease: LocalResourceLease | null = null;
    try {
      lease = await this.resourceManager.acquire(reqId, {
        timeoutMs: this.timeoutMs,
        signal: extraOptions.signal
      });

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: any }> = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }

      // Support multimodal image inputs if provided
      const extraAny = options as any;
      if (extraAny.images && Array.isArray(extraAny.images) && extraAny.images.length > 0) {
        const contentParts: any[] = [{ type: 'text', text: options.prompt }];
        for (const img of extraAny.images) {
          contentParts.push({
            type: 'image_url',
            image_url: { url: typeof img === 'string' && img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` }
          });
        }
        messages.push({ role: 'user', content: contentParts });
      } else {
        messages.push({ role: 'user', content: options.prompt });
      }

      const requestBody: Record<string, any> = {
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: false
      };

      if (extraAny.tools) requestBody.tools = extraAny.tools;
      if (extraAny.tool_choice) requestBody.tool_choice = extraAny.tool_choice;
      if (extraAny.response_format) requestBody.response_format = extraAny.response_format;

      let lastError: any = null;
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          if (extraOptions.signal?.aborted) {
            const abortErr = new Error('Request aborted');
            abortErr.name = 'AbortError';
            throw abortErr;
          }

          // Try /chat/completions, with fallback to /v1/chat/completions if 404
          let response: any;
          try {
            response = await this.httpClient.post('/chat/completions', requestBody, {
              signal: extraOptions.signal
            });
          } catch (postErr: any) {
            if (postErr.response?.status === 404 && !this.normalizedUrl.endsWith('/v1')) {
              response = await this.httpClient.post('/v1/chat/completions', requestBody, {
                signal: extraOptions.signal
              });
            } else {
              throw postErr;
            }
          }

          const latency = Date.now() - startTime;
          const choice = response.data?.choices?.[0];
          const content = choice?.message?.content || choice?.text || '';
          const reasoning = choice?.message?.reasoning_content || choice?.message?.reasoning;
          const toolCalls = choice?.message?.tool_calls;
          const tokensUsed = response.data?.usage?.total_tokens || Math.ceil((options.prompt.length + content.length) / 4);

          logger.info('Local model generation succeeded', {
            provider: this.providerName,
            model,
            latency,
            tokensUsed
          });

          const result: LLMResponse & { reasoning?: string; toolCalls?: any[] } = {
            content,
            model: `${this.providerName}:${model}`,
            tokensUsed,
            cost: 0,
            latency
          };
          if (reasoning) result.reasoning = reasoning;
          if (toolCalls) result.toolCalls = toolCalls;

          return result;
        } catch (err: any) {
          lastError = err;
          // Do not retry on client error (4xx) or AbortError
          if (err.name === 'AbortError' || (err.response?.status && err.response.status >= 400 && err.response.status < 500)) {
            throw err;
          }
          if (attempt < this.maxRetries) {
            logger.warn(`Retrying local model request attempt ${attempt + 1}`, { model, error: err.message });
            await new Promise(res => setTimeout(res, 200 * (attempt + 1)));
          }
        }
      }

      throw lastError;
    } finally {
      if (lease) {
        lease.release();
      }
    }
  }

  async generateStream(
    options: LLMGenerateOptions,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    LocalEndpointPolicy.assert(this.normalizedUrl, this.profile, this.allowlist);

    const startTime = Date.now();
    const model = options.model || this.defaultModel;
    const reqId = `local-stream-${Date.now()}`;

    let lease: LocalResourceLease | null = null;
    try {
      lease = await this.resourceManager.acquire(reqId, {
        timeoutMs: this.timeoutMs,
        signal
      });

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: options.prompt });

      let accumulated = '';
      const response = await this.httpClient.post(
        '/chat/completions',
        {
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
          stream: true
        },
        {
          responseType: 'stream',
          signal
        }
      );

      // Await the stream lifecycle inside the try block so the finally clause
      // cannot release the concurrency lease while bytes are still arriving.
      return await new Promise<LLMResponse>((resolve, reject) => {
        const stream = response.data;
        let pending = '';

        const consumeLine = (line: string) => {
          if (!line.trim().startsWith('data:')) return;
          const dataStr = line.replace(/^data:\s*/, '').trim();
          if (!dataStr || dataStr === '[DONE]') return;
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              accumulated += delta;
              onChunk(delta);
            }
          } catch (error) {
            reject(new Error(`Invalid SSE payload from local model endpoint: ${(error as Error).message}`));
            stream.destroy();
          }
        };

        stream.on('data', (chunkBuffer: Buffer) => {
          pending += chunkBuffer.toString('utf-8');
          const lines = pending.split(/\r?\n/);
          pending = lines.pop() || '';
          lines.forEach(consumeLine);
        });

        stream.on('end', () => {
          if (pending.trim()) consumeLine(pending);
          const latency = Date.now() - startTime;
          resolve({
            content: accumulated,
            model: `${this.providerName}:${model}`,
            tokensUsed: Math.ceil((options.prompt.length + accumulated.length) / 4),
            cost: 0,
            latency
          });
        });

        stream.on('error', (err: any) => reject(err));
      });
    } finally {
      if (lease) {
        lease.release();
      }
    }
  }

  async getEmbeddings(
    input: string | string[],
    options: { model?: string; signal?: AbortSignal } = {}
  ): Promise<LocalEmbeddingResponse> {
    LocalEndpointPolicy.assert(this.normalizedUrl, this.profile, this.allowlist);

    const model = options.model || 'embedding';
    const reqId = `local-embed-${Date.now()}`;

    let lease: LocalResourceLease | null = null;
    try {
      lease = await this.resourceManager.acquire(reqId, {
        timeoutMs: this.timeoutMs,
        signal: options.signal
      });

      const response = await this.httpClient.post('/embeddings', {
        model,
        input
      }, {
        signal: options.signal
      });

      const data = response.data?.data || [];
      const embeddings = data.map((item: any) => item.embedding);
      const tokensUsed = response.data?.usage?.total_tokens || 0;

      return {
        embeddings,
        model,
        tokensUsed
      };
    } finally {
      if (lease) {
        lease.release();
      }
    }
  }
}
