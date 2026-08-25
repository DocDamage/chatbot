import axios from 'axios';
import {
  AgentProvider,
  MultiAgentOrchestrator,
  autoRegisterProviders,
  bridgeLLMAdapter,
  createCerebrasProvider,
  createClaudeProvider,
  createCohereProvider,
  createDeepSeekProvider,
  createFullOrchestrator,
  createGeminiProvider,
  createGroqProvider,
  createHuggingFaceProvider,
  createMistralProvider,
  createOllamaProvider,
  createOpenAIProvider,
  createOpenRouterProvider,
  createTogetherProvider,
  getFreeLLMProviders
} from './MultiAgentOrchestrator';

const mockOpenAICreate = jest.fn();
const mockClaudeCreate = jest.fn();
const mockGeminiGenerate = jest.fn();

jest.mock('axios');
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } }
  }))
}));
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ messages: { create: mockClaudeCreate } }))
}));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({ generateContent: mockGeminiGenerate })
  }))
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

const provider = (
  id: string,
  content: string,
  options: Partial<AgentProvider> & { error?: Error } = {}
): AgentProvider => ({
  id,
  name: options.name || id,
  specialties: options.specialties || ['general'],
  priority: options.priority ?? 1,
  execute: options.error
    ? jest.fn().mockRejectedValue(options.error)
    : jest.fn().mockResolvedValue({
      content,
      provider: id,
      latency: 1,
      confidence: options.priority ? 0.8 : undefined,
      reasoning: options.name
    }),
  ...options
});

describe('MultiAgentOrchestrator', () => {
  const envKeys = [
    'OLLAMA_URL', 'HUGGINGFACE_API_KEY', 'OPENAI_API_KEY', 'OPENAI_MODEL',
    'ANTHROPIC_API_KEY', 'CLAUDE_MODEL', 'GOOGLE_API_KEY', 'GEMINI_API_KEY',
    'GEMINI_MODEL', 'GROQ_API_KEY', 'GROQ_MODEL', 'COHERE_API_KEY', 'COHERE_MODEL',
    'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL',
    'CEREBRAS_API_KEY', 'CEREBRAS_MODEL'
  ];

  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
    envKeys.forEach(key => delete process.env[key]);
  });

  it('registers, lists, replaces, and unregisters providers', () => {
    const orchestrator = new MultiAgentOrchestrator({ timeout: 50 });
    orchestrator.registerProvider(provider('one', 'first'));
    orchestrator.registerProvider(provider('one', 'replacement'));
    expect(orchestrator.getProviders()).toHaveLength(1);
    expect(orchestrator.unregisterProvider('missing')).toBe(false);
    expect(orchestrator.unregisterProvider('one')).toBe(true);
  });

  it('rejects empty and unknown orchestration modes', async () => {
    const orchestrator = new MultiAgentOrchestrator();
    await expect(orchestrator.execute('x', { mode: 'consensus' })).rejects.toThrow('No providers');
    await expect(orchestrator.execute('x', { mode: 'race' })).rejects.toThrow('No providers');
    await expect(orchestrator.execute('x', { mode: 'specialist' })).rejects.toThrow('No provider');
    await expect(orchestrator.execute('x', { mode: 'invalid' as any })).rejects.toThrow('Unknown orchestration mode');
  });

  it('returns single-provider consensus with and without reasoning', async () => {
    const orchestrator = new MultiAgentOrchestrator({ mode: 'consensus' });
    orchestrator.registerProvider(provider('plain', 'answer'));
    await expect(orchestrator.execute('x')).resolves.toMatchObject({
      finalAnswer: 'answer', agreement: 1, reasoning: []
    });

    orchestrator.registerProvider(provider('plain', 'reasoned', { name: 'because' }));
    await expect(orchestrator.execute('x')).resolves.toMatchObject({ reasoning: ['because'] });
  });

  it('votes across successful providers and ignores failures', async () => {
    const orchestrator = new MultiAgentOrchestrator();
    orchestrator.registerProvider(provider('a', 'same useful answer', { priority: 3, name: 'reason-a' }));
    orchestrator.registerProvider(provider('b', 'same useful result', { priority: 2 }));
    orchestrator.registerProvider(provider('failed', '', { error: new Error('offline') }));
    const result = await orchestrator.execute('compare', { mode: 'consensus', minAgreement: 0.99 });
    expect(result).toMatchObject({ finalAnswer: expect.any(String), agreement: expect.any(Number) });
    expect((result as any).votes).toHaveLength(2);
    expect((result as any).reasoning).toEqual(['a: reason-a']);
  });

  it('rejects consensus when every provider fails', async () => {
    const orchestrator = new MultiAgentOrchestrator();
    orchestrator.registerProvider(provider('failed', '', { error: new Error('offline') }));
    await expect(orchestrator.execute('x')).rejects.toThrow('No responses received');
  });

  it('supports parallel responses including an empty result set', async () => {
    const orchestrator = new MultiAgentOrchestrator();
    await expect(orchestrator.execute('x', { mode: 'parallel' })).resolves.toMatchObject({
      finalAnswer: '', votes: [], agreement: 1
    });
    orchestrator.registerProvider(provider('one', 'parallel', { name: 'trace' }));
    await expect(orchestrator.execute('x', { mode: 'parallel' })).resolves.toMatchObject({
      finalAnswer: 'parallel', reasoning: ['one: trace']
    });
  });

  it('returns the race winner and rejects when all racers fail', async () => {
    const orchestrator = new MultiAgentOrchestrator();
    orchestrator.registerProvider(provider('fast', 'winner'));
    orchestrator.registerProvider(provider('failed', '', { error: new Error('offline') }));
    await expect(orchestrator.execute('x', { mode: 'race' })).resolves.toMatchObject({ content: 'winner' });

    const failed = new MultiAgentOrchestrator();
    failed.registerProvider(provider('a', '', { error: new Error('a') }));
    failed.registerProvider(provider('b', '', { error: new Error('b') }));
    await expect(failed.execute('x', { mode: 'race' })).rejects.toThrow('All providers failed in race mode');
  });

  it('enforces provider timeouts', async () => {
    jest.useFakeTimers();
    const orchestrator = new MultiAgentOrchestrator();
    orchestrator.registerProvider({
      ...provider('hung', ''),
      execute: jest.fn(() => new Promise(() => undefined))
    });
    const result = orchestrator.execute('x', { mode: 'race', timeout: 5 });
    const rejection = expect(result).rejects.toThrow('All providers failed');
    await jest.advanceTimersByTimeAsync(5);
    await rejection;
  });

  it.each([
    ['code in javascript', 'coding'],
    ['calculate math', 'reasoning'],
    ['write a story', 'creative'],
    ['research and summarize', 'research'],
    ['explain this', 'general'],
    ['unclassified request', 'fallback']
  ])('routes specialist prompt %s to the best provider', async (promptText, specialty) => {
    const orchestrator = new MultiAgentOrchestrator();
    orchestrator.registerProvider(provider('general', 'fallback', { specialties: ['general'], priority: 1 }));
    if (specialty !== 'fallback') {
      orchestrator.registerProvider(provider('specialist', specialty, { specialties: [specialty], priority: 5 }));
    }
    const result = await orchestrator.execute(promptText, { mode: 'specialist', timeout: 50 });
    expect((result as any).content).toBe(specialty === 'fallback' ? 'fallback' : specialty);
  });

  it('bridges adapters with defaults, custom configuration, and token estimates', async () => {
    const adapter = {
      getModelName: () => 'Vendor/Model 1',
      generate: jest.fn()
        .mockResolvedValueOnce({ content: 'with tokens', tokensUsed: 10 })
        .mockResolvedValueOnce({ content: 'without tokens' })
    };
    const defaults = bridgeLLMAdapter(adapter);
    expect(defaults).toMatchObject({ id: 'vendor-model-1', name: 'Vendor/Model 1', specialties: ['general'], priority: 1 });
    await expect(defaults.execute('x', { temperature: 0, maxTokens: 0 })).resolves.toMatchObject({
      tokens: { input: 3, output: 7 }
    });
    const custom = bridgeLLMAdapter(adapter, { id: 'id', name: 'name', specialties: ['coding'], priority: 4 });
    await expect(custom.execute('x')).resolves.toMatchObject({ content: 'without tokens', tokens: undefined });
  });

  it('executes SDK-backed OpenAI, Claude, and Gemini providers with complete and sparse responses', async () => {
    mockOpenAICreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'openai' } }], usage: { prompt_tokens: 2, completion_tokens: 3 } })
      .mockResolvedValueOnce({ choices: [], usage: undefined });
    mockClaudeCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'claude' }], usage: { input_tokens: 4, output_tokens: 5 } })
      .mockResolvedValueOnce({ content: [{ type: 'tool_use' }], usage: undefined });
    mockGeminiGenerate.mockResolvedValue({ response: { text: () => 'gemini' } });

    await expect(createOpenAIProvider('key').execute('x', { maxTokens: 0, temperature: 0 })).resolves.toMatchObject({ content: 'openai' });
    await expect(createOpenAIProvider('key', 'custom').execute('x')).resolves.toMatchObject({ content: '', tokens: { input: 0, output: 0 } });
    await expect(createClaudeProvider('key').execute('x', { maxTokens: 0 })).resolves.toMatchObject({ content: 'claude' });
    await expect(createClaudeProvider('key', 'custom').execute('x')).resolves.toMatchObject({ content: '', tokens: { input: 0, output: 0 } });
    await expect(createGeminiProvider('key').execute('x')).resolves.toMatchObject({ content: 'gemini' });
  });

  it('executes every HTTP provider with explicit options and response shapes', async () => {
    mockedAxios.post.mockImplementation(async (url: string) => {
      if (url.includes('/api/generate')) return { data: { response: 'ollama', prompt_eval_count: 1, eval_count: 2 } } as any;
      if (url.includes('huggingface')) return { data: [{ generated_text: 'hf' }] } as any;
      if (url.includes('cohere')) return { data: { text: 'cohere' } } as any;
      return { data: { choices: [{ message: { content: 'chat' } }], usage: { prompt_tokens: 1, completion_tokens: 2 } } } as any;
    });
    const providers = [
      createOllamaProvider(),
      createHuggingFaceProvider('key'),
      createGroqProvider('key'),
      createCohereProvider('key'),
      createDeepSeekProvider('key'),
      createOpenRouterProvider('key'),
      createCerebrasProvider('key'),
      createTogetherProvider('key'),
      createMistralProvider('key')
    ];
    const results = await Promise.all(providers.map(item => item.execute('prompt', {
      maxTokens: 0, temperature: 0, timeout: 1
    })));
    expect(results.map(result => result.content)).toEqual([
      'ollama', 'hf', 'chat', 'cohere', 'chat', 'chat', 'chat', 'chat', 'chat'
    ]);
  });

  it('covers sparse HTTP responses, defaults, HuggingFace objects, and provider errors', async () => {
    mockedAxios.post.mockResolvedValue({ data: { choices: [], usage: {} } } as any);
    await expect(createOllamaProvider('http://localhost', 'custom').execute('x')).resolves.toMatchObject({
      content: '', tokens: { input: 0, output: 0 }
    });
    await expect(createGroqProvider('key', 'custom').execute('x')).resolves.toMatchObject({ content: '', tokens: { input: 0, output: 0 } });
    await expect(createCohereProvider('key', 'custom').execute('x')).resolves.toMatchObject({ content: '' });
    await expect(createDeepSeekProvider('key', 'custom').execute('x')).resolves.toMatchObject({ content: '', tokens: { input: 0, output: 0 } });
    await expect(createOpenRouterProvider('key', 'vendor/model:free').execute('x')).resolves.toMatchObject({ content: '' });
    await expect(createCerebrasProvider('key', 'custom').execute('x')).resolves.toMatchObject({ content: '' });
    await expect(createTogetherProvider('key', 'vendor/custom').execute('x')).resolves.toMatchObject({ content: '' });
    await expect(createMistralProvider('key', 'custom').execute('x')).resolves.toMatchObject({ content: '' });

    mockedAxios.post.mockResolvedValueOnce({ data: { generated_text: 'object-hf' } } as any);
    await expect(createHuggingFaceProvider(undefined, 'single-name').execute('x')).resolves.toMatchObject({ content: 'object-hf' });

    mockedAxios.post.mockRejectedValue(new Error('network'));
    await expect(createOllamaProvider().execute('x')).rejects.toThrow('Ollama');
    await expect(createHuggingFaceProvider().execute('x')).rejects.toThrow('HuggingFace');
  });

  it('auto-registers discovered and configured providers with explicit model settings', async () => {
    mockedAxios.get.mockResolvedValue({ data: { models: [{ name: 'one' }, { name: 'two' }, { name: 'three' }, { name: 'ignored' }] } } as any);
    Object.assign(process.env, {
      OLLAMA_URL: 'http://localhost:11434', HUGGINGFACE_API_KEY: 'hf',
      OPENAI_API_KEY: 'oa', OPENAI_MODEL: 'oa-model', ANTHROPIC_API_KEY: 'an', CLAUDE_MODEL: 'claude-model',
      GOOGLE_API_KEY: 'google', GEMINI_MODEL: 'gemini-model', GROQ_API_KEY: 'groq', GROQ_MODEL: 'groq-model',
      COHERE_API_KEY: 'cohere', COHERE_MODEL: 'cohere-model', DEEPSEEK_API_KEY: 'deep', DEEPSEEK_MODEL: 'deep-model',
      OPENROUTER_API_KEY: 'router', OPENROUTER_MODEL: 'vendor/free:free', CEREBRAS_API_KEY: 'cerebras', CEREBRAS_MODEL: 'c-model'
    });
    const orchestrator = new MultiAgentOrchestrator();
    const result = await autoRegisterProviders(orchestrator);
    expect(result.failed).toEqual([]);
    expect(result.registered).toHaveLength(12);
    expect(orchestrator.getProviders()).toHaveLength(12);
  });

  it('registers default Ollama when no models exist and reports an unavailable service', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { models: [] } } as any);
    const available = await autoRegisterProviders(new MultiAgentOrchestrator());
    expect(available.registered).toEqual(['ollama-llama2', 'huggingface-Mistral-7B-Instruct-v0.2']);

    mockedAxios.get.mockRejectedValueOnce(new Error('offline'));
    const unavailable = await autoRegisterProviders(new MultiAgentOrchestrator());
    expect(unavailable.failed).toEqual(['ollama']);
    expect(unavailable.registered).toEqual(['huggingface-Mistral-7B-Instruct-v0.2']);
  });

  it('creates a full orchestrator and publishes the free-provider catalog', async () => {
    mockedAxios.get.mockRejectedValue(new Error('offline'));
    const orchestrator = await createFullOrchestrator({ mode: 'parallel' });
    expect(orchestrator.getProviders().map(item => item.id)).toEqual(['huggingface-Mistral-7B-Instruct-v0.2']);
    expect(getFreeLLMProviders()).toHaveLength(10);
  });
});
