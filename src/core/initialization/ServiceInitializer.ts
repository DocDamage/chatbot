/**
 * Service Initializer - Auto-loads all services on application start
 */

import { logger } from '../observability/logger';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { RAGService } from '../rag/RAGService';
import { DocumentManager } from '../rag/DocumentManager';
import { AnalyticsService } from '../analytics/AnalyticsService';
import { ModelRouter, ModelProvider } from '../providers/ModelRouter';
import { AnthropicAdapter, GeminiAdapter, OpenAIAdapter, OpenAICompatibleAdapter } from '../providers/LLMAdapter';
import { OllamaAdapter } from '../providers/OllamaAdapter';
import { HuggingFaceAdapter } from '../providers/HuggingFaceAdapter';
import { EnsembleAdapter } from '../providers/EnsembleAdapter';
import { SafetyPipeline } from '../safety/SafetyPipeline';
import { SemanticCache } from '../cache/SemanticCache';
import { MultiLevelCache } from '../cache/MultiLevelCache';
import { EnhancedOrchestrator } from '../orchestrator/EnhancedOrchestrator';
import { GPT4VAdapter, GeminiVisionAdapter, LLaVAAdapter } from '../providers/VisionAdapter';
import { ToolRegistry } from '../tools/ToolRegistry';
import { CodeExecutor } from '../tools/CodeExecutor';
import { WebSearcher } from '../tools/WebSearcher';
import { FunctionCaller } from '../tools/FunctionCaller';
import { CodingKnowledgeBase } from '../knowledge/CodingKnowledgeBase';
import { CodingKnowledgeTool } from '../tools/CodingKnowledgeTool';
import { PersonalKnowledgeTool } from '../tools/PersonalKnowledgeTool';
import { KnowledgeLearner } from '../learning/KnowledgeLearner';
import * as fs from 'fs';
import * as path from 'path';

export interface InitializedServices {
  orchestrator: EnhancedOrchestrator;
  ragService?: RAGService;
  documentManager?: DocumentManager;
  modelRouter?: ModelRouter;
  toolRegistry?: ToolRegistry;
  visionAdapter?: any;
  embeddingService?: EmbeddingService;
  cache?: MultiLevelCache<any>;
  analytics?: AnalyticsService;
  knowledgeLearner?: KnowledgeLearner;
}

export class ServiceInitializer {
  /**
   * Initialize all services automatically
   */
  static async initialize(): Promise<InitializedServices> {
    logger.info('Starting service initialization...');

    // 1. Initialize Embedding Service
    const embeddingService = this.initializeEmbeddingService();
    logger.info('Embedding service initialized', {
      provider: process.env.EMBEDDING_PROVIDER || 'xenova'
    });

    // 2. Initialize LLM Adapters
    const llmAdapters = await this.initializeLLMAdapters();
    const primaryAdapter = llmAdapters.primary;
    logger.info('LLM adapters initialized', {
      primary: primaryAdapter.getModelName(),
      available: Object.keys(llmAdapters.all).length
    });

    // 3. Initialize Model Router
    const modelRouter = this.initializeModelRouter(llmAdapters.all);
    logger.info('Model router initialized', {
      modelsCount: modelRouter.getAvailableModels().length
    });

    // 4. Initialize RAG Service
    const ragService = this.initializeRAGService(primaryAdapter, embeddingService);
    const documentManager = new DocumentManager(ragService, embeddingService);

    // 5. Load knowledge base documents
    await this.loadKnowledgeBase(documentManager);
    logger.info('RAG service initialized');

    // 6. Initialize Safety Pipeline
    const safetyPipeline = this.initializeSafetyPipeline(primaryAdapter, ragService);
    logger.info('Safety pipeline initialized');

    // 7. Initialize Caching
    const cache = this.initializeCache();
    logger.info('Cache initialized', {
      levels: cache.getStats().levels
    });

    // 8. Initialize Vision Adapter
    const visionAdapter = this.initializeVisionAdapter();
    if (visionAdapter) {
      logger.info('Vision adapter initialized', {
        type: visionAdapter.constructor.name
      });
    }

    // 9. Initialize Tools & Coding Knowledge
    const { toolRegistry, knowledgeLearner } = await this.initializeTools(embeddingService);
    logger.info('Tools initialized', {
      toolsCount: toolRegistry.getStats().totalTools,
      learner: !!knowledgeLearner
    });

    // 10. Initialize Enhanced Orchestrator
    const orchestrator = new EnhancedOrchestrator(
      primaryAdapter,
      visionAdapter,
      {
        useRAG: process.env.ENABLE_RAG !== 'false',
        useModelRouting: process.env.ENABLE_MODEL_ROUTING !== 'false',
        useEnsemble: process.env.ENABLE_ENSEMBLE === 'true',
        useSafetyPipeline: process.env.ENABLE_SAFETY_PIPELINE !== 'false',
        useSemanticCache: process.env.ENABLE_SEMANTIC_CACHE !== 'false',
        ragService: ragService,
        modelRouter: modelRouter,
        safetyPipeline: safetyPipeline,
        semanticCache: new SemanticCache<any>(
          parseInt(process.env.SEMANTIC_CACHE_TTL || '3600'),
          parseFloat(process.env.SEMANTIC_CACHE_SIMILARITY_THRESHOLD || '0.7')
        )
      }
    );

    // 11. Initialize Analytics Service
    const analytics = new AnalyticsService();
    logger.info('Analytics service initialized');

    logger.info('✅ All services initialized successfully');

    return {
      orchestrator,
      ragService,
      documentManager,
      modelRouter,
      toolRegistry,
      visionAdapter,
      embeddingService,
      cache,
      analytics,
      knowledgeLearner
    };
  }

  /**
   * Initialize embedding service
   */
  private static initializeEmbeddingService(): EmbeddingService {
    const provider = (process.env.EMBEDDING_PROVIDER || 'xenova') as 'openai' | 'xenova' | 'ollama';
    const model = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';

    return new EmbeddingService(
      process.env.OPENAI_API_KEY,
      process.env.OLLAMA_URL || 'http://localhost:11434',
      provider,
      model
    );
  }

  /**
   * Initialize all LLM adapters
   */
  private static async initializeLLMAdapters(): Promise<{
    primary: any;
    all: Record<string, any>;
  }> {
    const adapters: Record<string, any> = {};
    let primary: any;

    // Ollama (free, local) - default
    if (process.env.USE_OLLAMA !== 'false') {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const ollamaModel = process.env.OLLAMA_MODEL || 'llama2';
      const ollamaAdapter = new OllamaAdapter(ollamaUrl, ollamaModel);

      // Check availability
      const { available } = await ollamaAdapter.checkAvailability();
      if (available) {
        adapters[ModelProvider.OLLAMA] = ollamaAdapter;
        primary = primary || ollamaAdapter;
        logger.info('Ollama adapter ready', { model: ollamaModel });
      } else {
        logger.warn('Ollama not available, skipping');
      }
    }

    // Hugging Face (free, API)
    if (process.env.USE_HUGGINGFACE === 'true') {
      const hfModel = process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';
      const hfAdapter = new HuggingFaceAdapter(
        process.env.HUGGINGFACE_API_KEY,
        hfModel
      );
      adapters[ModelProvider.HUGGINGFACE] = hfAdapter;
      primary = primary || hfAdapter;
      logger.info('Hugging Face adapter ready', { model: hfModel });
    }

    const configuredProvider = process.env.LLM_PROVIDER
      || (process.env.OPENAI_API_KEY ? 'openai' : undefined)
      || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : undefined)
      || (process.env.GEMINI_API_KEY ? 'gemini' : undefined)
      || (process.env.USE_HUGGINGFACE === 'true' ? 'huggingface' : undefined)
      || (process.env.USE_OLLAMA !== 'false' ? 'ollama' : 'template');

    if (configuredProvider === 'openai-compatible' && process.env.OPENAI_COMPATIBLE_API_KEY && process.env.OPENAI_COMPATIBLE_BASE_URL) {
      const compatibleAdapter = new OpenAICompatibleAdapter(
        process.env.OPENAI_COMPATIBLE_PROVIDER_NAME || 'openai-compatible',
        process.env.OPENAI_COMPATIBLE_API_KEY,
        process.env.OPENAI_COMPATIBLE_BASE_URL,
        process.env.OPENAI_COMPATIBLE_MODEL || 'default'
      );
      adapters[ModelProvider.OPENAI] = compatibleAdapter;
      primary = primary || compatibleAdapter;
      logger.info('OpenAI-compatible adapter ready', {
        provider: process.env.OPENAI_COMPATIBLE_PROVIDER_NAME,
        model: process.env.OPENAI_COMPATIBLE_MODEL,
        baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL
      });
    }

    // OpenAI (paid)
    if (configuredProvider === 'openai' && process.env.OPENAI_API_KEY) {
      const openaiAdapter = new OpenAIAdapter(
        process.env.OPENAI_API_KEY,
        process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
      );
      adapters[ModelProvider.OPENAI] = openaiAdapter;
      primary = primary || openaiAdapter;
      logger.info('OpenAI adapter ready');
    }

    if (configuredProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      const anthropicAdapter = new AnthropicAdapter(
        process.env.ANTHROPIC_API_KEY,
        process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
      );
      adapters[ModelProvider.ANTHROPIC] = anthropicAdapter;
      primary = primary || anthropicAdapter;
      logger.info('Anthropic adapter ready', { model: process.env.ANTHROPIC_MODEL });
    }

    if (configuredProvider === 'gemini' && process.env.GEMINI_API_KEY) {
      const geminiAdapter = new GeminiAdapter(
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_MODEL || 'gemini-1.5-flash'
      );
      adapters[ModelProvider.GOOGLE] = geminiAdapter;
      primary = primary || geminiAdapter;
      logger.info('Gemini adapter ready', { model: process.env.GEMINI_MODEL });
    }

    // Fallback to template if nothing available
    if (!primary) {
      const { TemplateAdapter } = require('../providers/LLMAdapter');
      primary = new TemplateAdapter();
      logger.info('No external LLM adapters enabled, using template fallback');
    }

    return { primary, all: adapters };
  }

  /**
   * Initialize model router with all adapters
   */
  private static initializeModelRouter(adapters: Record<string, any>): ModelRouter {
    const router = new ModelRouter();

    // Register all available adapters
    for (const [provider, adapter] of Object.entries(adapters)) {
      router.registerAdapter(provider as ModelProvider, adapter);
    }

    return router;
  }

  /**
   * Initialize RAG service
   */
  private static initializeRAGService(
    llmAdapter: any,
    embeddingService: EmbeddingService
  ): RAGService {
    return new RAGService(llmAdapter, embeddingService);
  }

  /**
   * Load knowledge base documents
   */
  private static async loadKnowledgeBase(documentManager: DocumentManager): Promise<void> {
    const kbDir = process.env.KNOWLEDGE_BASE_DIR || './knowledge-base';

    if (!fs.existsSync(kbDir)) {
      logger.info('Knowledge base directory not found, creating...', { dir: kbDir });
      fs.mkdirSync(kbDir, { recursive: true });

      // Create example file
      const exampleFile = path.join(kbDir, 'example.txt');
      fs.writeFileSync(exampleFile, `Welcome to the Knowledge Base!

This is an example document. Add your own documents to the knowledge-base/ directory.

Supported formats:
- .txt files
- .md (Markdown) files
- .json files
- .pdf files

The system will automatically:
- Parse and chunk documents
- Generate embeddings
- Make them searchable via RAG
`);
      logger.info('Created example knowledge base file', { file: exampleFile });
      return;
    }

    try {
      const stats = fs.statSync(kbDir);
      if (!stats.isDirectory()) {
        logger.warn('Knowledge base path is not a directory', { path: kbDir });
        return;
      }

      const files = fs.readdirSync(kbDir);
      if (files.length === 0) {
        logger.info('Knowledge base directory is empty', { dir: kbDir });
        return;
      }

      logger.info('Loading knowledge base documents...', { dir: kbDir, filesCount: files.length });

      await documentManager.addDirectory(kbDir, {
        generateEmbeddings: process.env.RAG_GENERATE_EMBEDDINGS !== 'false',
        chunkSize: parseInt(process.env.RAG_CHUNK_SIZE || '500')
      });

      logger.info('Knowledge base loaded successfully', {
        dir: kbDir,
        filesCount: files.length
      });
    } catch (error: any) {
      logger.error('Failed to load knowledge base', { error: error.message, dir: kbDir });
    }
  }

  /**
   * Initialize safety pipeline
   */
  private static initializeSafetyPipeline(
    llmAdapter: any,
    ragService?: RAGService
  ): SafetyPipeline {
    return new SafetyPipeline(
      llmAdapter,
      ragService?.getRetriever()
    );
  }

  /**
   * Initialize cache
   */
  private static initializeCache(): MultiLevelCache<any> {
    const redisUrl = process.env.REDIS_URL;
    const diskCacheDir = process.env.DISK_CACHE_DIR || './cache';

    return new MultiLevelCache(
      process.env.ENABLE_REDIS_CACHE === 'true' ? redisUrl : undefined,
      process.env.ENABLE_DISK_CACHE === 'true' ? diskCacheDir : undefined
    );
  }

  /**
   * Initialize vision adapter
   */
  private static initializeVisionAdapter(): any {
    // LLaVA (free, local)
    if (process.env.USE_LLAVA === 'true') {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const llavaModel = process.env.LLAVA_MODEL || 'llava';
      return new LLaVAAdapter(ollamaUrl, llavaModel);
    }

    // Gemini Vision (paid)
    if (process.env.USE_GEMINI_VISION === 'true' && process.env.GEMINI_API_KEY) {
      return new GeminiVisionAdapter(
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_MODEL || 'gemini-pro-vision'
      );
    }

    // GPT-4V (paid)
    if (process.env.USE_GPT4V === 'true' && process.env.OPENAI_API_KEY) {
      return new GPT4VAdapter(
        process.env.OPENAI_API_KEY,
        process.env.GPT4V_MODEL || 'gpt-4-vision-preview'
      );
    }

    return undefined;
  }

  /**
   * Initialize tools and coding knowledge
   */
  private static async initializeTools(embeddingService: EmbeddingService): Promise<{ toolRegistry: ToolRegistry; knowledgeLearner: KnowledgeLearner }> {
    const registry = new ToolRegistry();

    // 1. Coding Knowledge Base
    const codingKB = new CodingKnowledgeBase(embeddingService);
    // Initialize in background to not block startup if large, but await for now for safety
    await codingKB.initialize();

    // 2. Coding Knowledge Tool
    const codingTool = new CodingKnowledgeTool(codingKB);
    registry.register(codingTool);

    // 3. Knowledge Learner
    const knowledgeLearner = new KnowledgeLearner(codingKB);

    // 4. Code executor
    const codeExecutor = new CodeExecutor(
      parseInt(process.env.CODE_EXECUTOR_TIMEOUT || '5000'),
      ['python', 'javascript', 'bash']
    );
    registry.register(codeExecutor.createTool());

    // 5. Web searcher
    const webSearcher = WebSearcher.fromEnv();
    registry.register(webSearcher.createTool());

    // 6. Personal Knowledge Tool
    const personalKnowledgeTool = new PersonalKnowledgeTool();
    registry.register(personalKnowledgeTool);

    logger.info('Tools registered', {
      tools: registry.getAll().map(t => t.name)
    });

    return { toolRegistry: registry, knowledgeLearner };
  }
}

