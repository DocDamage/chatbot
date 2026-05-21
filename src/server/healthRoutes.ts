import { Express } from 'express';
import { metricsCollector } from '../core/observability/metrics';
import { asyncHandler } from '../middleware/errorHandler';

interface RegisterHealthRoutesDeps {
  getStartupState: () => 'initializing' | 'ready' | 'failed';
  getStartupError: () => string | undefined;
  getOrchestrator: () => any;
  getServices: () => any;
}

export function registerHealthRoutes(app: Express, deps: RegisterHealthRoutesDeps): void {
  app.get('/health', asyncHandler(async (_req, res) => {
    const orchestrator = deps.getOrchestrator();
    const services = deps.getServices();
    const startupState = deps.getStartupState();
    const health: any = {
      status: startupState === 'failed' ? 'failed' : orchestrator ? 'ready' : 'initializing',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      services: {
        orchestrator: !!orchestrator,
        rag: !!services?.ragService,
        tools: !!services?.toolRegistry,
        vision: !!services?.visionAdapter,
        optional: services?.initialization?.optional || {},
      },
      startup: {
        state: startupState,
        error: deps.getStartupError()
      },
      dependencies: {},
    };

    if (process.env.USE_OLLAMA !== 'false') {
      try {
        const axios = require('axios');
        const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        await axios.get(`${ollamaUrl}/api/tags`, { timeout: 2000 });
        health.dependencies.ollama = 'healthy';
      } catch {
        health.dependencies.ollama = 'unhealthy';
      }
    }

    if (process.env.ENABLE_REDIS_CACHE === 'true' && process.env.REDIS_URL) {
      try {
        const Redis = require('ioredis');
        const redis = new Redis(process.env.REDIS_URL);
        await redis.ping();
        redis.disconnect();
        health.dependencies.redis = 'healthy';
      } catch {
        health.dependencies.redis = 'unhealthy';
      }
    }

    try {
      const fs = require('fs');
      fs.statSync(process.cwd());
      health.dependencies.disk = 'healthy';
    } catch {
      health.dependencies.disk = 'unhealthy';
    }

    const allHealthy = Object.values(health.dependencies).every(status => status === 'healthy');
    if (!allHealthy && orchestrator) health.status = 'degraded';

    res.json(health);
  }));

  app.get('/health/ready', asyncHandler(async (_req, res) => {
    const services = deps.getServices();
    const startupState = deps.getStartupState();
    if (startupState !== 'ready' || !deps.getOrchestrator()) {
      return res.status(503).json({
        status: startupState === 'failed' ? 'failed' : 'not ready',
        error: deps.getStartupError()
      });
    }

    res.json({
      status: 'ready',
      services: {
        orchestrator: true,
        rag: !!services?.ragService,
        tools: !!services?.toolRegistry,
        vision: !!services?.visionAdapter,
        optional: services?.initialization?.optional || {},
      }
    });
  }));

  app.get('/health/live', (_req, res) => {
    res.json({ status: 'alive' });
  });

  app.get('/api/metrics', asyncHandler(async (_req, res) => {
    const services = deps.getServices();
    if (!deps.getOrchestrator()) {
      return res.status(503).json({ error: 'Services not initialized yet' });
    }

    res.json({
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
    });
  }));

  app.get('/metrics', asyncHandler(async (_req, res) => {
    const { PrometheusExporter } = require('../observability/prometheus');
    res.setHeader('Content-Type', 'text/plain');
    res.send(PrometheusExporter.getApplicationMetrics());
  }));
}
