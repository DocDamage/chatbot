/**
 * Local Model Discovery & Capability Probing Service
 * Safely discovers available models and probes capabilities (context length,
 * streaming, embeddings, vision, tools, version, health states).
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../observability/logger';
import { LocalEndpointPolicy } from './LocalEndpointPolicy';
import { RuntimeProfile } from '../../config/EnvironmentDefinitions';

export type LocalEndpointHealthState =
  | 'healthy'
  | 'startup_unavailable'
  | 'overloaded'
  | 'version_mismatch'
  | 'incompatible'
  | 'unreachable';

export interface LocalModelCapability {
  id: string;
  name: string;
  contextLength: number;
  supportsStreaming: boolean;
  supportsEmbeddings: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStructuredOutput: boolean;
  codeQuality: number;
  latencyMs: number;
  costPer1kTokens: number;
  estimatedVramMb?: number;
}

export interface LocalEndpointStatus {
  provider: string;
  baseUrl: string;
  health: LocalEndpointHealthState;
  version?: string;
  models: LocalModelCapability[];
  lastChecked: string;
  error?: string;
}

export interface LocalDiscoveryOptions {
  providerName?: string;
  apiKey?: string;
  profile?: RuntimeProfile;
  allowlist?: string[];
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export class LocalModelDiscovery {
  private cache = new Map<string, { status: LocalEndpointStatus; expiresAt: number }>();
  private cacheTtlMs: number;

  constructor(options?: { defaultTtlMs?: number }) {
    this.cacheTtlMs = options?.defaultTtlMs ?? 60000;
  }

  /**
   * Probe an OpenAI-compatible local model endpoint.
   */
  async probeEndpoint(
    rawBaseUrl: string,
    options: LocalDiscoveryOptions = {}
  ): Promise<LocalEndpointStatus> {
    const profile = options.profile ?? 'local';
    const allowlist = options.allowlist ?? [];
    const provider = options.providerName ?? 'local-openai';
    const timeoutMs = options.timeoutMs ?? 5000;
    const cacheTtl = options.cacheTtlMs ?? this.cacheTtlMs;

    // Check security policy first
    let normalizedUrl: string;
    try {
      normalizedUrl = LocalEndpointPolicy.assert(rawBaseUrl, profile, allowlist);
    } catch (err: any) {
      return {
        provider,
        baseUrl: rawBaseUrl,
        health: 'incompatible',
        models: [],
        lastChecked: new Date().toISOString(),
        error: `Policy violation: ${err.message}`
      };
    }

    const cached = this.cache.get(normalizedUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.status;
    }

    const client: AxiosInstance = axios.create({
      baseURL: normalizedUrl,
      timeout: timeoutMs,
      headers: {
        'Accept': 'application/json',
        ...(options.apiKey ? { 'Authorization': `Bearer ${options.apiKey}` } : {})
      }
    });

    let status: LocalEndpointStatus;

    try {
      // 1. Probe /models or /v1/models
      let modelsData: any[] = [];
      let version: string | undefined;

      try {
        const modelsRes = await client.get('/models');
        modelsData = Array.isArray(modelsRes.data?.data) ? modelsRes.data.data : Array.isArray(modelsRes.data) ? modelsRes.data : [];
        version = modelsRes.headers['x-server-version'] || modelsRes.headers['server'] || undefined;
      } catch (err: any) {
        if (err.response?.status === 404) {
          // Try /v1/models if base URL did not already include /v1
          const v1ModelsRes = await client.get('/v1/models');
          modelsData = Array.isArray(v1ModelsRes.data?.data) ? v1ModelsRes.data.data : [];
          version = v1ModelsRes.headers['x-server-version'] || v1ModelsRes.headers['server'] || undefined;
        } else {
          throw err;
        }
      }

      const discoveredModels: LocalModelCapability[] = modelsData.map((item: any) => {
        const modelId = String(item.id || item.name || 'local-model');
        return this.inferModelCapabilities(modelId, item);
      });

      status = {
        provider,
        baseUrl: normalizedUrl,
        health: 'healthy',
        version,
        models: discoveredModels,
        lastChecked: new Date().toISOString()
      };
    } catch (error: any) {
      const errCode = error.code;
      const statusNum = error.response?.status;
      let health: LocalEndpointHealthState = 'unreachable';
      let errorMsg = error.message;

      if (errCode === 'ECONNREFUSED' || errCode === 'ENOTFOUND') {
        health = 'startup_unavailable';
        errorMsg = 'Local model endpoint is not running or unreachable';
      } else if (statusNum === 503 || statusNum === 429) {
        health = 'overloaded';
        errorMsg = `Endpoint overloaded (HTTP ${statusNum})`;
      } else if (statusNum === 401 || statusNum === 403) {
        health = 'incompatible';
        errorMsg = `Authentication or access denied (HTTP ${statusNum})`;
      } else if (statusNum === 400 || statusNum === 405) {
        health = 'version_mismatch';
        errorMsg = `Incompatible endpoint API version (HTTP ${statusNum})`;
      }

      logger.warn(`Local model discovery probe failed for ${normalizedUrl}`, { health, error: errorMsg });

      status = {
        provider,
        baseUrl: normalizedUrl,
        health,
        models: [],
        lastChecked: new Date().toISOString(),
        error: errorMsg
      };
    }

    this.cache.set(normalizedUrl, {
      status,
      expiresAt: Date.now() + cacheTtl
    });

    return status;
  }

  /**
   * Invalidate cached discovery results
   */
  invalidate(baseUrl?: string): void {
    if (baseUrl) {
      this.cache.delete(baseUrl);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Infer capabilities from model id naming and metadata
   */
  private inferModelCapabilities(modelId: string, rawMetadata?: any): LocalModelCapability {
    const idLower = modelId.toLowerCase();
    
    // Determine context length
    let contextLength = 4096;
    if (rawMetadata?.context_length && typeof rawMetadata.context_length === 'number') {
      contextLength = rawMetadata.context_length;
    } else if (idLower.includes('128k')) {
      contextLength = 131072;
    } else if (idLower.includes('64k')) {
      contextLength = 65536;
    } else if (idLower.includes('32k')) {
      contextLength = 32768;
    } else if (idLower.includes('16k')) {
      contextLength = 16384;
    } else if (idLower.includes('8k') || idLower.includes('llama-3') || idLower.includes('llama3')) {
      contextLength = 8192;
    } else if (idLower.includes('qwen2.5') || idLower.includes('qwen-2.5')) {
      contextLength = 32768;
    }

    const supportsVision = idLower.includes('vision') || idLower.includes('vl') || idLower.includes('llava') || idLower.includes('pixtral');
    const supportsEmbeddings = idLower.includes('embed') || idLower.includes('bge') || idLower.includes('nomic') || idLower.includes('gte');
    const supportsTools = !supportsEmbeddings && (idLower.includes('instruct') || idLower.includes('chat') || idLower.includes('tool') || idLower.includes('hermes') || idLower.includes('qwen') || idLower.includes('llama-3'));
    const supportsStructuredOutput = supportsTools;
    const supportsStreaming = !supportsEmbeddings;

    // Estimate code quality
    let codeQuality = 0.70;
    if (idLower.includes('coder') || idLower.includes('deepseek-coder') || idLower.includes('starcoder') || idLower.includes('qwen2.5-coder')) {
      codeQuality = 0.92;
    } else if (idLower.includes('llama-3.1-70b') || idLower.includes('qwen2.5-72b')) {
      codeQuality = 0.94;
    } else if (idLower.includes('llama-3.1-8b') || idLower.includes('qwen2.5-7b') || idLower.includes('mistral')) {
      codeQuality = 0.82;
    }

    // Estimate VRAM
    let estimatedVramMb = 4096;
    if (idLower.includes('70b') || idLower.includes('72b')) {
      estimatedVramMb = 40000;
    } else if (idLower.includes('32b') || idLower.includes('34b')) {
      estimatedVramMb = 20000;
    } else if (idLower.includes('13b') || idLower.includes('14b')) {
      estimatedVramMb = 10000;
    } else if (idLower.includes('7b') || idLower.includes('8b')) {
      estimatedVramMb = 6000;
    } else if (idLower.includes('1b') || idLower.includes('3b')) {
      estimatedVramMb = 2500;
    }

    return {
      id: modelId,
      name: modelId,
      contextLength,
      supportsStreaming,
      supportsEmbeddings,
      supportsVision,
      supportsTools,
      supportsStructuredOutput,
      codeQuality,
      latencyMs: 120,
      costPer1kTokens: 0, // local is zero marginal cost
      estimatedVramMb
    };
  }
}
