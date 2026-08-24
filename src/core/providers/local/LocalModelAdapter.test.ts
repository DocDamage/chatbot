import axios from 'axios';
import {
  LocalEndpointPolicy,
  LocalEndpointSecurityError,
  LocalModelDiscovery,
  LocalResourceManager,
  LocalResourceOverloadedError,
  ExternalLocalModelAdapter,
  LocalModelRoutingPolicy,
  RoutingCandidate
} from './index';
import { CodingModelRouter } from '../../coding/model/CodingModelRouter';
import { EventEmitter } from 'events';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CF-04 Local Model and Resource Adapter Layer', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('LocalEndpointPolicy (SSRF & Profile Protection)', () => {
    it('allows loopback addresses in local mode', () => {
      const urls = [
        'http://127.0.0.1:8080/v1',
        'http://localhost:11434',
        'http://[::1]:8000/v1/'
      ];

      for (const url of urls) {
        const result = LocalEndpointPolicy.validate(url, 'local');
        expect(result.valid).toBe(true);
        expect(result.normalizedUrl).toBeDefined();
        expect(result.normalizedUrl?.endsWith('/')).toBe(false);
      }
    });

    it('rejects cloud metadata services (SSRF protection)', () => {
      const blocked = [
        'http://169.254.169.254/latest/meta-data',
        'http://169.254.170.2/v2/metadata',
        'http://metadata.google.internal/computeMetadata/v1',
        'http://instance-data/latest/meta-data'
      ];

      for (const url of blocked) {
        const result = LocalEndpointPolicy.validate(url, 'local');
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/metadata|link-local/i);
        expect(() => LocalEndpointPolicy.assert(url, 'local')).toThrow(LocalEndpointSecurityError);
      }
    });

    it('rejects wildcard and unsupported protocols', () => {
      expect(LocalEndpointPolicy.validate('http://0.0.0.0:8080', 'local').valid).toBe(false);
      expect(LocalEndpointPolicy.validate('ftp://127.0.0.1:8080', 'local').valid).toBe(false);
      expect(LocalEndpointPolicy.validate('file:///etc/passwd', 'local').valid).toBe(false);
      expect(LocalEndpointPolicy.validate('not-a-url', 'local').valid).toBe(false);
    });

    it('rejects all local model endpoints in hosted profile', () => {
      const result = LocalEndpointPolicy.validate('http://127.0.0.1:8080/v1', 'hosted');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('HOSTED mode');
      expect(() => LocalEndpointPolicy.assert('http://127.0.0.1:8080/v1', 'hosted')).toThrow(LocalEndpointSecurityError);
    });

    it('supports custom allowlist and private network aliases in local mode', () => {
      const customUrl = 'http://my-gpu-server.local:8080/v1';
      expect(LocalEndpointPolicy.validate(customUrl, 'local', []).valid).toBe(false);
      expect(LocalEndpointPolicy.validate(customUrl, 'local', ['my-gpu-server.local']).valid).toBe(true);

      const lanUrl = 'http://192.168.1.100:8080/v1';
      expect(LocalEndpointPolicy.validate(lanUrl, 'local', ['lan']).valid).toBe(true);
    });
  });

  describe('LocalModelDiscovery & Capability Probing', () => {
    it('probes endpoint and infers capabilities accurately', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        status: 200,
        headers: { 'x-server-version': 'llama.cpp-b3200' },
        data: {
          data: [
            { id: 'qwen2.5-coder-7b-instruct', context_length: 32768 },
            { id: 'llama-3.1-8b-vision' },
            { id: 'bge-large-en-v1.5' }
          ]
        }
      });
      mockedAxios.create.mockReturnValue({ get: mockGet } as any);

      const discovery = new LocalModelDiscovery();
      const status = await discovery.probeEndpoint('http://127.0.0.1:8080/v1', {
        providerName: 'warpdrv'
      });

      expect(status.health).toBe('healthy');
      expect(status.version).toBe('llama.cpp-b3200');
      expect(status.models.length).toBe(3);

      const coder = status.models.find(m => m.id === 'qwen2.5-coder-7b-instruct')!;
      expect(coder.contextLength).toBe(32768);
      expect(coder.supportsTools).toBe(true);
      expect(coder.codeQuality).toBeGreaterThan(0.9);

      const vision = status.models.find(m => m.id === 'llama-3.1-8b-vision')!;
      expect(vision.supportsVision).toBe(true);

      const embed = status.models.find(m => m.id === 'bge-large-en-v1.5')!;
      expect(embed.supportsEmbeddings).toBe(true);
    });

    it('classifies health degradation states properly', async () => {
      const discovery = new LocalModelDiscovery();

      // ECONNREFUSED -> startup_unavailable
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' })
      } as any);
      const res1 = await discovery.probeEndpoint('http://127.0.0.1:8080/v1', { cacheTtlMs: 0 });
      expect(res1.health).toBe('startup_unavailable');

      // 503 -> overloaded
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue({ response: { status: 503 }, message: 'Service Unavailable' })
      } as any);
      const res2 = await discovery.probeEndpoint('http://127.0.0.1:8080/v1', { cacheTtlMs: 0 });
      expect(res2.health).toBe('overloaded');

      // 401 -> incompatible
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue({ response: { status: 401 }, message: 'Unauthorized' })
      } as any);
      const res3 = await discovery.probeEndpoint('http://127.0.0.1:8080/v1', { cacheTtlMs: 0 });
      expect(res3.health).toBe('incompatible');

      // 400 -> version_mismatch
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue({ response: { status: 400 }, message: 'Bad Request' })
      } as any);
      const res4 = await discovery.probeEndpoint('http://127.0.0.1:8080/v1', { cacheTtlMs: 0 });
      expect(res4.health).toBe('version_mismatch');
    });
  });

  describe('LocalResourceManager (Concurrency, Queue & Cancellation)', () => {
    it('allocates and releases slots within concurrency budget', async () => {
      const manager = new LocalResourceManager({ maxConcurrency: 2, maxQueueDepth: 2 });

      const lease1 = await manager.acquire('req-1');
      const lease2 = await manager.acquire('req-2');
      expect(manager.getMetrics().activeRequests).toBe(2);
      expect(manager.getMetrics().availableSlots).toBe(0);

      // Third request is queued
      let lease3Acquired = false;
      const lease3Promise = manager.acquire('req-3').then(l => {
        lease3Acquired = true;
        return l;
      });

      expect(manager.getMetrics().queuedRequests).toBe(1);
      expect(lease3Acquired).toBe(false);

      // Release lease 1 -> lease 3 is granted
      lease1.release();
      const lease3 = await lease3Promise;
      expect(lease3Acquired).toBe(true);
      expect(manager.getMetrics().activeRequests).toBe(2);
      expect(manager.getMetrics().queuedRequests).toBe(0);

      lease2.release();
      lease3.release();
      expect(manager.getMetrics().activeRequests).toBe(0);
    });

    it('rejects when queue is saturated', async () => {
      const manager = new LocalResourceManager({ maxConcurrency: 1, maxQueueDepth: 1 });

      const lease1 = await manager.acquire('req-1');
      const p2 = manager.acquire('req-2'); // queued (depth 1)

      await expect(manager.acquire('req-3')).rejects.toThrow(LocalResourceOverloadedError);

      lease1.release();
      const lease2 = await p2;
      lease2.release();
    });

    it('cleans up queued requests on AbortSignal', async () => {
      const manager = new LocalResourceManager({ maxConcurrency: 1, maxQueueDepth: 5 });
      const lease1 = await manager.acquire('req-1');

      const controller = new AbortController();
      const queuedPromise = manager.acquire('req-abort', { signal: controller.signal });

      expect(manager.getMetrics().queuedRequests).toBe(1);
      controller.abort();

      await expect(queuedPromise).rejects.toThrow(/aborted/i);
      expect(manager.getMetrics().queuedRequests).toBe(0);

      lease1.release();
    });

    it('enforces VRAM budget limit when required', async () => {
      const manager = new LocalResourceManager({ maxVramMb: 8000 });
      await expect(manager.acquire('big-model', { requiredVramMb: 24000 })).rejects.toThrow(LocalResourceOverloadedError);
    });

    it('enforces RAM and CPU thread budgets when required', async () => {
      const manager = new LocalResourceManager({ maxRamMb: 4096, maxCpuThreads: 4 });
      await expect(manager.acquire('ram-heavy', { requiredRamMb: 8192 })).rejects.toThrow(/RAM/);
      await expect(manager.acquire('cpu-heavy', { requiredCpuThreads: 8 })).rejects.toThrow(/CPU threads/);
    });
  });

  describe('ExternalLocalModelAdapter', () => {
    it('executes chat completion and releases resource lease', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: 'function add(a, b) { return a + b; }' } }],
          usage: { total_tokens: 42 }
        }
      });
      mockedAxios.create.mockReturnValue({ post: mockPost } as any);

      const adapter = new ExternalLocalModelAdapter({
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'qwen2.5-coder-7b',
        providerName: 'warpdrv'
      });

      const response = await adapter.generate({ prompt: 'write add function' });
      expect(response.content).toBe('function add(a, b) { return a + b; }');
      expect(response.tokensUsed).toBe(42);
      expect(response.cost).toBe(0);
      expect(adapter.getResourceMetrics().activeRequests).toBe(0);
    });

    it('streams chat completion chunks', async () => {
      const streamEmitter = new EventEmitter();
      const mockPost = jest.fn().mockResolvedValue({
        data: streamEmitter
      });
      mockedAxios.create.mockReturnValue({ post: mockPost } as any);

      const adapter = new ExternalLocalModelAdapter({
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'qwen2.5-coder-7b'
      });

      const chunks: string[] = [];
      const generatePromise = adapter.generateStream(
        { prompt: 'stream me' },
        chunk => chunks.push(chunk)
      );

      // Emit SSE lines
      setTimeout(() => {
        streamEmitter.emit('data', Buffer.from('data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n'));
        streamEmitter.emit('data', Buffer.from('data: {"choices":[{"delta":{"content":"World!"}}]}\n\n'));
        streamEmitter.emit('data', Buffer.from('data: [DONE]\n\n'));
        streamEmitter.emit('end');
      }, 10);

      const result = await generatePromise;
      expect(result.content).toBe('Hello World!');
      expect(chunks).toEqual(['Hello ', 'World!']);
    });

    it('fetches embeddings', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          usage: { total_tokens: 8 }
        }
      });
      mockedAxios.create.mockReturnValue({ post: mockPost } as any);

      const adapter = new ExternalLocalModelAdapter({
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'bge-large'
      });

      const res = await adapter.getEmbeddings('sample query');
      expect(res.embeddings).toEqual([[0.1, 0.2, 0.3]]);
      expect(res.tokensUsed).toBe(8);
    });
  });

  describe('LocalModelRoutingPolicy & Telemetry', () => {
    const localCoder: RoutingCandidate = {
      provider: 'local-warpdrv',
      model: 'qwen2.5-coder-7b',
      isLocal: true,
      contextTokens: 32768,
      qualityScore: 0.92,
      latencyMs: 100,
      costPer1kTokens: 0,
      structuredOutput: true,
      toolCalling: true,
      vision: false,
      healthy: true,
      available: true
    };

    const cloudGpt4: RoutingCandidate = {
      provider: 'openai',
      model: 'gpt-4o',
      isLocal: false,
      contextTokens: 128000,
      qualityScore: 0.95,
      latencyMs: 500,
      costPer1kTokens: 0.005,
      structuredOutput: true,
      toolCalling: true,
      vision: true,
      healthy: true,
      available: true
    };

    it('selects local model in prefer_local mode when healthy', () => {
      const policy = new LocalModelRoutingPolicy({ defaultPrivacyMode: 'prefer_local' });
      policy.registerCandidate(localCoder);
      policy.registerCandidate(cloudGpt4);

      const decision = policy.route({ prompt: 'write a quick sort algorithm' });
      expect(decision.isLocal).toBe(true);
      expect(decision.selectedModel).toBe('qwen2.5-coder-7b');
      expect(decision.degradationState).toBe('none');
    });

    it('falls back to cloud with telemetry reason when local is unhealthy in prefer_local', () => {
      const policy = new LocalModelRoutingPolicy({ defaultPrivacyMode: 'prefer_local' });
      policy.registerCandidate({ ...localCoder, healthy: false });
      policy.registerCandidate(cloudGpt4);

      const decision = policy.route({ prompt: 'write a quick sort algorithm' });
      expect(decision.isLocal).toBe(false);
      expect(decision.selectedModel).toBe('gpt-4o');
      expect(decision.degradationState).toBe('fallback_to_cloud');
      expect(decision.fallbackReason).toContain('Local model unavailable');
    });

    it('strictly enforces strict_local mode without leaking to cloud', () => {
      const policy = new LocalModelRoutingPolicy();
      policy.registerCandidate({ ...localCoder, healthy: false });
      policy.registerCandidate(cloudGpt4);

      const decision = policy.route({
        prompt: 'sensitive proprietary function',
        privacyMode: 'strict_local'
      });

      expect(decision.isLocal).toBe(true);
      expect(decision.providerId).toBe('template');
      expect(decision.degradationState).toBe('fallback_to_template');
      expect(decision.fallbackReason).toContain('Strict local mode required');
    });

    it('rejects local models when privacyMode is local_disabled (e.g. hosted mode)', () => {
      const policy = new LocalModelRoutingPolicy();
      policy.registerCandidate(localCoder);
      policy.registerCandidate(cloudGpt4);

      const decision = policy.route({
        prompt: 'public query',
        privacyMode: 'local_disabled'
      });

      expect(decision.isLocal).toBe(false);
      expect(decision.providerId).toBe('openai');
    });
  });

  describe('CodingModelRouter integration', () => {
    it('supports local model preference and fallback degradation telemetry', () => {
      const router = new CodingModelRouter();
      router.register({
        provider: 'warpdrv',
        model: 'qwen2.5-coder-7b',
        contextTokens: 32768,
        structuredOutput: true,
        toolCalling: true,
        codeQuality: 0.90,
        latencyMs: 120,
        costPer1kTokens: 0,
        local: true
      });
      router.register({
        provider: 'openai',
        model: 'gpt-4o',
        contextTokens: 128000,
        structuredOutput: true,
        toolCalling: true,
        codeQuality: 0.95,
        latencyMs: 400,
        costPer1kTokens: 0.005,
        local: false
      });

      // Default prefer_local selects local
      const sel1 = router.select({ prompt: 'test' });
      expect(sel1.isLocal).toBe(true);
      expect(sel1.capability.model).toBe('qwen2.5-coder-7b');
      expect(sel1.degradationState).toBe('none');

      // If context exceeds local 32k, gracefully degrades to cloud
      const sel2 = router.select({ prompt: 'x'.repeat(160000), minContextTokens: 64000 });
      expect(sel2.isLocal).toBe(false);
      expect(sel2.capability.model).toBe('gpt-4o');
      expect(sel2.degradationState).toBe('fallback_to_cloud');

      // strict_local rejects if context exceeds local
      const sel3 = router.select({
        prompt: 'x'.repeat(160000),
        minContextTokens: 64000,
        privacyMode: 'strict_local'
      });
      expect(sel3.supported).toBe(false);
      expect(sel3.degradationState).toBe('fallback_to_template');
    });
  });
});
