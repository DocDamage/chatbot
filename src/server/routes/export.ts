/**
 * Export/Import Routes - Data export and import functionality
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';
import { logger } from '../../core/observability/logger';

export function createExportRouter(services: any) {
  const router = Router();

  // All export routes require authentication
  router.use(requireAuth);

  /**
   * GET /api/export/knowledge-base
   * Export knowledge base documents
   */
  router.get('/knowledge-base', asyncHandler(async (req, res) => {
    if (!services?.documentManager) {
      return res.status(503).json({ error: 'Document manager not available' });
    }

    const stats = await services.documentManager.getStats();
    
    // In a full implementation, this would export actual document data
    // For now, return metadata
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      metadata: {
        totalDocuments: stats.persistence?.sources || 0,
        totalChunks: stats.persistence?.chunks || 0,
      },
      documents: [], // Would contain actual document data
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="knowledge-base-${Date.now()}.json"`);
    res.json(exportData);
  }));

  /**
   * GET /api/export/conversations
   * Export conversation history
   */
  router.get('/conversations', asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    const sessionId = req.query.sessionId as string;

    if (!userId && !sessionId) {
      return res.status(400).json({ error: 'userId or sessionId required' });
    }

    // In a full implementation, this would query the database
    // For now, return structure
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      userId: userId || undefined,
      sessionId: sessionId || undefined,
      conversations: [], // Would contain actual conversation data
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="conversations-${Date.now()}.json"`);
    res.json(exportData);
  }));

  /**
   * POST /api/import/knowledge-base
   * Import knowledge base documents
   */
  router.post('/import/knowledge-base', asyncHandler(async (req, res) => {
    if (!services?.documentManager) {
      return res.status(503).json({ error: 'Document manager not available' });
    }

    const { documents } = req.body;

    if (!Array.isArray(documents)) {
      return res.status(400).json({ error: 'documents must be an array' });
    }

    let imported = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        if (doc.text) {
          await services.documentManager.addText(doc.text, doc.metadata || {});
          imported++;
        } else if (doc.filePath) {
          await services.documentManager.addFile(doc.filePath);
          imported++;
        }
      } catch (error: any) {
        errors.push(`Failed to import document: ${error.message}`);
      }
    }

    res.json({
      success: true,
      imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  }));

  /**
   * POST /api/import/conversations
   * Import conversation history
   */
  router.post('/import/conversations', asyncHandler(async (req, res) => {
    const { conversations } = req.body;

    if (!Array.isArray(conversations)) {
      return res.status(400).json({ error: 'conversations must be an array' });
    }

    // In a full implementation, this would restore conversations to database
    logger.info('Conversation import requested', { count: conversations.length });

    res.json({
      success: true,
      message: 'Import functionality requires database integration',
      count: conversations.length,
    });
  }));

  return router;
}

