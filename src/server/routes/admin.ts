/**
 * Admin API Routes - System management endpoints
 */

import { Router } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { logger } from '../../core/observability/logger';
import { AppError } from '../../utils/errors';

const DEFAULT_LOG_FILE = 'combined.log';
const MAX_LOG_LINES = 1000;
const MAX_LOG_READ_BYTES = 1024 * 1024;
const LOG_LEVELS = new Set(['error', 'warn', 'info', 'http', 'debug']);
const LOG_FILE_PATTERN = /^(combined|error)\.log$|^app-\d{4}-\d{2}-\d{2}\.log$/;

interface CacheClearResult {
  name: string;
  cleared: boolean;
  method?: string;
  error?: string;
}

interface LogEntry {
  timestamp?: string;
  level?: string;
  message: string;
  raw: string;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function resolveLogsDir(services: any): string {
  return path.resolve(services?.logsDir || services?.logDirectory || process.env.LOGS_DIR || 'logs');
}

function sanitizeLogFile(value: unknown): string {
  const file = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_LOG_FILE;
  if (!LOG_FILE_PATTERN.test(file)) {
    throw new AppError('Invalid log file requested', 400, 'INVALID_LOG_FILE');
  }
  return file;
}

function redactLogText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/("?(?:api[_-]?key|token|authorization|password|secret)"?\s*[:=]\s*)("[^"]+"|[^\s,}]+)/gi, '$1[REDACTED]');
}

async function readLogTail(filePath: string): Promise<{ text: string; truncated: boolean }> {
  const stat = await fs.stat(filePath);
  const start = Math.max(0, stat.size - MAX_LOG_READ_BYTES);
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(stat.size - start);
    await handle.read(buffer, 0, buffer.length, start);
    return {
      text: buffer.toString('utf8'),
      truncated: start > 0,
    };
  } finally {
    await handle.close();
  }
}

function parseLogLine(line: string): LogEntry {
  const redacted = redactLogText(line);
  try {
    const parsed = JSON.parse(line);
    const timestamp = typeof parsed.timestamp === 'string' ? parsed.timestamp : undefined;
    const level = typeof parsed.level === 'string' ? parsed.level : undefined;
    const message = typeof parsed.message === 'string' ? redactLogText(parsed.message) : redacted;
    return { timestamp, level, message, raw: redacted };
  } catch {
    const match = redacted.match(/^(\S+\s+\S+)\s+\[([^\]]+)\]\s+(.*)$/);
    if (match) {
      return {
        timestamp: match[1],
        level: match[2].toLowerCase(),
        message: match[3],
        raw: redacted,
      };
    }
    return { message: redacted, raw: redacted };
  }
}

async function clearCache(name: string, cache: any): Promise<CacheClearResult> {
  if (!cache) {
    return { name, cleared: false, error: 'Cache not available' };
  }

  const methods = ['clear', 'flushAll', 'flush', 'reset'];
  const method = methods.find(candidate => typeof cache[candidate] === 'function');
  if (!method) {
    return { name, cleared: false, error: 'Cache does not expose a clear method' };
  }

  try {
    await cache[method]();
    return { name, cleared: true, method };
  } catch (error: any) {
    return { name, cleared: false, method, error: error?.message || 'Cache clear failed' };
  }
}

export function createAdminRouter(services: any) {
  const router = Router();

  // All admin routes require authentication and admin role
  router.use(requireAuth);
  router.use(requireRole('admin'));

  /**
   * GET /api/admin/stats
   * Get comprehensive system statistics
   */
  router.get('/stats', asyncHandler(async (req, res) => {
    const stats: any = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
        cpu: process.cpuUsage(),
      },
      services: {
        orchestrator: !!services?.orchestrator,
        rag: !!services?.ragService,
        tools: !!services?.toolRegistry,
        vision: !!services?.visionAdapter,
        cache: !!services?.cache,
      },
    };

    // Add application metrics
    if (services?.orchestrator) {
      const { metricsCollector } = require('../../core/observability/metrics');
      stats.application = metricsCollector.getMetrics();
    }

    // Add cache stats
    if (services?.cache) {
      stats.cache = services.cache.getStats();
    }

    // Add RAG stats
    if (services?.documentManager) {
      stats.knowledgeBase = await services.documentManager.getStats();
    }

    // Add analytics
    if (services?.analytics) {
      stats.analytics = services.analytics.getUsageStats();
    }

    res.json(stats);
  }));

  /**
   * POST /api/admin/cache/clear
   * Clear all caches
   */
  router.post('/cache/clear', asyncHandler(async (req, res) => {
    const cacheTargets = [
      ['cache', services?.cache],
      ['semanticCache', services?.semanticCache],
      ['responseCache', services?.responseCache],
    ] as const;

    const availableTargets = cacheTargets.filter(([, cache]) => Boolean(cache));
    if (availableTargets.length === 0) {
      return res.status(503).json({ error: 'Cache service not available' });
    }

    const results = await Promise.all(
      availableTargets.map(([name, cache]) => clearCache(name, cache))
    );
    const cleared = results.filter(result => result.cleared).length;
    const failed = results.filter(result => !result.cleared);

    if (cleared === 0) {
      logger.warn('Admin cache clear failed', { results });
      return res.status(500).json({
        success: false,
        message: 'No caches were cleared',
        results,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Cache cleared by admin', {
      userId: req.user?.userId,
      cleared,
      failed: failed.length,
    });
    
    res.json({ 
      success: true, 
      message: failed.length > 0 ? 'Some caches were cleared' : 'Cache cleared successfully',
      results,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * GET /api/admin/users
   * List all users (paginated)
   */
  router.get('/users', asyncHandler(async (req, res) => {
    const { UserService } = require('../../core/auth/UserService');
    const userService = new UserService();
    
    const users = userService.listUsers();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const start = (page - 1) * limit;
    const end = start + limit;

    res.json({
      users: users.slice(start, end),
      pagination: {
        page,
        limit,
        total: users.length,
        pages: Math.ceil(users.length / limit),
      },
    });
  }));

  /**
   * GET /api/admin/analytics
   * Get analytics insights
   */
  router.get('/analytics', asyncHandler(async (req, res) => {
    if (!services?.analytics) {
      return res.status(503).json({ error: 'Analytics service not available' });
    }

    const analytics = services.analytics;
    const stats = analytics.getUsageStats();
    const patterns = analytics.getQueryPatterns();

    res.json({
      usage: stats,
      patterns,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * GET /api/admin/logs
   * Get recent system logs (simplified)
   */
  router.get('/logs', asyncHandler(async (req, res) => {
    const limit = clampInteger(req.query.limit, 100, 1, MAX_LOG_LINES);
    const level = typeof req.query.level === 'string' ? req.query.level.toLowerCase() : undefined;
    if (level && !LOG_LEVELS.has(level)) {
      return res.status(400).json({ error: 'Invalid log level requested' });
    }

    const file = sanitizeLogFile(req.query.file);
    const logsDir = resolveLogsDir(services);
    const filePath = path.resolve(logsDir, file);
    if (path.dirname(filePath) !== logsDir) {
      return res.status(400).json({ error: 'Invalid log file requested' });
    }

    let tail: { text: string; truncated: boolean };
    try {
      tail = await readLogTail(filePath);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return res.json({
          logs: [],
          file,
          limit,
          level: level || null,
          truncated: false,
          notice: 'No log file available',
        });
      }
      throw error;
    }

    const logs = tail.text
      .split(/\r?\n/)
      .filter(Boolean)
      .map(parseLogLine)
      .filter(entry => !level || entry.level === level)
      .slice(-limit);

    res.json({
      logs,
      file,
      limit,
      level: level || null,
      truncated: tail.truncated,
    });
  }));

  return router;
}

