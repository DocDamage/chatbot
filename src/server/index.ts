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
import { ServiceInitializer } from '../core/initialization/ServiceInitializer';
import { StableDiffusionAdapter } from '../core/providers/StableDiffusionAdapter';
import { ConfigValidator } from '../core/config/ConfigValidator';
import { logger } from '../core/observability/logger';
import { metricsCollector } from '../core/observability/metrics';
import { ChatRequest } from '../core/orchestrator/Orchestrator';
import { rateLimiter } from '../middleware/rateLimiter';
import { validateChatRequest, sanitizeInput } from '../middleware/validator';
import { errorHandler, asyncHandler } from '../middleware/errorHandler';
import { securityHeaders, corsOptions } from '../middleware/security';
import { requireAuth } from '../middleware/auth';
import { createRagQueryRouter } from './routes/rag-query';
import { createKnowledgeBaseRouter } from './routes/knowledge-base';
import { createCodeRouter } from './routes/code';
import { createMathRouter } from './routes/math';
import { createMarketRouter } from './routes/market';
import { createGameDevRouter } from './routes/gamedev';
import { createSixSigmaRouter } from './routes/sixsigma';
import { createChronoRouter } from './routes/chrono';
import { createPopCultureRouter } from './routes/pop-culture';
import { createHistoryRouter } from './routes/history';
import { createScienceRouter } from './routes/science';
import { LocalKnowledgeAnswerer } from '../core/knowledge/LocalKnowledgeAnswerer';
import { createMusicProductionGeniusRouter } from './routes/music';
import { createFLStudioControlRouter } from './routes/flstudio';
import { createStoryGeniusRouter } from './routes/story';
import { createLegalCivicGeniusRouter } from './routes/legal';
import { createHealthGeniusRouter } from './routes/health';
import { createSecurityGeniusRouter } from './routes/security';
import { createBusinessGeniusRouter } from './routes/business';
import { createPhilosophyGeniusRouter } from './routes/philosophy';
import { createLanguageGeniusRouter } from './routes/language';
import { createGeoCultureGeniusRouter } from './routes/geography';
import { createEngineeringGeniusRouter } from './routes/engineering';

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

// Initialize all services automatically
let services: any;
let orchestrator: any;

type ChatSpecialistMode =
  | 'pop_culture'
  | 'history'
  | 'science'
  | 'music'
  | 'suno'
  | 'fl_studio'
  | 'fl_studio_control'
  | 'pro_tools'
  | 'logic'
  | 'mix_master'
  | 'story'
  | 'legal'
  | 'health'
  | 'security'
  | 'business'
  | 'philosophy'
  | 'language'
  | 'geography'
  | 'engineering';

const specialistModes = new Set([
  'pop_culture',
  'history',
  'science',
  'music',
  'suno',
  'fl_studio',
  'fl_studio_control',
  'pro_tools',
  'logic',
  'mix_master',
  'story',
  'legal',
  'health',
  'security',
  'business',
  'philosophy',
  'language',
  'geography',
  'engineering'
]);

function inferChatSpecialistMode(message: string, mode?: string): ChatSpecialistMode | undefined {
  if (mode && specialistModes.has(mode)) {
    return mode as ChatSpecialistMode;
  }

  const text = message.toLowerCase();
  if (/\b(connect to fl|control fl|fl studio control|piano roll|channel rack|mixer track|send chord|send notes|step sequence|solo the drums|turn down track|transport)\b/.test(text)) {
    return 'fl_studio_control';
  }
  if (/\b(suno|fl studio|pro tools|logic pro|logic|daw|loop|beat|808|bpm|mix|mastering|muddy|chord|drum pattern|sample|soundtrack|neptunes|genre timeline|vocal chain|channel rack|piano roll)\b/.test(text)) {
    return 'music';
  }
  if (/(pop culture|movie|film|tv|television|music|album|song|radio|comic|animation|video game|celebrity|award|franchise|meme)/.test(text)) {
    return 'pop_culture';
  }
  if (/\b(plot|character|dialogue|worldbuild|worldbuilding|lore|quest|faction|scene|story|backstory)\b/.test(text)) {
    return 'story';
  }
  if (/\b(threat model|secure code|security|privacy|dependency audit|secrets scan|auth flow|auth|authentication|login|jwt|oauth|session|cookie|password reset|csrf|vulnerability)\b/.test(text)) {
    return 'security';
  }
  if (/\b(contract|clause|legal|civic|jurisdiction|statute|case law|rights|obligations|non-compete|noncompete|enforceable|indemnification|liability|lawsuit|sued)\b/.test(text)) {
    return 'legal';
  }
  if (/\b(symptom|anatomy|nutrition|fitness|medication|medicine|drug interaction|side effect|red flag|health|chest pain|shortness of breath|workout|calories|macros|protein|knee pain|shoulder pain|back pain)\b/.test(text)) {
    return 'health';
  }
  if (/\b(pricing|unit economics|business model|startup|product strategy|market research|kpi|kpis|metric|metrics|mrr|arpu|cac|ltv|payback|activation|retention)\b/.test(text)) {
    return 'business';
  }
  if (/\b(argument|fallacy|ethics|debate|socratic|philosophy)\b/.test(text)) {
    return 'philosophy';
  }
  if (/\b(translate|rewrite|tone|grammar|rhetoric|speech|readability)\b/.test(text)) {
    return 'language';
  }
  if (/\b(country|culture|map|geography|demographics|geopolitical|language region)\b/.test(text)) {
    return 'geography';
  }
  if (/\b(ohm|circuit|motor|robot|robotics|mechanical|beam load|cad|bom|electronics)\b/.test(text)) {
    return 'engineering';
  }
  if (/\b(history|historical|ancient|medieval|empire|war|civilization|archaeology|archaeological|dynasty|revolution|bc|bce|ce)\b/.test(text)) {
    return 'history';
  }
  if (/(invention|invented|discovery|science|scientific|paper|patent|technology|physics|chemistry|biology|astronomy|medicine)/.test(text)) {
    return 'science';
  }
  if (/(tell me (something|the biggest story|a story)|biggest story|top story|major event|what happened|what was big|what was popular|pop culture reference).{0,24}\b(19[2-9]\d|20[0-2]\d)\b/.test(text)) {
    return 'pop_culture';
  }

  return undefined;
}

async function processSpecialistChat(message: string, mode: ChatSpecialistMode) {
  if (!services) return undefined;

  if (mode === 'pop_culture' || mode === 'history' || mode === 'science') {
    const localKnowledge = new LocalKnowledgeAnswerer(services.ragDocumentStore);
    const localAnswer = await localKnowledge.answer(message, mode);
    if (localAnswer.sources.length > 0 || /\b(?:19[2-9]\d|20[0-2]\d)\b/.test(message)) {
      return localAnswer;
    }
  }

  if (mode === 'pop_culture' && services.popCultureGeniusAgent) {
    const result = await services.popCultureGeniusAgent.ask(message);
    return {
      response: result.response,
      sources: result.sources,
      mode,
      model: 'pop-culture-specialist'
    };
  }

  if (mode === 'history' && services.historyGeniusAgent) {
    const result = await services.historyGeniusAgent.ask(message);
    return {
      response: result.response,
      sources: result.sources,
      mode,
      model: 'history-specialist'
    };
  }

  if (mode === 'science' && services.scienceInventionGeniusAgent) {
    const result = await services.scienceInventionGeniusAgent.ask(message);
    return {
      response: result.response,
      sources: result.sources,
      mode,
      model: 'science-specialist'
    };
  }

  if (mode === 'fl_studio_control' && services.flStudioControlAgent) {
    return services.flStudioControlAgent.command(message, { mode: 'dry_run' });
  }

  if (['suno', 'fl_studio', 'pro_tools', 'logic', 'mix_master'].includes(mode)) {
    const musicAgent = services.musicProductionGeniusAgent;
    if (mode === 'suno') return musicAgent.sunoPrompt(message);
    if (mode === 'fl_studio') return musicAgent.flStudioWorkflow(message);
    if (mode === 'pro_tools') return musicAgent.proToolsWorkflow(message);
    if (mode === 'logic') return musicAgent.logicWorkflow(message);
    if (mode === 'mix_master') return musicAgent.mix(message);
  }

  const genericAgents: Record<string, any> = {
    music: services.musicProductionGeniusAgent,
    story: services.storyGeniusAgent,
    legal: services.legalCivicGeniusAgent,
    health: services.healthGeniusAgent,
    security: services.securityGeniusAgent,
    business: services.businessGeniusAgent,
    philosophy: services.philosophyGeniusAgent,
    language: services.languageGeniusAgent,
    geography: services.geoCultureGeniusAgent,
    engineering: services.engineeringGeniusAgent
  };

  if (genericAgents[mode]) {
    return genericAgents[mode].ask(message);
  }

  return undefined;
}

const ENV_PATH = path.join(process.cwd(), '.env');
const SETTINGS_KEYS = [
  'LLM_PROVIDER',
  'USE_OLLAMA',
  'OLLAMA_URL',
  'OLLAMA_MODEL',
  'USE_HUGGINGFACE',
  'HUGGINGFACE_MODEL',
  'HUGGINGFACE_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_COMPATIBLE_API_KEY',
  'OPENAI_COMPATIBLE_BASE_URL',
  'OPENAI_COMPATIBLE_MODEL',
  'OPENAI_COMPATIBLE_PROVIDER_NAME',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'USE_STABLE_DIFFUSION',
  'STABLE_DIFFUSION_URL',
  'EMBEDDING_PROVIDER',
  'EMBEDDING_MODEL',
  'EMBEDDING_USE_TRANSFORMERS',
  'FL_STUDIO_MCP_COMMAND',
  'FL_STUDIO_MCP_ARGS',
  'FL_STUDIO_MCP_CWD'
];

const PUBLIC_SETTINGS_KEYS = SETTINGS_KEYS.filter(key => !key.endsWith('_API_KEY'));

function maskSecret(value?: string): string {
  if (!value) return '';
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};

  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce<Record<string, string>>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return acc;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      acc[key] = value.replace(/^["']|["']$/g, '');
      return acc;
    }, {});
}

function serializeEnvValue(value: string): string {
  return /[\s#"'\\]/.test(value) ? JSON.stringify(value) : value;
}

function writeEnvUpdates(updates: Record<string, string>): void {
  const existing = parseEnvFile(ENV_PATH);
  const merged = { ...existing, ...updates };
  const lines: string[] = [
    'PORT=3001',
    'NODE_ENV=development',
    `JWT_SECRET=${serializeEnvValue(merged.JWT_SECRET || process.env.JWT_SECRET || 'local-dev-jwt-secret-5c17f8b96a514fc9a8c9b51d')}`,
    '',
    '# Model provider settings managed from the app settings menu'
  ];

  for (const key of SETTINGS_KEYS) {
    if (merged[key] !== undefined) {
      lines.push(`${key}=${serializeEnvValue(merged[key])}`);
    }
  }

  lines.push(
    '',
    'ENABLE_RAG=true',
    'ENABLE_MODEL_ROUTING=true',
    'ENABLE_ENSEMBLE=false',
    'ENABLE_SAFETY_PIPELINE=true',
    'ENABLE_SEMANTIC_CACHE=true',
    'ENABLE_REDIS_CACHE=false',
    'ENABLE_DISK_CACHE=true',
    'LOG_LEVEL=info'
  );

  fs.writeFileSync(ENV_PATH, `${lines.join('\n')}\n`);

  for (const [key, value] of Object.entries(merged)) {
    process.env[key] = value;
  }
}

function getProviderStatus() {
  const configured = {
    ollama: process.env.USE_OLLAMA !== 'false',
    huggingface: process.env.USE_HUGGINGFACE === 'true' && !!process.env.HUGGINGFACE_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    openaiCompatible: !!process.env.OPENAI_COMPATIBLE_API_KEY && !!process.env.OPENAI_COMPATIBLE_BASE_URL,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    stableDiffusion: process.env.USE_STABLE_DIFFUSION === 'true',
    transformers: process.env.EMBEDDING_USE_TRANSFORMERS === 'true'
  };

  const selectedProvider = process.env.LLM_PROVIDER || 'template';
  const activeProvider = selectedProvider === 'openai-compatible' && configured.openaiCompatible
    ? 'openai-compatible'
    : selectedProvider === 'openai' && configured.openai
    ? 'openai'
    : selectedProvider === 'anthropic' && configured.anthropic
      ? 'anthropic'
    : selectedProvider === 'gemini' && configured.gemini
      ? 'gemini'
    : selectedProvider === 'huggingface' && configured.huggingface
      ? 'huggingface'
      : selectedProvider === 'ollama' && configured.ollama
        ? 'ollama'
        : 'template';

  return {
    activeProvider,
    configured,
    model: orchestrator ? 'ready' : 'initializing'
  };
}

async function reinitializeServices(): Promise<void> {
  services = await ServiceInitializer.initialize();
  orchestrator = services.orchestrator;
}

// Start initialization immediately
(async () => {
  try {
    logger.info('🚀 Initializing all services...');
    await reinitializeServices();

    // Also initialize Stable Diffusion for image generation (if enabled)
    const sdUrl = process.env.STABLE_DIFFUSION_URL || 'http://localhost:7860';
    const useStableDiffusion = process.env.USE_STABLE_DIFFUSION !== 'false';

    if (useStableDiffusion) {
      logger.info('Using Stable Diffusion for image generation', { url: sdUrl });
      const imageAdapter = new StableDiffusionAdapter(sdUrl);

      imageAdapter.checkAvailability().then((available) => {
        if (available) {
          logger.info('Stable Diffusion is available');
        } else {
          logger.warn('Stable Diffusion is not available. Install Automatic1111 WebUI or similar.');
        }
      });
    }

    logger.info('✅ All services initialized and ready');
  } catch (error: any) {
    logger.error('Failed to initialize services', { error: error.message });
    process.exit(1);
  }
})();

// Health check with detailed status
app.get('/health', asyncHandler(async (req, res) => {
  const health: any = {
    status: orchestrator ? 'ready' : 'initializing',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    services: {
      orchestrator: !!orchestrator,
      rag: !!services?.ragService,
      tools: !!services?.toolRegistry,
      vision: !!services?.visionAdapter,
    },
    dependencies: {},
  };

  // Check Ollama
  if (process.env.USE_OLLAMA !== 'false') {
    try {
      const axios = require('axios');
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      await axios.get(`${ollamaUrl}/api/tags`, { timeout: 2000 });
      health.dependencies.ollama = 'healthy';
    } catch (error) {
      health.dependencies.ollama = 'unhealthy';
    }
  }

  // Check Redis
  if (process.env.ENABLE_REDIS_CACHE === 'true' && process.env.REDIS_URL) {
    try {
      const Redis = require('ioredis');
      const redis = new Redis(process.env.REDIS_URL);
      await redis.ping();
      redis.disconnect();
      health.dependencies.redis = 'healthy';
    } catch (error) {
      health.dependencies.redis = 'unhealthy';
    }
  }

  // Check disk space
  try {
    const fs = require('fs');
    const stats = fs.statSync(process.cwd());
    health.dependencies.disk = 'healthy';
  } catch (error) {
    health.dependencies.disk = 'unhealthy';
  }

  const allHealthy = Object.values(health.dependencies).every(status => status === 'healthy');
  if (!allHealthy && orchestrator) {
    health.status = 'degraded';
  }

  res.json(health);
}));

// Kubernetes readiness probe
app.get('/health/ready', asyncHandler(async (req, res) => {
  if (!orchestrator) {
    return res.status(503).json({ status: 'not ready' });
  }
  res.json({ status: 'ready' });
}));

// Kubernetes liveness probe
app.get('/health/live', (req, res) => {
  res.json({ status: 'alive' });
});

// Metrics endpoint (JSON)
app.get('/api/metrics', asyncHandler(async (req, res) => {
  if (!orchestrator) {
    return res.status(503).json({ error: 'Services not initialized yet' });
  }

  const metrics = {
    timestamp: new Date().toISOString(),
    system: {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      uptime: process.uptime()
    },
    application: metricsCollector.getMetrics(),
    cache: services?.cache?.getStats() || {}
  };
  res.json(metrics);
}));

// Prometheus metrics endpoint
app.get('/metrics', asyncHandler(async (req, res) => {
  const { PrometheusExporter } = require('../observability/prometheus');
  const metrics = PrometheusExporter.getApplicationMetrics();
  res.setHeader('Content-Type', 'text/plain');
  res.send(metrics);
}));

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
app.use('/api/v1', asyncHandler(async (req, res, next) => {
  if (!orchestrator) {
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (orchestrator) {
          clearInterval(checkInterval);
          resolve(undefined);
        }
      }, 100);
    });
  }
  next();
}), (req, res, next) => {
  const { createChatRouter } = require('./routes/v1/chat');
  const router = createChatRouter(orchestrator);
  router(req, res, next);
});

app.use('/api/v2', asyncHandler(async (req, res, next) => {
  if (!orchestrator) {
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (orchestrator) {
          clearInterval(checkInterval);
          resolve(undefined);
        }
      }, 100);
    });
  }
  next();
}), (req, res, next) => {
  const { createChatRouterV2 } = require('./routes/v2/chat');
  const router = createChatRouterV2(orchestrator);
  router(req, res, next);
});

// Legacy endpoint (defaults to v1)
app.post('/api/chat',
  rateLimiter.middleware(),
  validateChatRequest,
  asyncHandler(async (req, res) => {
    // Wait for services to initialize
    if (!orchestrator) {
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (orchestrator) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });
    }

    const { message, sessionId, userId, mode } = req.body;

    // Sanitize input
    const sanitizedMessage = sanitizeInput(message);
    const specialistMode = inferChatSpecialistMode(sanitizedMessage, mode);

    if (specialistMode) {
      return res.json(await processSpecialistChat(sanitizedMessage, specialistMode));
    }

    if (!mode || mode === 'ask') {
      const localKnowledge = new LocalKnowledgeAnswerer(services?.ragDocumentStore);
      const localResponse = await localKnowledge.answer(sanitizedMessage, 'ask');
      if (localResponse) {
        return res.json(localResponse);
      }
    }

    const request: ChatRequest = {
      message: sanitizedMessage,
      sessionId,
      userId
    };

    const response = await orchestrator.processRequest(request);

    res.json(response);
  })
);

// Knowledge base management endpoints
app.post('/api/knowledge-base/add', asyncHandler(async (req, res) => {
  if (!services?.documentManager) {
    return res.status(503).json({ error: 'Document manager not initialized' });
  }

  const { text, metadata } = req.body;
  const chunks = await services.documentManager.addText(text, metadata || {});
  res.json({ success: true, chunksCount: chunks.length });
}));

app.post('/api/knowledge-base/file', asyncHandler(async (req, res) => {
  if (!services?.documentManager) {
    return res.status(503).json({ error: 'Document manager not initialized' });
  }

  const { filePath } = req.body;
  const chunks = await services.documentManager.addFile(filePath);
  res.json({ success: true, chunksCount: chunks.length });
}));

app.use((req, res, next) => {
  const router = createKnowledgeBaseRouter(services);
  router(req, res, next);
});

// Tools endpoint
app.get('/api/tools', asyncHandler(async (req, res) => {
  if (!services?.toolRegistry) {
    return res.status(503).json({ error: 'Tool registry not initialized' });
  }

  res.json({
    tools: services.toolRegistry.getAll().map(tool => ({
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

app.get('/api/settings', asyncHandler(async (_req, res) => {
  const envFile = parseEnvFile(ENV_PATH);
  const settings: Record<string, string> = {};

  for (const key of PUBLIC_SETTINGS_KEYS) {
    settings[key] = process.env[key] || envFile[key] || '';
  }

  res.json({
    settings,
    secrets: {
      OPENAI_API_KEY: {
        configured: !!(process.env.OPENAI_API_KEY || envFile.OPENAI_API_KEY),
        preview: maskSecret(process.env.OPENAI_API_KEY || envFile.OPENAI_API_KEY)
      },
      HUGGINGFACE_API_KEY: {
        configured: !!(process.env.HUGGINGFACE_API_KEY || envFile.HUGGINGFACE_API_KEY),
        preview: maskSecret(process.env.HUGGINGFACE_API_KEY || envFile.HUGGINGFACE_API_KEY)
      },
      OPENAI_COMPATIBLE_API_KEY: {
        configured: !!(process.env.OPENAI_COMPATIBLE_API_KEY || envFile.OPENAI_COMPATIBLE_API_KEY),
        preview: maskSecret(process.env.OPENAI_COMPATIBLE_API_KEY || envFile.OPENAI_COMPATIBLE_API_KEY)
      },
      ANTHROPIC_API_KEY: {
        configured: !!(process.env.ANTHROPIC_API_KEY || envFile.ANTHROPIC_API_KEY),
        preview: maskSecret(process.env.ANTHROPIC_API_KEY || envFile.ANTHROPIC_API_KEY)
      },
      GEMINI_API_KEY: {
        configured: !!(process.env.GEMINI_API_KEY || envFile.GEMINI_API_KEY),
        preview: maskSecret(process.env.GEMINI_API_KEY || envFile.GEMINI_API_KEY)
      }
    },
    status: getProviderStatus()
  });
}));

app.put('/api/settings', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const current = parseEnvFile(ENV_PATH);
  const updates: Record<string, string> = {};

  const selectedProvider = String(body.provider || 'template');

  for (const key of PUBLIC_SETTINGS_KEYS) {
    if (body[key] !== undefined) {
      updates[key] = String(body[key]);
    }
  }

  if (body.OPENAI_API_KEY !== undefined && String(body.OPENAI_API_KEY).trim()) {
    updates.OPENAI_API_KEY = String(body.OPENAI_API_KEY).trim();
  } else if (current.OPENAI_API_KEY) {
    updates.OPENAI_API_KEY = current.OPENAI_API_KEY;
  }

  if (body.HUGGINGFACE_API_KEY !== undefined && String(body.HUGGINGFACE_API_KEY).trim()) {
    updates.HUGGINGFACE_API_KEY = String(body.HUGGINGFACE_API_KEY).trim();
  } else if (current.HUGGINGFACE_API_KEY) {
    updates.HUGGINGFACE_API_KEY = current.HUGGINGFACE_API_KEY;
  }

  if (body.OPENAI_COMPATIBLE_API_KEY !== undefined && String(body.OPENAI_COMPATIBLE_API_KEY).trim()) {
    updates.OPENAI_COMPATIBLE_API_KEY = String(body.OPENAI_COMPATIBLE_API_KEY).trim();
  } else if (current.OPENAI_COMPATIBLE_API_KEY) {
    updates.OPENAI_COMPATIBLE_API_KEY = current.OPENAI_COMPATIBLE_API_KEY;
  }

  if (body.ANTHROPIC_API_KEY !== undefined && String(body.ANTHROPIC_API_KEY).trim()) {
    updates.ANTHROPIC_API_KEY = String(body.ANTHROPIC_API_KEY).trim();
  } else if (current.ANTHROPIC_API_KEY) {
    updates.ANTHROPIC_API_KEY = current.ANTHROPIC_API_KEY;
  }

  if (body.GEMINI_API_KEY !== undefined && String(body.GEMINI_API_KEY).trim()) {
    updates.GEMINI_API_KEY = String(body.GEMINI_API_KEY).trim();
  } else if (current.GEMINI_API_KEY) {
    updates.GEMINI_API_KEY = current.GEMINI_API_KEY;
  }

  updates.USE_OLLAMA = selectedProvider === 'ollama' ? 'true' : 'false';
  updates.USE_HUGGINGFACE = selectedProvider === 'huggingface' ? 'true' : 'false';
  updates.LLM_PROVIDER = selectedProvider;

  if (selectedProvider === 'openai' && !updates.OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
    return res.status(400).json({ error: 'OPENAI_API_KEY is required when OpenAI is selected' });
  }

  if (selectedProvider === 'openai-compatible' && !updates.OPENAI_COMPATIBLE_API_KEY && !process.env.OPENAI_COMPATIBLE_API_KEY) {
    return res.status(400).json({ error: 'An API key is required for this provider' });
  }

  if (selectedProvider === 'openai-compatible' && !updates.OPENAI_COMPATIBLE_BASE_URL) {
    return res.status(400).json({ error: 'A base URL is required for this provider' });
  }

  if (selectedProvider === 'anthropic' && !updates.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'ANTHROPIC_API_KEY is required when Claude is selected' });
  }

  if (selectedProvider === 'gemini' && !updates.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
    return res.status(400).json({ error: 'GEMINI_API_KEY is required when Gemini is selected' });
  }

  if (selectedProvider === 'huggingface' && !updates.HUGGINGFACE_API_KEY && !process.env.HUGGINGFACE_API_KEY) {
    return res.status(400).json({ error: 'HUGGINGFACE_API_KEY is required when Hugging Face is selected' });
  }

  writeEnvUpdates(updates);
  await reinitializeServices();

  res.json({
    success: true,
    status: getProviderStatus()
  });
}));

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

// Direct RAG query route
app.use((req, res, next) => {
  const router = createRagQueryRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createCodeRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createMathRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createMarketRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createGameDevRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createSixSigmaRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createChronoRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createPopCultureRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createHistoryRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createScienceRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createMusicProductionGeniusRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createFLStudioControlRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createStoryGeniusRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createLegalCivicGeniusRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createHealthGeniusRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createSecurityGeniusRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createBusinessGeniusRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createPhilosophyGeniusRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createLanguageGeniusRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createGeoCultureGeniusRouter(services);
  router(req, res, next);
});

app.use((req, res, next) => {
  const router = createEngineeringGeniusRouter(services);
  router(req, res, next);
});

// Admin routes
app.use('/api/admin', (req, res, next) => {
  const { createAdminRouter } = require('./routes/admin');
  const router = createAdminRouter(services);
  router(req, res, next);
});

// Export/Import routes
app.use('/api/export', (req, res, next) => {
  const { createExportRouter } = require('./routes/export');
  const router = createExportRouter(services);
  router(req, res, next);
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
  const { ConversationManager } = require('../core/conversation/ConversationManager');

  const sharingService = new ConversationSharingService();
  const conversationManager = new ConversationManager();

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
  const { ConversationManager } = require('../core/conversation/ConversationManager');
  const conversationManager = new ConversationManager();

  const userId = req.user?.userId;
  const limit = parseInt(req.query.limit as string) || 20;

  const conversations = await conversationManager.listConversations(userId, limit);
  res.json({ conversations });
}));

app.get('/api/conversations/:sessionId', requireAuth, asyncHandler(async (req, res) => {
  const { ConversationManager } = require('../core/conversation/ConversationManager');
  const conversationManager = new ConversationManager();

  const conversation = await conversationManager.getConversation(req.params.sessionId);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  res.json({ conversation });
}));

app.delete('/api/conversations/:sessionId', requireAuth, asyncHandler(async (req, res) => {
  const { ConversationManager } = require('../core/conversation/ConversationManager');
  const conversationManager = new ConversationManager();

  const deleted = await conversationManager.deleteConversation(req.params.sessionId);
  res.json({ success: deleted });
}));

// Webhook management endpoints
app.post('/api/webhooks', asyncHandler(async (req, res) => {
  const { WebhookService } = require('../core/webhooks/WebhookService');
  const webhookService = new WebhookService();

  const { url, events, secret } = req.body;
  const webhook = webhookService.register({
    url,
    events: events || ['*'],
    secret,
    active: true,
  });

  res.json({ success: true, webhook });
}));

app.get('/api/webhooks', asyncHandler(async (req, res) => {
  const { WebhookService } = require('../core/webhooks/WebhookService');
  const webhookService = new WebhookService();
  res.json({ webhooks: webhookService.list() });
}));

app.delete('/api/webhooks/:id', asyncHandler(async (req, res) => {
  const { WebhookService } = require('../core/webhooks/WebhookService');
  const webhookService = new WebhookService();
  const deleted = webhookService.unregister(req.params.id);
  res.json({ success: deleted });
}));

// Error handler (must be last)
app.use(errorHandler);

// Start server (wait for initialization)
const startServer = async () => {
  try {
    // Wait for services to initialize
    logger.info('Waiting for services to initialize...');
    while (!orchestrator) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

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
