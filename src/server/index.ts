/**
 * API Gateway - Entry point for all requests
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Orchestrator } from '../core/orchestrator/Orchestrator';
import { OpenAIAdapter, TemplateAdapter } from '../core/providers/LLMAdapter';
import { OllamaAdapter } from '../core/providers/OllamaAdapter';
import { HuggingFaceAdapter } from '../core/providers/HuggingFaceAdapter';
import { StableDiffusionAdapter } from '../core/providers/StableDiffusionAdapter';
import { logger } from '../core/observability/logger';
import { metricsCollector } from '../core/observability/metrics';
import { ChatRequest } from '../core/orchestrator/Orchestrator';
import { rateLimiter } from '../middleware/rateLimiter';
import { validateChatRequest, sanitizeInput } from '../middleware/validator';
import { errorHandler, asyncHandler } from '../middleware/errorHandler';
import { securityHeaders, corsOptions } from '../middleware/security';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize services
// Try Ollama first (free, local), fallback to OpenAI or template
const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
const ollamaModel = process.env.OLLAMA_MODEL || 'llama2';

let llmAdapter;
const useOllama = process.env.USE_OLLAMA !== 'false'; // Default to true
const useHuggingFace = process.env.USE_HUGGINGFACE === 'true';
const hfModel = process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';
const hfApiKey = process.env.HUGGINGFACE_API_KEY;

if (useOllama) {
  logger.info('Using Ollama for LLM (free, local)', { url: ollamaUrl, model: ollamaModel });
  llmAdapter = new OllamaAdapter(ollamaUrl, ollamaModel);
  
  // Check if Ollama is available
  (llmAdapter as OllamaAdapter).checkAvailability().then(({ available, models }) => {
    if (available) {
      logger.info('Ollama is available', { models });
    } else {
      logger.warn('Ollama is not available, responses may fail. Install from https://ollama.ai');
    }
  });
} else if (useHuggingFace) {
  logger.info('Using Hugging Face for LLM (free, API)', { model: hfModel });
  llmAdapter = new HuggingFaceAdapter(hfApiKey, hfModel);
} else {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (apiKey) {
    logger.info('Using OpenAI for LLM');
    llmAdapter = new OpenAIAdapter(apiKey, 'gpt-3.5-turbo');
  } else {
    logger.warn('No LLM configured, using template fallback');
    llmAdapter = new TemplateAdapter();
  }
}

// Initialize Stable Diffusion adapter (optional)
const sdUrl = process.env.STABLE_DIFFUSION_URL || 'http://localhost:7860';
let imageAdapter;
const useStableDiffusion = process.env.USE_STABLE_DIFFUSION !== 'false'; // Default to true

if (useStableDiffusion) {
  logger.info('Using Stable Diffusion for image generation', { url: sdUrl });
  imageAdapter = new StableDiffusionAdapter(sdUrl);
  
  // Check if Stable Diffusion is available
  imageAdapter.checkAvailability().then((available) => {
    if (available) {
      logger.info('Stable Diffusion is available');
    } else {
      logger.warn('Stable Diffusion is not available. Install Automatic1111 WebUI or similar.');
    }
  });
}

const orchestrator = new Orchestrator(llmAdapter, imageAdapter);

// Health check with detailed status
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  };
  res.json(health);
});

// Metrics endpoint
app.get('/api/metrics', asyncHandler(async (req, res) => {
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
    cache: orchestrator.getCacheStats()
  };
  res.json(metrics);
}));

// Chat endpoint with rate limiting and validation
app.post('/api/chat', 
  rateLimiter.middleware(),
  validateChatRequest,
  asyncHandler(async (req, res) => {
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

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

