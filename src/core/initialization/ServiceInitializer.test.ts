import fs from 'fs';
import os from 'os';
import path from 'path';
import { ServiceInitializer, InitializationStatus } from './ServiceInitializer';

describe('ServiceInitializer optional startup work', () => {
  const originalKnowledgeBaseDir = process.env.KNOWLEDGE_BASE_DIR;

  afterEach(() => {
    if (originalKnowledgeBaseDir === undefined) {
      delete process.env.KNOWLEDGE_BASE_DIR;
    } else {
      process.env.KNOWLEDGE_BASE_DIR = originalKnowledgeBaseDir;
    }
  });

  it('does not create placeholder knowledge-base files during startup', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-kb-'));
    const missingKb = path.join(root, 'knowledge-base');
    process.env.KNOWLEDGE_BASE_DIR = missingKb;
    const documentManager = { addDirectory: jest.fn() };

    await (ServiceInitializer as any).loadKnowledgeBase(documentManager);

    expect(fs.existsSync(missingKb)).toBe(false);
    expect(documentManager.addDirectory).not.toHaveBeenCalled();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('tracks optional initialization success and failure without throwing', async () => {
    const initialization: InitializationStatus = {
      criticalStartedAt: new Date().toISOString(),
      optional: {
        success: { status: 'pending' },
        failure: { status: 'pending' }
      }
    };

    await (ServiceInitializer as any).trackOptionalInitialization(initialization, 'success', async () => {});
    await (ServiceInitializer as any).trackOptionalInitialization(initialization, 'failure', async () => {
      throw new Error('background load failed');
    });

    expect(initialization.optional.success.status).toBe('ready');
    expect(initialization.optional.failure.status).toBe('failed');
    expect(initialization.optional.failure.error).toBe('background load failed');
  });
});

describe('ServiceInitializer configuration branches', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('selects template and configured LLM providers without contacting them', async () => {
    process.env.USE_OLLAMA = 'false';
    process.env.USE_HUGGINGFACE = 'false';
    delete process.env.LLM_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const template = await (ServiceInitializer as any).initializeLLMAdapters();
    expect(template.primary.getModelName()).toBe('template');

    process.env.LLM_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    const gemini = await (ServiceInitializer as any).initializeLLMAdapters();
    expect(Object.keys(gemini.all)).toContain('google');

    process.env.LLM_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    const anthropic = await (ServiceInitializer as any).initializeLLMAdapters();
    expect(Object.keys(anthropic.all)).toContain('anthropic');

    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const openai = await (ServiceInitializer as any).initializeLLMAdapters();
    expect(Object.keys(openai.all)).toContain('openai');

    process.env.LLM_PROVIDER = 'openai-compatible';
    process.env.OPENAI_COMPATIBLE_API_KEY = 'compatible-key';
    process.env.OPENAI_COMPATIBLE_BASE_URL = 'http://localhost:9999/v1';
    const compatible = await (ServiceInitializer as any).initializeLLMAdapters();
    expect(Object.keys(compatible.all)).toContain('openai');
  });

  it('initializes optional Hugging Face and Ollama adapters when enabled', async () => {
    process.env.USE_OLLAMA = 'true';
    process.env.USE_HUGGINGFACE = 'true';
    process.env.LLM_PROVIDER = 'ollama';
    const adapters = await (ServiceInitializer as any).initializeLLMAdapters();
    expect(Object.keys(adapters.all)).toEqual(expect.arrayContaining(['ollama', 'huggingface']));
  });

  it('covers database, model router, RAG, cache, safety, and vision helper branches', async () => {
    process.env.RAG_PERSISTENCE = 'false';
    expect(await (ServiceInitializer as any).initializeDatabase()).toBeUndefined();
    const router = (ServiceInitializer as any).initializeModelRouter({ openai: { getModelName: () => 'alpha' } });
    expect(router.getAvailableModels().length).toBeGreaterThan(0);
    const rag = (ServiceInitializer as any).initializeRAGService({}, {});
    expect(rag).toBeDefined();
    expect((ServiceInitializer as any).initializeSafetyPipeline({}, undefined)).toBeDefined();

    process.env.ENABLE_DISK_CACHE = 'false';
    process.env.ENABLE_REDIS_CACHE = 'false';
    expect((ServiceInitializer as any).initializeCache().getStats().levels).toEqual(['memory']);

    delete process.env.USE_LLAVA;
    delete process.env.USE_GEMINI_VISION;
    delete process.env.USE_GPT4V;
    expect((ServiceInitializer as any).initializeVisionAdapter()).toBeUndefined();
    process.env.USE_LLAVA = 'true';
    expect((ServiceInitializer as any).initializeVisionAdapter()).toBeDefined();
    delete process.env.USE_LLAVA;
    process.env.USE_GEMINI_VISION = 'true';
    process.env.GEMINI_API_KEY = 'vision-key';
    expect((ServiceInitializer as any).initializeVisionAdapter()).toBeDefined();
    delete process.env.USE_GEMINI_VISION;
    process.env.USE_GPT4V = 'true';
    process.env.OPENAI_API_KEY = 'vision-key';
    expect((ServiceInitializer as any).initializeVisionAdapter()).toBeDefined();
  });

  it('loads knowledge directories, counts nested files, and handles failures safely', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'initializer-'));
    const kb = path.join(root, 'kb');
    const publicKb = path.join(root, 'public');
    fs.mkdirSync(kb);
    fs.mkdirSync(publicKb);
    const manager = { addDirectory: jest.fn().mockResolvedValue(undefined) };

    fs.writeFileSync(path.join(kb, 'one.md'), 'one');
    fs.mkdirSync(path.join(publicKb, 'nested'));
    fs.writeFileSync(path.join(publicKb, 'nested', 'two.md'), 'two');
    process.env.KNOWLEDGE_BASE_DIR = kb;
    process.env.PUBLIC_KNOWLEDGE_BASE_DIR = publicKb;
    await (ServiceInitializer as any).loadKnowledgeBase(manager);
    await (ServiceInitializer as any).loadPublicKnowledgeBase(manager);
    expect(manager.addDirectory).toHaveBeenCalledTimes(2);
    expect((ServiceInitializer as any).countFiles(publicKb)).toBe(1);

    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty);
    process.env.KNOWLEDGE_BASE_DIR = empty;
    await (ServiceInitializer as any).loadKnowledgeBase(manager);
    const notDirectory = path.join(root, 'file');
    fs.writeFileSync(notDirectory, 'file');
    process.env.KNOWLEDGE_BASE_DIR = notDirectory;
    await (ServiceInitializer as any).loadKnowledgeBase(manager);
    const failingManager = { addDirectory: jest.fn().mockRejectedValue(new Error('load failed')) };
    process.env.KNOWLEDGE_BASE_DIR = kb;
    await expect((ServiceInitializer as any).loadKnowledgeBase(failingManager)).resolves.toBeUndefined();

    const initialization: any = { optional: { skipped: { status: 'pending' } } };
    (ServiceInitializer as any).markOptionalSkipped(initialization, 'skipped');
    expect(initialization.optional.skipped.status).toBe('skipped');
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('runs full ServiceInitializer.initialize() with eager knowledge loading and database', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-init-full-'));
    const dbPath = path.join(tempDir, 'init_test.db');
    process.env.DATABASE_URL = `sqlite://${dbPath}`;
    process.env.RAG_PERSISTENCE = 'true';
    process.env.EAGER_KNOWLEDGE_LOAD = 'true';
    process.env.RAG_RETRIEVAL_MODE = 'database';
    process.env.RAG_RESTORE_PERSISTED_TO_MEMORY = 'true';
    process.env.USE_OLLAMA = 'false';
    process.env.USE_HUGGINGFACE = 'false';

    const services = await ServiceInitializer.initialize();
    expect(services.orchestrator).toBeDefined();
    expect(services.toolRegistry).toBeDefined();
    expect(services.codingAgent).toBeDefined();
    expect(services.mathGeniusAgent).toBeDefined();
    expect(services.marketGeniusAgent).toBeDefined();
    expect(services.sixSigmaBlackBeltAgent).toBeDefined();
    expect(services.sixSigmaBlackBeltAgent).toBeDefined();
    expect(services.storyGeniusAgent).toBeDefined();
    expect(services.musicProductionGeniusAgent).toBeDefined();
    expect(services.cache).toBeDefined();
    expect(services.initialization?.criticalStartedAt).toBeDefined();

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('runs full ServiceInitializer.initialize() with background knowledge loading', async () => {
    process.env.RAG_PERSISTENCE = 'false';
    process.env.BACKGROUND_KNOWLEDGE_LOAD = 'true';
    delete process.env.EAGER_KNOWLEDGE_LOAD;
    delete process.env.LLM_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.USE_OLLAMA = 'false';
    process.env.USE_HUGGINGFACE = 'false';

    const services = await ServiceInitializer.initialize();
    expect(services.orchestrator).toBeDefined();
    expect(services.modelRouter).toBeDefined();
  });
});
