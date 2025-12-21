/**
 * API Gateway - Entry point for all requests
 * Auto-loads all services on startup
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

dotenv.config();

// Validate configuration on startup
try {
  ConfigValidator.getValidatedConfig();
  logger.info('Configuration validated successfully');
} catch (error: any) {
  logger.error('Configuration validation failed', { error: error.message });
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize all services automatically
let services: any;
let orchestrator: any;

// Start initialization immediately
(async () => {
  try {
    logger.info('🚀 Initializing all services...');
    services = await ServiceInitializer.initialize();
    orchestrator = services.orchestrator;
    
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
}));

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
}));

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

    const { message, sessionId, userId } = req.body;

    // Sanitize input
    const sanitizedMessage = sanitizeInput(message);

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

app.get('/api/knowledge-base/stats', asyncHandler(async (req, res) => {
  if (!services?.ragService) {
    return res.status(503).json({ error: 'RAG service not initialized' });
  }

  const stats = services.documentManager?.getStats() || {};
  res.json(stats);
}));

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

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📚 Knowledge base: ${process.env.KNOWLEDGE_BASE_DIR || './knowledge-base'}`);
      logger.info(`🔧 Features enabled:`);
      logger.info(`   - RAG: ${process.env.ENABLE_RAG !== 'false' ? '✅' : '❌'}`);
      logger.info(`   - Model Routing: ${process.env.ENABLE_MODEL_ROUTING !== 'false' ? '✅' : '❌'}`);
      logger.info(`   - Safety Pipeline: ${process.env.ENABLE_SAFETY_PIPELINE !== 'false' ? '✅' : '❌'}`);
      logger.info(`   - Semantic Cache: ${process.env.ENABLE_SEMANTIC_CACHE !== 'false' ? '✅' : '❌'}`);
    });
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();
