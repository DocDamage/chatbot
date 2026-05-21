/**
 * Service Initializer - Auto-loads all services on application start
 */

import { logger } from '../observability/logger';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { RAGService } from '../rag/RAGService';
import { DocumentManager } from '../rag/DocumentManager';
import { Database } from '../database/Database';
import { RAGDocumentStore } from '../rag/RAGDocumentStore';
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
import { CommandRunner } from '../tools/CommandRunner';
import { createRepoTools } from '../tools/RepoTools';
import { WebSearcher } from '../tools/WebSearcher';
import { FunctionCaller } from '../tools/FunctionCaller';
import { CodingKnowledgeBase } from '../knowledge/CodingKnowledgeBase';
import { CodingKnowledgeTool } from '../tools/CodingKnowledgeTool';
import { PersonalKnowledgeTool } from '../tools/PersonalKnowledgeTool';
import { KnowledgeLearner } from '../learning/KnowledgeLearner';
import { CodingAgent } from '../agents/CodingAgent';
import { VerificationRunner } from '../agents/VerificationRunner';
import { MathGeniusAgent } from '../agents/math/MathGeniusAgent';
import { MarketGeniusAgent } from '../agents/market/MarketGeniusAgent';
import { GameDevGeniusAgent } from '../agents/gamedev/GameDevGeniusAgent';
import { GamingGeniusAgent } from '../agents/gaming/GamingGeniusAgent';
import { SixSigmaBlackBeltAgent } from '../agents/sixsigma/SixSigmaBlackBeltAgent';
import { ChronoKnowledgeEngine } from '../chrono/ChronoKnowledgeEngine';
import { PopCultureGeniusAgent } from '../agents/culture/PopCultureGeniusAgent';
import { HistoryGeniusAgent } from '../agents/history/HistoryGeniusAgent';
import { ScienceInventionGeniusAgent } from '../agents/science/ScienceInventionGeniusAgent';
import { MusicProductionGeniusAgent } from '../agents/music/MusicProductionGeniusAgent';
import { MixGeniusAgent } from '../agents/music/mix/MixGeniusAgent';
import { SunoGeniusAgent } from '../agents/music/suno/SunoGeniusAgent';
import { FLStudioGeniusAgent } from '../agents/music/flstudio/FLStudioGeniusAgent';
import { ProToolsGeniusAgent } from '../agents/music/protools/ProToolsGeniusAgent';
import { LogicProGeniusAgent } from '../agents/music/logic/LogicProGeniusAgent';
import { FLStudioControlAgent } from '../integrations/flstudio/FLStudioControlAgent';
import { FLStudioMcpClient } from '../integrations/flstudio/FLStudioMcpClient';
import { FLStudioCommandPlanner } from '../integrations/flstudio/FLStudioCommandPlanner';
import { FLStudioSafetyGate } from '../integrations/flstudio/FLStudioSafetyGate';
import { FLStudioSessionState } from '../integrations/flstudio/FLStudioSessionState';
import { McpAuditLogger } from '../mcp/McpAuditLogger';
import { McpClientService } from '../mcp/McpClientService';
import { StoryGeniusAgent } from '../agents/story/StoryGeniusAgent';
import { CreativeWritingAgent } from '../creative/CreativeWritingAgent';
import { LegalCivicGeniusAgent } from '../agents/legal/LegalCivicGeniusAgent';
import { HealthGeniusAgent } from '../agents/health/HealthGeniusAgent';
import { SecurityGeniusAgent } from '../agents/security/SecurityGeniusAgent';
import { BusinessGeniusAgent } from '../agents/business/BusinessGeniusAgent';
import { PhilosophyGeniusAgent } from '../agents/philosophy/PhilosophyGeniusAgent';
import { LanguageGeniusAgent } from '../agents/language/LanguageGeniusAgent';
import { GeoCultureGeniusAgent } from '../agents/geography/GeoCultureGeniusAgent';
import { EngineeringGeniusAgent } from '../agents/engineering/EngineeringGeniusAgent';
import { CpkCalculatorTool } from '../tools/sixsigma/CpkCalculatorTool';
import { SampleSizeTool } from '../tools/sixsigma/SampleSizeTool';
import { GageRRTool } from '../tools/sixsigma/GageRRTool';
import { SigmaDpmoTool } from '../tools/sixsigma/SigmaDpmoTool';
import { CopqTool } from '../tools/sixsigma/CopqTool';
import { AnovaTool } from '../tools/sixsigma/AnovaTool';
import { RegressionTool } from '../tools/sixsigma/RegressionTool';
import { ControlChartConstantsTool } from '../tools/sixsigma/ControlChartConstantsTool';
import { createMusicTools } from '../tools/music/createMusicTools';
import { EntityLinkingService } from '../entity/EntityLinkingService';
import { KnowledgeGraphIndexer } from '../graph/KnowledgeGraphIndexer';
import { LocalKnowledgeWiki } from '../wiki/LocalKnowledgeWiki';
import { PrivateMemoryStore } from '../memory/PrivateMemoryStore';
import { SafeDatabaseQuestionAgent } from '../database/SafeDatabaseQuestionAgent';
import { GovernanceEvidenceService } from '../governance/GovernanceEvidenceService';
import { GitHubRepoKnowledgeImporter } from '../importers/GitHubRepoKnowledgeImporter';
import { ConversationManager } from '../conversation/ConversationManager';
import * as fs from 'fs';
import * as path from 'path';

export interface InitializedServices {
  orchestrator: EnhancedOrchestrator;
  ragService?: RAGService;
  documentManager?: DocumentManager;
  modelRouter?: ModelRouter;
  toolRegistry?: ToolRegistry;
  functionCaller?: FunctionCaller;
  codingAgent?: CodingAgent;
  mathGeniusAgent?: MathGeniusAgent;
  marketGeniusAgent?: MarketGeniusAgent;
  gameDevGeniusAgent?: GameDevGeniusAgent;
  gamingGeniusAgent?: GamingGeniusAgent;
  sixSigmaBlackBeltAgent?: SixSigmaBlackBeltAgent;
  chronoKnowledgeEngine?: ChronoKnowledgeEngine;
  popCultureGeniusAgent?: PopCultureGeniusAgent;
  historyGeniusAgent?: HistoryGeniusAgent;
  scienceInventionGeniusAgent?: ScienceInventionGeniusAgent;
  musicProductionGeniusAgent?: MusicProductionGeniusAgent;
  mixGeniusAgent?: MixGeniusAgent;
  sunoGeniusAgent?: SunoGeniusAgent;
  flStudioGeniusAgent?: FLStudioGeniusAgent;
  flStudioControlAgent?: FLStudioControlAgent;
  proToolsGeniusAgent?: ProToolsGeniusAgent;
  logicProGeniusAgent?: LogicProGeniusAgent;
  storyGeniusAgent?: StoryGeniusAgent;
  creativeWritingAgent?: CreativeWritingAgent;
  legalCivicGeniusAgent?: LegalCivicGeniusAgent;
  healthGeniusAgent?: HealthGeniusAgent;
  securityGeniusAgent?: SecurityGeniusAgent;
  businessGeniusAgent?: BusinessGeniusAgent;
  philosophyGeniusAgent?: PhilosophyGeniusAgent;
  languageGeniusAgent?: LanguageGeniusAgent;
  geoCultureGeniusAgent?: GeoCultureGeniusAgent;
  engineeringGeniusAgent?: EngineeringGeniusAgent;
  visionAdapter?: any;
  embeddingService?: EmbeddingService;
  database?: Database;
  ragDocumentStore?: RAGDocumentStore;
  entityLinkingService?: EntityLinkingService;
  knowledgeGraphIndexer?: KnowledgeGraphIndexer;
  localKnowledgeWiki?: LocalKnowledgeWiki;
  privateMemoryStore?: PrivateMemoryStore;
  safeDatabaseQuestionAgent?: SafeDatabaseQuestionAgent;
  governanceEvidenceService?: GovernanceEvidenceService;
  githubRepoKnowledgeImporter?: GitHubRepoKnowledgeImporter;
  cache?: MultiLevelCache<any>;
  analytics?: AnalyticsService;
  knowledgeLearner?: KnowledgeLearner;
  conversationManager?: ConversationManager;
  initialization?: InitializationStatus;
}

export interface InitializationStatus {
  criticalStartedAt: string;
  readyAt?: string;
  optional: Record<string, {
    status: 'pending' | 'running' | 'ready' | 'failed' | 'skipped';
    startedAt?: string;
    completedAt?: string;
    error?: string;
  }>;
}

export class ServiceInitializer {
  /**
   * Initialize all services automatically
   */
  static async initialize(): Promise<InitializedServices> {
    logger.info('Starting service initialization...');
    const initialization: InitializationStatus = {
      criticalStartedAt: new Date().toISOString(),
      optional: {
        persistedRagRestore: { status: 'pending' },
        privateKnowledgeBaseLoad: { status: 'pending' },
        publicKnowledgeBaseLoad: { status: 'pending' },
        codingKnowledgeBaseLoad: { status: 'pending' }
      }
    };

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
    const database = await this.initializeDatabase();
    const ragDocumentStore = database ? new RAGDocumentStore(database) : undefined;
    const ragService = this.initializeRAGService(primaryAdapter, embeddingService, ragDocumentStore);

    const restorePersistedRag = async () => {
      if (!ragDocumentStore) {
        initialization.optional.persistedRagRestore.status = 'skipped';
        return;
      }
      const persistedChunks = await ragDocumentStore.loadChunks();
      if (persistedChunks.length > 0) {
        ragService.addDocuments(persistedChunks);
        logger.info('Loaded persisted RAG chunks', { chunksCount: persistedChunks.length });
      }
    };

    const entityLinkingService = new EntityLinkingService(database);
    const documentManager = new DocumentManager(ragService, embeddingService, ragDocumentStore, entityLinkingService);
    const knowledgeGraphIndexer = new KnowledgeGraphIndexer({
      workspaceRoot: process.cwd(),
      ragDocumentStore,
      database,
      maxFiles: parseInt(process.env.KNOWLEDGE_GRAPH_MAX_FILES || '250')
    });
    const localKnowledgeWiki = new LocalKnowledgeWiki(process.env.LOCAL_KNOWLEDGE_WIKI_DIR || path.join(process.cwd(), 'knowledge-base-public', 'wiki'));
    const privateMemoryStore = new PrivateMemoryStore(database);
    const safeDatabaseQuestionAgent = new SafeDatabaseQuestionAgent(database);
    const governanceEvidenceService = new GovernanceEvidenceService(database);
    const githubRepoKnowledgeImporter = new GitHubRepoKnowledgeImporter({
      wiki: localKnowledgeWiki,
      documentManager,
      token: process.env.GITHUB_TOKEN
    });

    // 5. Load RAG corpora outside the critical startup path by default.
    if (process.env.EAGER_KNOWLEDGE_LOAD === 'true') {
      await this.trackOptionalInitialization(initialization, 'persistedRagRestore', restorePersistedRag);
      await this.trackOptionalInitialization(initialization, 'privateKnowledgeBaseLoad', () => this.loadKnowledgeBase(documentManager));
      await this.trackOptionalInitialization(initialization, 'publicKnowledgeBaseLoad', () => this.loadPublicKnowledgeBase(documentManager));
    } else {
      void this.trackOptionalInitialization(initialization, 'persistedRagRestore', restorePersistedRag);
      void this.trackOptionalInitialization(initialization, 'privateKnowledgeBaseLoad', () => this.loadKnowledgeBase(documentManager));
      void this.trackOptionalInitialization(initialization, 'publicKnowledgeBaseLoad', () => this.loadPublicKnowledgeBase(documentManager));
    }
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
    const { toolRegistry, functionCaller, knowledgeLearner, codingAgent } = await this.initializeTools(embeddingService, initialization);
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
        toolRegistry,
        functionCaller,
        codingAgent,
        useToolCalling: process.env.ENABLE_TOOL_CALLING !== 'false',
        semanticCache: new SemanticCache<any>(
          parseInt(process.env.SEMANTIC_CACHE_TTL || '3600'),
          parseFloat(process.env.SEMANTIC_CACHE_SIMILARITY_THRESHOLD || '0.7')
        )
      }
    );

    // 11. Initialize Analytics Service
    const analytics = new AnalyticsService();
    logger.info('Analytics service initialized');
    const conversationManager = new ConversationManager(database);

    const mathGeniusAgent = new MathGeniusAgent();
    const marketGeniusAgent = new MarketGeniusAgent();
    const gameDevGeniusAgent = new GameDevGeniusAgent();
    const gamingGeniusAgent = new GamingGeniusAgent(gameDevGeniusAgent);
    const sixSigmaBlackBeltAgent = new SixSigmaBlackBeltAgent();
    const chronoKnowledgeEngine = new ChronoKnowledgeEngine();
    const popCultureGeniusAgent = new PopCultureGeniusAgent(chronoKnowledgeEngine);
    const historyGeniusAgent = new HistoryGeniusAgent(chronoKnowledgeEngine);
    const scienceInventionGeniusAgent = new ScienceInventionGeniusAgent(chronoKnowledgeEngine);
    const sunoGeniusAgent = new SunoGeniusAgent();
    const flStudioGeniusAgent = new FLStudioGeniusAgent();
    const flStudioControlAgent = new FLStudioControlAgent(
      new FLStudioMcpClient(new McpClientService()),
      new FLStudioCommandPlanner(),
      new FLStudioSafetyGate(),
      new FLStudioSessionState(),
      new McpAuditLogger()
    );
    const proToolsGeniusAgent = new ProToolsGeniusAgent();
    const logicProGeniusAgent = new LogicProGeniusAgent();
    const musicProductionGeniusAgent = new MusicProductionGeniusAgent({
      documentStore: ragDocumentStore,
      suno: sunoGeniusAgent,
      flStudio: flStudioGeniusAgent,
      proTools: proToolsGeniusAgent,
      logic: logicProGeniusAgent
    });
    const mixGeniusAgent = new MixGeniusAgent(flStudioControlAgent);
    const storyGeniusAgent = new StoryGeniusAgent(ragDocumentStore);
    const creativeWritingAgent = new CreativeWritingAgent();
    const legalCivicGeniusAgent = new LegalCivicGeniusAgent(ragDocumentStore);
    const healthGeniusAgent = new HealthGeniusAgent(ragDocumentStore);
    const securityGeniusAgent = new SecurityGeniusAgent(ragDocumentStore);
    const businessGeniusAgent = new BusinessGeniusAgent(ragDocumentStore);
    const philosophyGeniusAgent = new PhilosophyGeniusAgent(ragDocumentStore);
    const languageGeniusAgent = new LanguageGeniusAgent(ragDocumentStore);
    const geoCultureGeniusAgent = new GeoCultureGeniusAgent(ragDocumentStore);
    const engineeringGeniusAgent = new EngineeringGeniusAgent(ragDocumentStore);
    logger.info('Specialist agents initialized', {
      math: true,
      market: true,
      gamedev: true,
      gaming: true,
      sixsigma: true,
      chrono: true,
      music: true,
      mixGenius: true,
      suno: true,
      flStudio: true,
      flStudioControl: true,
      proTools: true,
      logicPro: true,
      story: true,
      creativeWriting: true,
      legal: true,
      health: true,
      security: true,
      business: true,
      philosophy: true,
      language: true,
      geography: true,
      engineering: true
    });

    logger.info('✅ All services initialized successfully');
    initialization.readyAt = new Date().toISOString();

    return {
      initialization,
      orchestrator,
      ragService,
      documentManager,
      modelRouter,
      toolRegistry,
      functionCaller,
      codingAgent,
      mathGeniusAgent,
      marketGeniusAgent,
      gameDevGeniusAgent,
      gamingGeniusAgent,
      sixSigmaBlackBeltAgent,
      chronoKnowledgeEngine,
      popCultureGeniusAgent,
      historyGeniusAgent,
      scienceInventionGeniusAgent,
      musicProductionGeniusAgent,
      mixGeniusAgent,
      sunoGeniusAgent,
      flStudioGeniusAgent,
      flStudioControlAgent,
      proToolsGeniusAgent,
      logicProGeniusAgent,
      storyGeniusAgent,
      creativeWritingAgent,
      legalCivicGeniusAgent,
      healthGeniusAgent,
      securityGeniusAgent,
      businessGeniusAgent,
      philosophyGeniusAgent,
      languageGeniusAgent,
      geoCultureGeniusAgent,
      engineeringGeniusAgent,
      visionAdapter,
      embeddingService,
      database,
      ragDocumentStore,
      entityLinkingService,
      knowledgeGraphIndexer,
      localKnowledgeWiki,
      privateMemoryStore,
      safeDatabaseQuestionAgent,
      governanceEvidenceService,
      githubRepoKnowledgeImporter,
      cache,
      analytics,
      knowledgeLearner,
      conversationManager
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
    embeddingService: EmbeddingService,
    documentStore?: RAGDocumentStore
  ): RAGService {
    return new RAGService(llmAdapter, embeddingService, {
      documentStore,
      retrievalMode: (process.env.RAG_RETRIEVAL_MODE || 'memory') as any,
      rerankerMode: (process.env.RERANKER_MODE || 'heuristic') as any
    });
  }

  private static async initializeDatabase(): Promise<Database | undefined> {
    if (process.env.RAG_PERSISTENCE === 'false') {
      logger.info('RAG persistence disabled');
      return undefined;
    }

    const connectionString = process.env.RAG_DATABASE_URL || process.env.DATABASE_URL;
    const database = connectionString
      ? new Database({ type: 'postgresql', connectionString })
      : new Database({
          type: 'sqlite',
          filePath: process.env.RAG_SQLITE_PATH || path.join(process.cwd(), 'data', 'chatbot.db')
        });

    await database.initialize();
    logger.info('RAG persistence initialized', {
      type: connectionString ? 'postgresql' : 'sqlite'
    });

    return database;
  }

  /**
   * Load knowledge base documents
   */
  private static async loadKnowledgeBase(documentManager: DocumentManager): Promise<void> {
    const kbDir = process.env.KNOWLEDGE_BASE_DIR || './knowledge-base';

    if (!fs.existsSync(kbDir)) {
      logger.info('Knowledge base directory not found, skipping runtime bootstrap', { dir: kbDir });
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

  private static async loadPublicKnowledgeBase(documentManager: DocumentManager): Promise<void> {
    const publicKbDir = process.env.PUBLIC_KNOWLEDGE_BASE_DIR || './knowledge-base-public';

    if (!fs.existsSync(publicKbDir)) {
      logger.info('Public knowledge base directory not found, skipping', { dir: publicKbDir });
      return;
    }

    try {
      const stats = fs.statSync(publicKbDir);
      if (!stats.isDirectory()) {
        logger.warn('Public knowledge base path is not a directory', { path: publicKbDir });
        return;
      }

      const files = this.countFiles(publicKbDir);
      if (files === 0) {
        logger.info('Public knowledge base directory is empty', { dir: publicKbDir });
        return;
      }

      logger.info('Loading public knowledge base documents...', { dir: publicKbDir, filesCount: files });

      await documentManager.addDirectory(publicKbDir, {
        generateEmbeddings: process.env.RAG_GENERATE_EMBEDDINGS !== 'false',
        chunkSize: parseInt(process.env.RAG_CHUNK_SIZE || '500')
      });

      logger.info('Public knowledge base loaded successfully', {
        dir: publicKbDir,
        filesCount: files
      });
    } catch (error: any) {
      logger.error('Failed to load public knowledge base', { error: error.message, dir: publicKbDir });
    }
  }

  private static countFiles(directoryPath: string): number {
    return fs.readdirSync(directoryPath, { withFileTypes: true }).reduce((count, entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      return count + (entry.isDirectory() ? this.countFiles(entryPath) : entry.isFile() ? 1 : 0);
    }, 0);
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
  private static async initializeTools(embeddingService: EmbeddingService, initialization?: InitializationStatus): Promise<{
    toolRegistry: ToolRegistry;
    functionCaller: FunctionCaller;
    knowledgeLearner: KnowledgeLearner;
    codingAgent: CodingAgent;
  }> {
    const registry = new ToolRegistry();

    // 1. Coding Knowledge Base
    const codingKB = new CodingKnowledgeBase(embeddingService);
    const initializeCodingKnowledge = () => codingKB.initialize();
    if (process.env.EAGER_CODING_KNOWLEDGE_LOAD === 'true') {
      if (initialization) {
        await this.trackOptionalInitialization(initialization, 'codingKnowledgeBaseLoad', initializeCodingKnowledge);
      } else {
        await initializeCodingKnowledge();
      }
    } else if (initialization) {
      void this.trackOptionalInitialization(initialization, 'codingKnowledgeBaseLoad', initializeCodingKnowledge);
    }

    // 2. Coding Knowledge Tool
    const codingTool = new CodingKnowledgeTool(codingKB);
    registry.register(codingTool);

    // 3. Knowledge Learner
    const knowledgeLearner = new KnowledgeLearner(codingKB);

    // 4. Code executor
    const codeExecutor = new CodeExecutor(
      parseInt(process.env.CODE_EXECUTOR_TIMEOUT || '5000'),
      process.env.ENABLE_BASH_EXECUTOR === 'true' ? ['python', 'javascript', 'bash'] : ['python', 'javascript']
    );
    registry.register(codeExecutor.createTool());

    // 5. Repo-aware coding tools
    const commandRunner = new CommandRunner(process.cwd());
    for (const repoTool of createRepoTools(process.cwd(), commandRunner)) {
      registry.register(repoTool);
    }

    const functionCaller = new FunctionCaller(registry);
    const codingAgent = new CodingAgent({
      workspaceRoot: process.cwd(),
      toolRegistry: registry,
      functionCaller,
      verificationRunner: new VerificationRunner(commandRunner)
    });

    // 6. Web searcher
    const webSearcher = WebSearcher.fromEnv();
    registry.register(webSearcher.createTool());

    // 7. Personal Knowledge Tool
    const personalKnowledgeTool = new PersonalKnowledgeTool();
    registry.register(personalKnowledgeTool);

    // 8. Six Sigma deterministic calculator tools
    const sampleSizeTool = new SampleSizeTool();
    registry.register(new CpkCalculatorTool());
    registry.register(sampleSizeTool);
    registry.register(sampleSizeTool.createProportionTool());
    registry.register(new GageRRTool());
    registry.register(new SigmaDpmoTool());
    registry.register(new CopqTool());
    registry.register(new AnovaTool());
    registry.register(new RegressionTool());
    registry.register(new ControlChartConstantsTool());

    // 9. Music production and DAW deterministic tools
    for (const musicTool of createMusicTools()) {
      registry.register(musicTool);
    }

    logger.info('Tools registered', {
      tools: registry.getAll().map(t => t.name)
    });

    return { toolRegistry: registry, functionCaller, knowledgeLearner, codingAgent };
  }

  private static async trackOptionalInitialization(
    initialization: InitializationStatus,
    name: string,
    task: () => Promise<void>
  ): Promise<void> {
    const status = initialization.optional[name] || { status: 'pending' };
    initialization.optional[name] = status;
    status.status = 'running';
    status.startedAt = new Date().toISOString();

    try {
      await task();
      status.status = 'ready';
      status.completedAt = new Date().toISOString();
    } catch (error: any) {
      status.status = 'failed';
      status.completedAt = new Date().toISOString();
      status.error = error.message;
      logger.error('Optional service initialization failed', { name, error: error.message });
    }
  }
}

