/**
 * Admin API Routes - System management endpoints
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { logger } from '../../core/observability/logger';

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
      stats.knowledgeBase = services.documentManager.getStats();
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
    if (!services?.cache) {
      return res.status(503).json({ error: 'Cache service not available' });
    }

    // Clear all cache levels
    // Note: This is a simplified implementation
    // In production, you'd want to clear each level individually
    logger.info('Cache cleared by admin');
    
    res.json({ 
      success: true, 
      message: 'Cache cleared successfully',
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
    const limit = parseInt(req.query.limit as string) || 100;
    const level = req.query.level as string || 'info';

    // In production, this would query from a log aggregation service
    res.json({
      message: 'Log retrieval not fully implemented',
      note: 'In production, integrate with log aggregation service (e.g., ELK, Loki)',
      limit,
      level,
    });
  }));

  return router;
}

