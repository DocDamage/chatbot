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

    it('enforces endpoint policy, sends API keys, caches results, and supports targeted or full invalidation', async () => {
      const discovery = new LocalModelDiscovery({ defaultTtlMs: 60000 });
      const denied = await discovery.probeEndpoint('http://127.0.0.1:8080/v1', { profile: 'hosted' });
      expect(denied.health).toBe('incompatible');
      expect(denied.error).toContain('Policy violation');

      const mockGet = jest.fn().mockResolvedValue({ data: [], headers: {} });
      mockedAxios.create.mockReturnValue({ get: mockGet } as any);
      const url = 'http://127.0.0.1:8080/v1';
      const first = await discovery.probeEndpoint(url, { apiKey: 'fixture-key', timeoutMs: 123 });
      const cached = await discovery.probeEndpoint(url, { apiKey: 'fixture-key', timeoutMs: 123 });
      expect(cached).toBe(first);
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({
        timeout: 123,
        headers: { Accept: 'application/json', Authorization: 'Bearer fixture-key' }
      }));

      discovery.invalidate(url);
      await discovery.probeEndpoint(url);
      expect(mockGet).toHaveBeenCalledTimes(2);
      discovery.invalidate();
      await discovery.probeEndpoint(url);
      expect(mockGet).toHaveBeenCalledTimes(3);
    });

    it('falls back to /v1/models after a 404 and accepts server headers and missing model IDs', async () => {
      const mockGet = jest.fn()
        .mockRejectedValueOnce({ response: { status: 404 } })
        .mockResolvedValueOnce({
          data: { data: [{ name: 'named-model' }, {}] },
          headers: { server: 'fixture-server' }
        });
      mockedAxios.create.mockReturnValue({ get: mockGet } as any);
      const result = await new LocalModelDiscovery().probeEndpoint('http://127.0.0.1:8080');
      expect(mockGet).toHaveBeenNthCalledWith(1, '/models');
      expect(mockGet).toHaveBeenNthCalledWith(2, '/v1/models');
      expect(result.version).toBe('fixture-server');
      expect(result.models.map(model => model.id)).toEqual(['named-model', 'local-model']);
    });

    it('accepts raw model arrays and covers model capability inference tiers', async () => {
      const ids = [
        'model-128k-70b', 'model-64k-32b', 'model-32k-13b', 'model-16k-7b', 'model-8k-3b',
        'llama3-8b-chat', 'qwen2.5-72b', 'vision-instruct', 'vl-chat', 'llava-tool', 'pixtral-hermes',
        'embed-model', 'bge-model', 'nomic-model', 'gte-model', 'plain-instruct', 'plain-chat',
        'plain-tool', 'plain-hermes', 'mistral-7b', 'starcoder-34b'
      ];
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: ids.map(id => ({ id })), headers: {} })
      } as any);
      const result = await new LocalModelDiscovery().probeEndpoint('http://127.0.0.1:8080');
      const byId = new Map(result.models.map(model => [model.id, model]));
      expect(byId.get('model-128k-70b')).toMatchObject({ contextLength: 131072, estimatedVramMb: 40000 });
      expect(byId.get('model-64k-32b')).toMatchObject({ contextLength: 65536, estimatedVramMb: 20000 });
      expect(byId.get('model-32k-13b')).toMatchObject({ contextLength: 32768, estimatedVramMb: 10000 });
      expect(byId.get('model-16k-7b')).toMatchObject({ contextLength: 16384, estimatedVramMb: 6000 });
      expect(byId.get('model-8k-3b')).toMatchObject({ contextLength: 8192, estimatedVramMb: 2500 });
      expect(byId.get('qwen2.5-72b')?.codeQuality).toBe(0.94);
      expect(byId.get('mistral-7b')?.codeQuality).toBe(0.82);
      expect(byId.get('starcoder-34b')?.codeQuality).toBe(0.92);
      for (const id of ['vision-instruct', 'vl-chat', 'llava-tool', 'pixtral-hermes']) {
        expect(byId.get(id)?.supportsVision).toBe(true);
      }
      for (const id of ['embed-model', 'bge-model', 'nomic-model', 'gte-model']) {
        expect(byId.get(id)).toMatchObject({
          supportsEmbeddings: true, supportsStreaming: false, supportsTools: false
        });
      }
      for (const id of ['plain-instruct', 'plain-chat', 'plain-tool', 'plain-hermes', 'llama3-8b-chat']) {
        expect(byId.get(id)?.supportsTools).toBe(true);
      }
    });

    it('covers alternate network and HTTP degradation codes plus the unreachable fallback', async () => {
      const cases = [
        [{ code: 'ENOTFOUND', message: 'dns' }, 'startup_unavailable'],
        [{ response: { status: 429 }, message: 'rate limited' }, 'overloaded'],
        [{ response: { status: 403 }, message: 'forbidden' }, 'incompatible'],
        [{ response: { status: 405 }, message: 'method' }, 'version_mismatch'],
        [{ message: 'socket reset' }, 'unreachable']
      ] as const;
      for (const [failure, expected] of cases) {
        mockedAxios.create.mockReturnValue({ get: jest.fn().mockRejectedValue(failure) } as any);
        const result = await new LocalModelDiscovery().probeEndpoint('http://127.0.0.1:8080', { cacheTtlMs: 0 });
        expect(result.health).toBe(expected);
      }
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

    it('exposes normalized configuration, probe status, auth, and request options', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: { choices: [{ text: 'plain completion' }] }
      });
      mockedAxios.create.mockReturnValue({ post: mockPost } as any);
      const adapter = new ExternalLocalModelAdapter({
        baseUrl: 'http://127.0.0.1:8080/', model: 'default', providerName: 'custom',
        apiKey: 'local-key', timeoutMs: 9000, maxRetries: 0
      });
      jest.spyOn((adapter as any).discovery, 'probeEndpoint').mockResolvedValue({ healthy: true });

      expect(adapter.getModelName()).toBe('custom:default');
      expect(adapter.getProviderName()).toBe('custom');
      expect(adapter.getBaseUrl()).toBe('http://127.0.0.1:8080');
      expect(adapter.estimateCost({ prompt: 'x' })).toBe(0);
      await expect(adapter.probe()).resolves.toEqual({ healthy: true });
      const response = await adapter.generate({
        prompt: 'hello', systemPrompt: 'system', model: 'override', temperature: 0, maxTokens: 0
      }, { requestId: 'fixed-request' });
      expect(response).toMatchObject({ content: 'plain completion', model: 'custom:override' });
      expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({
        timeout: 9000,
        headers: expect.objectContaining({ Authorization: 'Bearer local-key' })
      }));
      expect(mockPost).toHaveBeenCalledWith('/chat/completions', expect.objectContaining({
        temperature: 0, max_tokens: 0,
        messages: [{ role: 'system', content: 'system' }, { role: 'user', content: 'hello' }]
      }), expect.any(Object));
    });

    it('falls back to the prefixed chat endpoint after an unprefixed 404', async () => {
      const missing = Object.assign(new Error('missing'), { response: { status: 404 } });
      const mockPost = jest.fn()
        .mockRejectedValueOnce(missing)
        .mockResolvedValueOnce({ data: { choices: [{ message: { content: '' } }], usage: { total_tokens: 0 } } });
      mockedAxios.create.mockReturnValue({ post: mockPost } as any);
      const adapter = new ExternalLocalModelAdapter({ baseUrl: 'http://localhost:8080', model: 'model', maxRetries: 0 });

      await expect(adapter.generate({ prompt: 'fallback' })).resolves.toMatchObject({ content: '' });
      expect(mockPost.mock.calls.map(call => call[0])).toEqual(['/chat/completions', '/v1/chat/completions']);
    });

    it('does not retry client errors or aborted requests and always releases leases', async () => {
      const clientError = Object.assign(new Error('bad request'), { response: { status: 400 } });
      const mockPost = jest.fn().mockRejectedValue(clientError);
      mockedAxios.create.mockReturnValue({ post: mockPost } as any);
      const adapter = new ExternalLocalModelAdapter({ baseUrl: 'http://localhost:8080/v1', model: 'model', maxRetries: 2 });
      await expect(adapter.generate({ prompt: 'bad' })).rejects.toBe(clientError);
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(adapter.getResourceMetrics().activeRequests).toBe(0);

      const controller = new AbortController();
      controller.abort();
      await expect(adapter.generate({ prompt: 'abort' }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('retries server failures and surfaces the final error', async () => {
      jest.useFakeTimers();
      const serverError = Object.assign(new Error('server down'), { response: { status: 500 } });
      const mockPost = jest.fn().mockRejectedValue(serverError);
      mockedAxios.create.mockReturnValue({ post: mockPost } as any);
      const adapter = new ExternalLocalModelAdapter({ baseUrl: 'http://localhost:8080/v1', model: 'model', maxRetries: 1 });
      const pending = adapter.generate({ prompt: 'retry' });
      const rejection = expect(pending).rejects.toBe(serverError);
      await jest.advanceTimersByTimeAsync(200);
      await rejection;
      expect(mockPost).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
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

    it('handles split, blank, and trailing stream frames', async () => {
      const streamEmitter = new EventEmitter();
      mockedAxios.create.mockReturnValue({ post: jest.fn().mockResolvedValue({ data: streamEmitter }) } as any);
      const adapter = new ExternalLocalModelAdapter({ baseUrl: 'http://localhost:8080/v1', model: 'stream' });
      const chunks: string[] = [];
      const pending = adapter.generateStream({ prompt: 'x', systemPrompt: 's', temperature: 0, maxTokens: 0 }, chunk => chunks.push(chunk));
      setTimeout(() => {
        streamEmitter.emit('data', Buffer.from('event: message\ndata: \n\ndata: {"choices":[{"delta":{}}]}\n'));
        streamEmitter.emit('data', Buffer.from('data: {"choices":[{"delta":{"content":"tail"}}]}'));
        streamEmitter.emit('end');
      }, 0);
      await expect(pending).resolves.toMatchObject({ content: 'tail', model: 'local-openai:stream' });
      expect(chunks).toEqual(['tail']);
    });

    it('rejects invalid stream JSON and transport errors', async () => {
      const invalidStream = new EventEmitter() as EventEmitter & { destroy: jest.Mock };
      invalidStream.destroy = jest.fn();
      const errorStream = new EventEmitter();
      const mockPost = jest.fn()
        .mockResolvedValueOnce({ data: invalidStream })
        .mockResolvedValueOnce({ data: errorStream });
      mockedAxios.create.mockReturnValue({ post: mockPost } as any);
      const adapter = new ExternalLocalModelAdapter({ baseUrl: 'http://localhost:8080/v1', model: 'stream' });

      const invalid = adapter.generateStream({ prompt: 'x' }, jest.fn());
      setTimeout(() => invalidStream.emit('data', Buffer.from('data: {invalid}\n')), 0);
      await expect(invalid).rejects.toThrow('Invalid SSE payload');
      expect(invalidStream.destroy).toHaveBeenCalled();

      const transport = adapter.generateStream({ prompt: 'x' }, jest.fn());
      setTimeout(() => errorStream.emit('error', new Error('stream closed')), 0);
      await expect(transport).rejects.toThrow('stream closed');
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

    it('uses embedding defaults when the endpoint omits data and usage', async () => {
      mockedAxios.create.mockReturnValue({ post: jest.fn().mockResolvedValue({ data: {} }) } as any);
      const adapter = new ExternalLocalModelAdapter({ baseUrl: 'http://localhost:8080/v1', model: 'chat' });
      await expect(adapter.getEmbeddings(['one', 'two'], { model: 'embed-2' })).resolves.toEqual({
        embeddings: [], model: 'embed-2', tokensUsed: 0
      });
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

    it('selects a supported strict-local candidate', () => {
      const policy = new LocalModelRoutingPolicy();
      policy.registerCandidate({ ...localCoder, adapter: {} as any });
      const decision = policy.route({ prompt: 'private', privacyMode: 'strict_local' });
      expect(decision).toMatchObject({ providerId: 'local-warpdrv', supported: true, confidence: 0.95 });
    });

    it.each([
      ['context', { minContextTokens: 200000 }],
      ['structured output', { requiresStructuredOutput: true }],
      ['tools', { requiresTools: true }],
      ['vision', { requiresVision: true }],
      ['embeddings', { requiresEmbeddings: true }],
      ['latency', { maxLatencyMs: 50 }],
      ['cost', { maxCost: 0.0001 }]
    ])('falls back when the only candidate violates the %s constraint', (_name, constraint) => {
      const policy = new LocalModelRoutingPolicy({ defaultPrivacyMode: 'cloud_allowed' });
      policy.registerCandidate({
        ...cloudGpt4,
        structuredOutput: false,
        toolCalling: false,
        vision: false,
        embeddings: false
      });
      expect(policy.route({ prompt: 'x', ...constraint }).providerId).toBe('template');
    });

    it('replaces and unregisters candidates while returning defensive list copies', () => {
      const policy = new LocalModelRoutingPolicy();
      policy.registerCandidate(localCoder);
      policy.registerCandidate({ ...localCoder, qualityScore: 0.5 });
      const listed = policy.listCandidates();
      expect(listed).toHaveLength(1);
      expect(listed[0].qualityScore).toBe(0.5);
      listed.length = 0;
      expect(policy.listCandidates()).toHaveLength(1);
      policy.unregisterProvider('local-warpdrv');
      expect(policy.listCandidates()).toEqual([]);
    });

    it('sorts deterministically by quality, latency, cost, then provider name', () => {
      const select = (candidates: RoutingCandidate[]) => {
        const policy = new LocalModelRoutingPolicy({ defaultPrivacyMode: 'cloud_allowed' });
        candidates.forEach(candidate => policy.registerCandidate(candidate));
        return policy.route({ prompt: 'x' }).providerId;
      };
      const base = { ...cloudGpt4, qualityScore: 0.9, latencyMs: 100, costPer1kTokens: 0.001 };
      expect(select([{ ...base, provider: 'low' }, { ...base, provider: 'high', qualityScore: 0.96 }])).toBe('high');
      expect(select([{ ...base, provider: 'slow', latencyMs: 200 }, { ...base, provider: 'fast' }])).toBe('fast');
      expect(select([{ ...base, provider: 'costly', costPer1kTokens: 0.002 }, { ...base, provider: 'cheap' }])).toBe('cheap');
      expect(select([{ ...base, provider: 'zeta' }, { ...base, provider: 'alpha' }])).toBe('alpha');
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
