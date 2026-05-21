/**
 * API Gateway - Entry point for all requests
 * Auto-loads all services on startup
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import multer from 'multer';
import { RequestHandler } from 'express';
import { ServiceInitializer } from '../core/initialization/ServiceInitializer';
import { ConfigValidator } from '../core/config/ConfigValidator';
import { logger } from '../core/observability/logger';
import { errorHandler, asyncHandler } from '../middleware/errorHandler';
import { apiErrorSchema } from '../middleware/apiErrorSchema';
import { securityHeaders, corsOptions } from '../middleware/security';
import { auditPrivilegedRequest, requireAuth, requireCsrfForStateChange, requireRole } from '../middleware/auth';
import { createKnowledgeBaseRouter } from './routes/knowledge-base';
import { createKnowledgeOsRouter } from './routes/knowledge-os';
import { validateWebhookUrl } from './security/webhookUrl';
import { ConversationManager } from '../core/conversation/ConversationManager';
import { createLegacyChatHandlers } from './routes/legacy-chat';
import { registerManifestRoutes } from './routeManifest';
import { registerHealthRoutes } from './healthRoutes';
import { registerSettingsRoutes } from './routes/settings';

// Validate configuration on startup
try {
  ConfigValidator.getValidatedConfig();
  logger.info('Configuration validated successfully');
} catch (error: any) {
  logger.error('Configuration validation failed', { error: error.message });
  process.exit(1);
}

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;
const STARTUP_TIMEOUT_MS = Number(process.env.STARTUP_TIMEOUT_MS || 30000);
const CLIENT_DIST_DIR = path.resolve(process.cwd(), 'client', 'dist');
const adminOnly: RequestHandler[] = [
  requireAuth,
  requireRole('admin'),
  requireCsrfForStateChange
];
const developerOnly: RequestHandler[] = [
  requireAuth,
  requireRole('admin', 'developer'),
  requireCsrfForStateChange
];

// Initialize WebSocket server
let wsServer: any;
if (process.env.ENABLE_WEBSOCKET !== 'false') {
  const { WebSocketServer } = require('../core/realtime/WebSocketServer');
  wsServer = new WebSocketServer(server);
  logger.info('WebSocket server initialized');
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(apiErrorSchema);

// Initialize all services automatically
let services: any;
let orchestrator: any;
let startupState: 'initializing' | 'ready' | 'failed' = 'initializing';
let startupError: string | undefined;

function getConversationManager(): ConversationManager {
  if (services?.conversationManager) {
    return services.conversationManager;
  }
  services = services || {};
  services.conversationManager = new ConversationManager(services?.database);
  return services.conversationManager;
}

async function reinitializeServices(): Promise<void> {
  services = await ServiceInitializer.initialize();
  orchestrator = services.orchestrator;
}

async function waitForReady(timeoutMs = STARTUP_TIMEOUT_MS): Promise<void> {
  if (startupState === 'ready' && orchestrator) {
    return;
  }

  if ((startupState as string) === 'failed') {
    throw new Error(startupError || 'Services failed to initialize');
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (startupState === 'ready' && orchestrator) {
      return;
    }
    if ((startupState as string) === 'failed') {
      throw new Error(startupError || 'Services failed to initialize');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`Services were not ready within ${timeoutMs}ms`);
}

function requireReady(): RequestHandler {
  return asyncHandler(async (_req, res, next) => {
    try {
      await waitForReady(Number(process.env.REQUEST_READY_TIMEOUT_MS || 10000));
      next();
    } catch (error: any) {
      res.status(503).json({
        error: {
          message: error.message,
          code: 'SERVICE_NOT_READY'
        }
      });
    }
  });
}

function mountServiceRouter(createRouter: () => RequestHandler): RequestHandler {
  let cachedServices: any;
  let cachedRouter: RequestHandler | undefined;

  return (req, res, next) => {
    if (!cachedRouter || cachedServices !== services) {
      cachedServices = services;
      cachedRouter = createRouter();
    }
    cachedRouter(req, res, next);
  };
}

// Start initialization immediately
(async () => {
  try {
    logger.info('🚀 Initializing all services...');
    await reinitializeServices();

    startupState = 'ready';
    logger.info('✅ All services initialized and ready');
  } catch (error: any) {
    startupState = 'failed';
    startupError = error.message;
    logger.error('Failed to initialize services', { error: error.message });
    process.exit(1);
  }
})();

registerHealthRoutes(app, {
  getStartupState: () => startupState,
  getStartupError: () => startupError,
  getOrchestrator: () => orchestrator,
  getServices: () => services
});

// API Versioning
// Determine API version from header or URL
const getApiVersion = (req: any): string => {
  const versionHeader = req.headers['api-version'];
  if (versionHeader) return versionHeader;

  const urlVersion = req.path.match(/\/api\/v(\d+)\//);
  if (urlVersion) return urlVersion[1];

  return '1'; // Default to v1
};

// Versioned API routes
app.use('/api/v1', requireReady(), (req, res, next) => {
  const { createChatRouter } = require('./routes/v1/chat');
  const router = createChatRouter(orchestrator);
  router(req, res, next);
});

app.use('/api/v2', requireReady(), (req, res, next) => {
  const { createChatRouterV2 } = require('./routes/v2/chat');
  const router = createChatRouterV2(orchestrator);
  router(req, res, next);
});

// Legacy endpoint (defaults to v1)
app.post('/api/chat', ...createLegacyChatHandlers({
  getServices: () => services,
  getOrchestrator: () => orchestrator,
  waitForReady,
  getConversationManager
}));

// Knowledge base management endpoints
app.post('/api/knowledge-base/add', developerOnly, auditPrivilegedRequest('knowledge-base:add'), asyncHandler(async (req, res) => {
  if (!services?.documentManager) {
    return res.status(503).json({ error: 'Document manager not initialized' });
  }

  const { text, metadata } = req.body;
  const chunks = await services.documentManager.addText(text, metadata || {});
  res.json({ success: true, chunksCount: chunks.length });
}));

app.post('/api/knowledge-base/file', developerOnly, auditPrivilegedRequest('knowledge-base:file'), asyncHandler(async (req, res) => {
  if (!services?.documentManager) {
    return res.status(503).json({ error: 'Document manager not initialized' });
  }

  const { filePath } = req.body;
  const chunks = await services.documentManager.addFile(filePath);
  res.json({ success: true, chunksCount: chunks.length });
}));

app.use(requireReady(), mountServiceRouter(() => createKnowledgeBaseRouter(services)));
app.use('/api/knowledge-os', adminOnly, auditPrivilegedRequest('knowledge-os'));
app.use(requireReady(), mountServiceRouter(() => createKnowledgeOsRouter(services)));

// Tools endpoint
app.get('/api/tools', asyncHandler(async (req, res) => {
  if (!services?.toolRegistry) {
    return res.status(503).json({ error: 'Tool registry not initialized' });
  }

  res.json({
    tools: services.toolRegistry.getAll().map((tool: any) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      category: tool.category
    })),
    stats: services.toolRegistry.getStats()
  });
}));

// Free models endpoint
app.get('/api/models/free', asyncHandler(async (req, res) => {
  const { FreeModelRegistry } = require('../core/providers/FreeModelRegistry');
  res.json({
    llm: FreeModelRegistry.getByCategory('llm'),
    vision: FreeModelRegistry.getByCategory('vision'),
    embedding: FreeModelRegistry.getByCategory('embedding')
  });
}));

registerSettingsRoutes(app, {
  adminOnly,
  reinitializeServices,
  getOrchestrator: () => orchestrator
});

// API Documentation endpoint
app.get('/api-docs', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  try {
    const openapiSpec = fs.readFileSync(
      path.join(__dirname, '../docs/openapi.yaml'),
      'utf8'
    );
    res.setHeader('Content-Type', 'text/yaml');
    res.send(openapiSpec);
  } catch (error) {
    res.status(404).json({ error: 'API documentation not found' });
  }
});

registerManifestRoutes({
  app,
  getServices: () => services,
  workspaceRoot: process.cwd(),
  adminOnly,
  developerOnly,
  requireReady,
  mountServiceRouter
});

// File upload endpoint
app.post('/api/upload', requireAuth, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!services?.documentManager) {
    return res.status(503).json({ error: 'Document manager not available' });
  }

  const { FileProcessor } = require('../core/upload/FileProcessor');
  const processor = new FileProcessor();
  const result = await processor.processFile(req.file, services.documentManager, {
    uploadedBy: req.user?.userId,
  });

  if (result.success) {
    res.json({
      success: true,
      chunks: result.chunks,
      metadata: result.metadata,
    });
  } else {
    res.status(400).json({ error: result.error });
  }
}));

// Feedback endpoints
app.post('/api/feedback', requireAuth, asyncHandler(async (req, res) => {
  const { FeedbackService } = require('../core/feedback/FeedbackService');
  const feedbackService = new FeedbackService();

  const { messageId, sessionId, reaction, rating, comment } = req.body;
  const feedback = await feedbackService.submitFeedback({
    messageId,
    sessionId,
    userId: req.user?.userId,
    reaction,
    rating,
    comment,
  });

  res.json({ success: true, feedback });
}));

app.get('/api/feedback/:messageId', asyncHandler(async (req, res) => {
  const { FeedbackService } = require('../core/feedback/FeedbackService');
  const feedbackService = new FeedbackService();

  const feedback = feedbackService.getFeedback(req.params.messageId);
  const stats = feedbackService.getStats(req.params.messageId);

  res.json({ feedback, stats });
}));

// Custom instructions endpoints
app.get('/api/user/instructions', requireAuth, asyncHandler(async (req, res) => {
  const { CustomInstructionsService } = require('../core/user/CustomInstructions');
  const instructionsService = new CustomInstructionsService();

  const instructions = await instructionsService.getInstructions(req.user!.userId);
  res.json({ instructions });
}));

app.put('/api/user/instructions', requireAuth, asyncHandler(async (req, res) => {
  const { CustomInstructionsService } = require('../core/user/CustomInstructions');
  const instructionsService = new CustomInstructionsService();

  const instructions = await instructionsService.updateInstructions(
    req.user!.userId,
    req.body
  );
  res.json({ success: true, instructions });
}));

// Quick replies endpoint
app.get('/api/chat/quick-replies', asyncHandler(async (req, res) => {
  if (!services?.orchestrator) {
    return res.status(503).json({ error: 'Orchestrator not available' });
  }

  const { QuickRepliesService } = require('../core/suggestions/QuickReplies');
  const { lastMessage, lastResponse, context } = req.query;

  // Get primary adapter from orchestrator
  const primaryAdapter = (services.orchestrator as any).llmAdapter;
  const quickRepliesService = new QuickRepliesService(primaryAdapter);

  const replies = await quickRepliesService.generateQuickReplies(
    lastMessage as string,
    lastResponse as string,
    context ? JSON.parse(context as string) : undefined
  );

  res.json({ replies });
}));

// Conversation sharing endpoints
app.post('/api/conversations/:sessionId/share', requireAuth, asyncHandler(async (req, res) => {
  const { ConversationSharingService } = require('../core/sharing/ConversationSharing');
  const sharingService = new ConversationSharingService(process.env.BASE_URL || `http://localhost:${PORT}`);

  const { title, description, public: isPublic, password, expiresInDays } = req.body;
  const result = await sharingService.createShare(req.params.sessionId, {
    userId: req.user?.userId,
    title,
    description,
    public: isPublic,
    password,
    expiresInDays,
  });

  res.json({ success: true, ...result });
}));

app.get('/api/share/:shareId', asyncHandler(async (req, res) => {
  const { ConversationSharingService } = require('../core/sharing/ConversationSharing');

  const sharingService = new ConversationSharingService();
  const conversationManager = getConversationManager();

  const share = await sharingService.getShare(req.params.shareId, req.query.password as string);
  if (!share) {
    return res.status(404).json({ error: 'Share not found or expired' });
  }

  const conversation = await conversationManager.getConversation(share.sessionId);
  res.json({ share, conversation });
}));

// Document search endpoint
app.get('/api/documents/search', requireAuth, asyncHandler(async (req, res) => {
  const { DocumentMetadataManager } = require('../core/documents/DocumentMetadata');
  const metadataManager = new DocumentMetadataManager();

  const filters = {
    tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
    category: req.query.category as string,
    source: req.query.source as string,
    searchQuery: req.query.q as string,
  };

  const documents = metadataManager.search(filters, parseInt(req.query.limit as string) || 20);
  res.json({ documents });
}));

// Knowledge sources endpoints
app.use('/api/knowledge', developerOnly, auditPrivilegedRequest('knowledge-ingestion'));

app.post('/api/knowledge/reddit', asyncHandler(async (req, res) => {
  const { RedditSource } = require('../core/knowledge/RedditSource');
  const source = new RedditSource();

  const { query, subreddit, limit, sort } = req.body;
  const results = await source.search(query, { subreddit, limit: limit || 10, sort: sort || 'relevance' });

  res.json({ results });
}));

app.post('/api/knowledge/youtube', asyncHandler(async (req, res) => {
  const { YouTubeSource } = require('../core/knowledge/YouTubeSource');
  const source = new YouTubeSource(process.env.YOUTUBE_API_KEY);

  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });

  res.json({ results });
}));

app.post('/api/knowledge/university', asyncHandler(async (req, res) => {
  const { UniversitySource } = require('../core/knowledge/UniversitySource');
  const { university, query, limit, type } = req.body;

  const source = new UniversitySource(university);
  const results = await source.search(query, { limit: limit || 10, type: type || 'all' });

  res.json({ results });
}));

app.post('/api/knowledge/papers', asyncHandler(async (req, res) => {
  const { ScientificPapersSource } = require('../core/knowledge/ScientificPapersSource');
  const { query, limit, source } = req.body;

  const paperSource = new ScientificPapersSource(source || 'all');
  const results = await paperSource.search(query, { limit: limit || 10, source: source || 'all' });

  res.json({ results });
}));

app.post('/api/knowledge/github', requireAuth, asyncHandler(async (req, res) => {
  const { GitHubSource } = require('../core/knowledge/GitHubSource');
  const source = new GitHubSource(process.env.GITHUB_TOKEN);

  const { query, limit, type } = req.body;
  const results = await source.search(query, { limit: limit || 10, type: type || 'all' });

  res.json({ results });
}));

app.post('/api/knowledge/stackoverflow', asyncHandler(async (req, res) => {
  const { StackOverflowSource } = require('../core/knowledge/StackOverflowSource');
  const source = new StackOverflowSource(process.env.STACKOVERFLOW_API_KEY);

  const { query, tagged, limit, sort } = req.body;
  const results = await source.search(query, { tagged, limit: limit || 10, sort: sort || 'relevance' });

  res.json({ results });
}));

app.post('/api/knowledge/news', asyncHandler(async (req, res) => {
  const { NewsSource } = require('../core/knowledge/NewsSource');
  const source = new NewsSource(
    req.body.provider || 'all',
    process.env.NEWS_API_KEY,
    process.env.GUARDIAN_API_KEY,
    process.env.NYTIMES_API_KEY
  );

  const { query, limit, provider, language } = req.body;
  const results = await source.search(query, { limit: limit || 10, provider, language });

  res.json({ results });
}));

app.post('/api/knowledge/medium', asyncHandler(async (req, res) => {
  const { MediumSource } = require('../core/knowledge/MediumSource');
  const source = new MediumSource();

  const { query, limit, tag } = req.body;
  const results = await source.search(query, { limit: limit || 10, tag });

  res.json({ results });
}));

app.post('/api/knowledge/quora', asyncHandler(async (req, res) => {
  const { QuoraSource } = require('../core/knowledge/QuoraSource');
  const source = new QuoraSource();

  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });

  res.json({ results });
}));

app.post('/api/knowledge/gutenberg', asyncHandler(async (req, res) => {
  const { ProjectGutenbergSource } = require('../core/knowledge/ProjectGutenbergSource');
  const source = new ProjectGutenbergSource();

  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });

  res.json({ results });
}));

app.post('/api/knowledge/docs', asyncHandler(async (req, res) => {
  const { DocumentationSource } = require('../core/knowledge/DocumentationSource');
  const { site, query, limit } = req.body;

  const source = new DocumentationSource(site || 'all');
  const results = await source.search(query, { limit: limit || 10, site: site || 'all' });

  res.json({ results });
}));

app.post('/api/knowledge/library-of-congress', asyncHandler(async (req, res) => {
  const { LibraryOfCongressSource } = require('../core/knowledge/LibraryOfCongressSource');
  const source = new LibraryOfCongressSource();

  const { query, limit, format, dateRange } = req.body;
  const results = await source.search(query, { limit: limit || 10, format, dateRange });

  res.json({ results });
}));

app.post('/api/knowledge/entertainment', asyncHandler(async (req, res) => {
  const { EntertainmentSource } = require('../core/knowledge/EntertainmentSource');
  const source = new EntertainmentSource(
    req.body.type || 'all',
    process.env.TMDB_API_KEY,
    process.env.OMDB_API_KEY
  );

  const { query, limit, type, year } = req.body;
  const results = await source.search(query, { limit: limit || 10, type: type || 'all', year });

  res.json({ results });
}));

app.post('/api/knowledge/books', asyncHandler(async (req, res) => {
  const { BookSource } = require('../core/knowledge/BookSource');
  const source = new BookSource(
    req.body.source || 'all',
    process.env.GOOGLE_BOOKS_API_KEY
  );

  const { query, limit, author, isbn } = req.body;
  const results = await source.search(query, { limit: limit || 10, author, isbn });

  res.json({ results });
}));

app.post('/api/knowledge/specialized-topics', asyncHandler(async (req, res) => {
  const { SpecializedTopicSource } = require('../core/knowledge/SpecializedTopicSource');
  const { topic, query, limit } = req.body;

  const source = new SpecializedTopicSource(topic || 'all');
  const results = await source.search(query, { limit: limit || 10, topic: topic || 'all' });

  // Also return curated sources for the topic
  const curatedSources = source.getCuratedSources(topic || 'all');

  res.json({ results, curatedSources });
}));

app.post('/api/knowledge/financial-advice', asyncHandler(async (req, res) => {
  const { FinancialAdviceSource } = require('../core/knowledge/FinancialAdviceSource');
  const source = new FinancialAdviceSource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/religion', asyncHandler(async (req, res) => {
  const { ReligionSource } = require('../core/knowledge/ReligionSource');
  const source = new ReligionSource();
  const { query, limit, religion } = req.body;
  const results = await source.search(query, { limit: limit || 10, religion });
  res.json({ results });
}));

app.post('/api/knowledge/mental-health', asyncHandler(async (req, res) => {
  const { MentalHealthSource } = require('../core/knowledge/MentalHealthSource');
  const source = new MentalHealthSource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/web-design', asyncHandler(async (req, res) => {
  const { WebDesignSource } = require('../core/knowledge/WebDesignSource');
  const source = new WebDesignSource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/ui-design', asyncHandler(async (req, res) => {
  const { UIDesignSource } = require('../core/knowledge/UIDesignSource');
  const source = new UIDesignSource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/backend-design', asyncHandler(async (req, res) => {
  const { BackendDesignSource } = require('../core/knowledge/BackendDesignSource');
  const source = new BackendDesignSource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/music-theory', asyncHandler(async (req, res) => {
  const { MusicTheorySource } = require('../core/knowledge/MusicTheorySource');
  const source = new MusicTheorySource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/llm-programming', asyncHandler(async (req, res) => {
  const { LLMProgrammingSource } = require('../core/knowledge/LLMProgrammingSource');
  const source = new LLMProgrammingSource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/anatomy', asyncHandler(async (req, res) => {
  const { AnatomySource } = require('../core/knowledge/AnatomySource');
  const source = new AnatomySource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/pottery', asyncHandler(async (req, res) => {
  const { PotterySource } = require('../core/knowledge/PotterySource');
  const source = new PotterySource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/gardening', asyncHandler(async (req, res) => {
  const { GardeningSource } = require('../core/knowledge/GardeningSource');
  const source = new GardeningSource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/cna', asyncHandler(async (req, res) => {
  const { CNASource } = require('../core/knowledge/CNASource');
  const source = new CNASource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/dsp', asyncHandler(async (req, res) => {
  const { DSPSource } = require('../core/knowledge/DSPSource');
  const source = new DSPSource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/rn', asyncHandler(async (req, res) => {
  const { RNSource } = require('../core/knowledge/RNSource');
  const source = new RNSource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/astronomy', asyncHandler(async (req, res) => {
  const { AstronomySource } = require('../core/knowledge/AstronomySource');
  const source = new AstronomySource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/astrology', asyncHandler(async (req, res) => {
  const { AstrologySource } = require('../core/knowledge/AstrologySource');
  const source = new AstrologySource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/botany', asyncHandler(async (req, res) => {
  const { BotanySource } = require('../core/knowledge/BotanySource');
  const source = new BotanySource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/marijuana-growing', asyncHandler(async (req, res) => {
  const { MarijuanaGrowingSource } = require('../core/knowledge/MarijuanaGrowingSource');
  const source = new MarijuanaGrowingSource();
  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 10 });
  res.json({ results });
}));

app.post('/api/knowledge/load-telegram', requireAuth, asyncHandler(async (req, res) => {
  if (!services?.documentManager) {
    return res.status(503).json({ error: 'Document manager not available' });
  }

  const { TelegramSource } = require('../core/knowledge/TelegramSource');
  const loader = new TelegramSource(services.embeddingService);
  const { filePath, generateEmbeddings, chunkSize } = req.body;

  const chunks = await loader.loadTelegramExport(filePath, {
    generateEmbeddings: generateEmbeddings !== false,
    chunkSize: chunkSize || 20,
  });

  for (const chunk of chunks) {
    await services.documentManager.addText(chunk.content, chunk.metadata);
  }

  res.json({ success: true, chunks: chunks.length });
}));

app.post('/api/knowledge/wikipedia', asyncHandler(async (req, res) => {
  const { WikipediaSource } = require('../core/knowledge/WikipediaSource');
  const source = new WikipediaSource();

  const { query, limit } = req.body;
  const results = await source.search(query, { limit: limit || 5 });

  res.json({ results });
}));

app.post('/api/knowledge/scrape', requireAuth, asyncHandler(async (req, res) => {
  const { WebScraperSource } = require('../core/knowledge/WebScraperSource');
  const { urls, allowedDomains } = req.body;

  const source = new WebScraperSource(allowedDomains || []);
  const results = await source.search('', { urls, limit: urls?.length || 5 });

  res.json({ results });
}));

// Dataset loading endpoints
app.post('/api/knowledge/load-csv', requireAuth, asyncHandler(async (req, res) => {
  if (!services?.documentManager) {
    return res.status(503).json({ error: 'Document manager not available' });
  }

  const { DatasetLoader } = require('../core/knowledge/DatasetLoader');
  const { EmbeddingService } = require('../core/embeddings/EmbeddingService');

  const loader = new DatasetLoader(services.embeddingService);
  const { filePath, generateEmbeddings, chunkSize } = req.body;

  const chunks = await loader.loadCSV(filePath, {
    generateEmbeddings: generateEmbeddings !== false,
    chunkSize: chunkSize || 10,
  });

  // Add to knowledge base
  for (const chunk of chunks) {
    await services.documentManager.addText(chunk.content, chunk.metadata);
  }

  res.json({ success: true, chunks: chunks.length });
}));

app.post('/api/knowledge/load-json', requireAuth, asyncHandler(async (req, res) => {
  if (!services?.documentManager) {
    return res.status(503).json({ error: 'Document manager not available' });
  }

  const { DatasetLoader } = require('../core/knowledge/DatasetLoader');
  const loader = new DatasetLoader(services.embeddingService);
  const { filePath, generateEmbeddings, chunkSize } = req.body;

  const chunks = await loader.loadJSON(filePath, {
    generateEmbeddings: generateEmbeddings !== false,
    chunkSize: chunkSize || 5,
  });

  for (const chunk of chunks) {
    await services.documentManager.addText(chunk.content, chunk.metadata);
  }

  res.json({ success: true, chunks: chunks.length });
}));

// Knowledge graph endpoints
app.post('/api/knowledge/graph/entity', requireAuth, asyncHandler(async (req, res) => {
  const { KnowledgeGraph } = require('../core/knowledge/KnowledgeGraph');
  const graph = new KnowledgeGraph();

  const { id, name, type, properties } = req.body;
  graph.addEntity({ id, name, type, properties });

  res.json({ success: true });
}));

app.get('/api/knowledge/graph/query', requireAuth, asyncHandler(async (req, res) => {
  const { KnowledgeGraph } = require('../core/knowledge/KnowledgeGraph');
  const graph = new KnowledgeGraph();

  const { entityId, entityName, relationshipType, limit } = req.query;
  const entities = graph.queryEntities({ entityId: entityId as string, entityName: entityName as string, limit: parseInt(limit as string) || 50 });
  const relationships = graph.queryRelationships({ entityId: entityId as string, relationshipType: relationshipType as string, limit: parseInt(limit as string) || 50 });

  res.json({ entities, relationships, stats: graph.getStats() });
}));

// Knowledge fusion endpoint
app.post('/api/knowledge/fuse', requireAuth, asyncHandler(async (req, res) => {
  if (!services?.orchestrator) {
    return res.status(503).json({ error: 'Orchestrator not available' });
  }

  const { KnowledgeFusion } = require('../core/knowledge/KnowledgeFusion');
  const { WikipediaSource } = require('../core/knowledge/WikipediaSource');
  const { WebScraperSource } = require('../core/knowledge/WebScraperSource');

  const primaryAdapter = (services.orchestrator as any).llmAdapter;
  const fusion = new KnowledgeFusion(primaryAdapter);

  const { query, sources, maxResults, minConfidence } = req.body;

  const sourceInstances = [];
  if (sources.includes('wikipedia')) {
    sourceInstances.push(new WikipediaSource());
  }
  if (sources.includes('web')) {
    sourceInstances.push(new WebScraperSource());
  }
  if (sources.includes('reddit')) {
    const { RedditSource } = require('../core/knowledge/RedditSource');
    sourceInstances.push(new RedditSource());
  }
  if (sources.includes('youtube')) {
    const { YouTubeSource } = require('../core/knowledge/YouTubeSource');
    sourceInstances.push(new YouTubeSource(process.env.YOUTUBE_API_KEY));
  }
  if (sources.includes('github')) {
    const { GitHubSource } = require('../core/knowledge/GitHubSource');
    sourceInstances.push(new GitHubSource(process.env.GITHUB_TOKEN));
  }
  if (sources.includes('papers')) {
    const { ScientificPapersSource } = require('../core/knowledge/ScientificPapersSource');
    sourceInstances.push(new ScientificPapersSource('all'));
  }
  if (sources.includes('stackoverflow')) {
    const { StackOverflowSource } = require('../core/knowledge/StackOverflowSource');
    sourceInstances.push(new StackOverflowSource(process.env.STACKOVERFLOW_API_KEY));
  }
  if (sources.includes('news')) {
    const { NewsSource } = require('../core/knowledge/NewsSource');
    sourceInstances.push(new NewsSource('all', process.env.NEWS_API_KEY, process.env.GUARDIAN_API_KEY, process.env.NYTIMES_API_KEY));
  }
  if (sources.includes('medium')) {
    const { MediumSource } = require('../core/knowledge/MediumSource');
    sourceInstances.push(new MediumSource());
  }
  if (sources.includes('quora')) {
    const { QuoraSource } = require('../core/knowledge/QuoraSource');
    sourceInstances.push(new QuoraSource());
  }
  if (sources.includes('docs')) {
    const { DocumentationSource } = require('../core/knowledge/DocumentationSource');
    sourceInstances.push(new DocumentationSource('all'));
  }
  if (sources.includes('library_of_congress') || sources.includes('loc')) {
    const { LibraryOfCongressSource } = require('../core/knowledge/LibraryOfCongressSource');
    sourceInstances.push(new LibraryOfCongressSource());
  }
  if (sources.includes('entertainment') || sources.includes('movies') || sources.includes('comics')) {
    const { EntertainmentSource } = require('../core/knowledge/EntertainmentSource');
    sourceInstances.push(new EntertainmentSource('all', process.env.TMDB_API_KEY));
  }
  if (sources.includes('books') || sources.includes('novels')) {
    const { BookSource } = require('../core/knowledge/BookSource');
    sourceInstances.push(new BookSource('all', process.env.GOOGLE_BOOKS_API_KEY));
  }
  if (sources.includes('specialized') || sources.includes('civil_rights') || sources.includes('compliance') || sources.includes('hip_hop') || sources.includes('connecticut')) {
    const { SpecializedTopicSource } = require('../core/knowledge/SpecializedTopicSource');
    sourceInstances.push(new SpecializedTopicSource('all'));
  }
  if (sources.includes('financial') || sources.includes('financial_advice')) {
    const { FinancialAdviceSource } = require('../core/knowledge/FinancialAdviceSource');
    sourceInstances.push(new FinancialAdviceSource());
  }
  if (sources.includes('religion')) {
    const { ReligionSource } = require('../core/knowledge/ReligionSource');
    sourceInstances.push(new ReligionSource());
  }
  if (sources.includes('mental_health')) {
    const { MentalHealthSource } = require('../core/knowledge/MentalHealthSource');
    sourceInstances.push(new MentalHealthSource());
  }
  if (sources.includes('web_design')) {
    const { WebDesignSource } = require('../core/knowledge/WebDesignSource');
    sourceInstances.push(new WebDesignSource());
  }
  if (sources.includes('ui_design')) {
    const { UIDesignSource } = require('../core/knowledge/UIDesignSource');
    sourceInstances.push(new UIDesignSource());
  }
  if (sources.includes('backend_design')) {
    const { BackendDesignSource } = require('../core/knowledge/BackendDesignSource');
    sourceInstances.push(new BackendDesignSource());
  }
  if (sources.includes('music_theory')) {
    const { MusicTheorySource } = require('../core/knowledge/MusicTheorySource');
    sourceInstances.push(new MusicTheorySource());
  }
  if (sources.includes('llm') || sources.includes('llm_programming')) {
    const { LLMProgrammingSource } = require('../core/knowledge/LLMProgrammingSource');
    sourceInstances.push(new LLMProgrammingSource());
  }
  if (sources.includes('anatomy')) {
    const { AnatomySource } = require('../core/knowledge/AnatomySource');
    sourceInstances.push(new AnatomySource());
  }
  if (sources.includes('pottery')) {
    const { PotterySource } = require('../core/knowledge/PotterySource');
    sourceInstances.push(new PotterySource());
  }
  if (sources.includes('gardening')) {
    const { GardeningSource } = require('../core/knowledge/GardeningSource');
    sourceInstances.push(new GardeningSource());
  }
  if (sources.includes('cna')) {
    const { CNASource } = require('../core/knowledge/CNASource');
    sourceInstances.push(new CNASource());
  }
  if (sources.includes('dsp')) {
    const { DSPSource } = require('../core/knowledge/DSPSource');
    sourceInstances.push(new DSPSource());
  }
  if (sources.includes('rn')) {
    const { RNSource } = require('../core/knowledge/RNSource');
    sourceInstances.push(new RNSource());
  }
  if (sources.includes('astronomy')) {
    const { AstronomySource } = require('../core/knowledge/AstronomySource');
    sourceInstances.push(new AstronomySource());
  }
  if (sources.includes('astrology')) {
    const { AstrologySource } = require('../core/knowledge/AstrologySource');
    sourceInstances.push(new AstrologySource());
  }
  if (sources.includes('botany')) {
    const { BotanySource } = require('../core/knowledge/BotanySource');
    sourceInstances.push(new BotanySource());
  }
  if (sources.includes('marijuana') || sources.includes('cannabis') || sources.includes('growing')) {
    const { MarijuanaGrowingSource } = require('../core/knowledge/MarijuanaGrowingSource');
    sourceInstances.push(new MarijuanaGrowingSource());
  }

  const results = await fusion.fuse({
    sources: sourceInstances,
    query,
    maxResults: maxResults || 10,
    minConfidence: minConfidence || 0.5,
    summarize: true,
  });

  res.json({ results });
}));

// Reasoning endpoint
app.post('/api/reasoning/chain-of-thought', requireAuth, asyncHandler(async (req, res) => {
  if (!services?.orchestrator) {
    return res.status(503).json({ error: 'Orchestrator not available' });
  }

  const { ReasoningEngine } = require('../core/knowledge/ReasoningEngine');
  const primaryAdapter = (services.orchestrator as any).llmAdapter;
  const engine = new ReasoningEngine(primaryAdapter);

  const { question, context, maxSteps } = req.body;
  const result = await engine.chainOfThought(question, context, maxSteps || 5);

  res.json({ result });
}));

// Debug endpoint
app.get('/api/debug/:requestId', requireAuth, asyncHandler(async (req, res) => {
  const { DebugMode } = require('../core/debug/DebugMode');
  const debugMode = new DebugMode();

  const debugInfo = debugMode.getDebugInfo(req.params.requestId);
  if (!debugInfo) {
    return res.status(404).json({ error: 'Debug info not found' });
  }

  res.json({ debugInfo });
}));

// Conversation management endpoints
app.get('/api/conversations', requireAuth, asyncHandler(async (req, res) => {
  const conversationManager = getConversationManager();

  const userId = req.user?.userId;
  const limit = parseInt(req.query.limit as string) || 20;

  const conversations = await conversationManager.listConversations(userId, limit);
  res.json({ conversations });
}));

app.get('/api/conversations/:sessionId', requireAuth, asyncHandler(async (req, res) => {
  const conversationManager = getConversationManager();

  const conversation = await conversationManager.getConversation(req.params.sessionId);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  res.json({ conversation });
}));

app.delete('/api/conversations/:sessionId', requireAuth, asyncHandler(async (req, res) => {
  const conversationManager = getConversationManager();

  const deleted = await conversationManager.deleteConversation(req.params.sessionId);
  res.json({ success: deleted });
}));

// Webhook management endpoints
app.post('/api/webhooks', adminOnly, auditPrivilegedRequest('webhooks:create'), asyncHandler(async (req, res) => {
  const { WebhookService } = require('../core/webhooks/WebhookService');
  const webhookService = new WebhookService();

  const { url, events, secret } = req.body;
  const validatedUrl = validateWebhookUrl(String(url || ''));
  const webhook = webhookService.register({
    url: validatedUrl,
    events: events || ['*'],
    secret,
    active: true,
  });

  res.json({ success: true, webhook });
}));

app.get('/api/webhooks', adminOnly, auditPrivilegedRequest('webhooks:list'), asyncHandler(async (req, res) => {
  const { WebhookService } = require('../core/webhooks/WebhookService');
  const webhookService = new WebhookService();
  res.json({ webhooks: webhookService.list() });
}));

app.delete('/api/webhooks/:id', adminOnly, auditPrivilegedRequest('webhooks:delete'), asyncHandler(async (req, res) => {
  const { WebhookService } = require('../core/webhooks/WebhookService');
  const webhookService = new WebhookService();
  const deleted = webhookService.unregister(req.params.id);
  res.json({ success: deleted });
}));

if (fs.existsSync(CLIENT_DIST_DIR)) {
  app.use(express.static(CLIENT_DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path === '/metrics') {
      next();
      return;
    }

    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  });
  logger.info('Serving built client', { path: CLIENT_DIST_DIR });
} else {
  logger.warn('Built client not found; run npm run build before production start', {
    path: CLIENT_DIST_DIR
  });
}

// Error handler (must be last)
app.use(errorHandler);

// Start server (wait for initialization)
const startServer = async () => {
  try {
    logger.info('Waiting for services to initialize...');
    await waitForReady(STARTUP_TIMEOUT_MS);

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📚 Knowledge base: ${process.env.KNOWLEDGE_BASE_DIR || './knowledge-base'}`);
      logger.info(`🔧 Features enabled:`);
      logger.info(`   - RAG: ${process.env.ENABLE_RAG !== 'false' ? '✅' : '❌'}`);
      logger.info(`   - Model Routing: ${process.env.ENABLE_MODEL_ROUTING !== 'false' ? '✅' : '❌'}`);
      logger.info(`   - Safety Pipeline: ${process.env.ENABLE_SAFETY_PIPELINE !== 'false' ? '✅' : '❌'}`);
      logger.info(`   - Semantic Cache: ${process.env.ENABLE_SEMANTIC_CACHE !== 'false' ? '✅' : '❌'}`);
      logger.info(`   - WebSocket: ${wsServer ? '✅' : '❌'}`);
    });
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();
