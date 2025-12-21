/**
 * API v2 Chat Routes (Enhanced)
 */

import { Router } from 'express';
import { rateLimiter } from '../../../middleware/rateLimiter';
import { validateChatRequest, sanitizeInput } from '../../../middleware/validator';
import { asyncHandler } from '../../../middleware/errorHandler';
import { ChatRequest } from '../../../core/orchestrator/Orchestrator';
import { streamChat } from '../chat-stream';

export function createChatRouterV2(orchestrator: any) {
  const router = Router();

  // Standard chat endpoint
  router.post(
    '/chat',
    rateLimiter.middleware(),
    validateChatRequest,
    asyncHandler(async (req, res) => {
      const { message, sessionId, userId } = req.body;
      const sanitizedMessage = sanitizeInput(message);

      const request: ChatRequest = {
        message: sanitizedMessage,
        sessionId,
        userId,
      };

      const response = await orchestrator.processRequest(request);
      res.json(response);
    })
  );

  // Streaming chat endpoint
  router.post(
    '/chat/stream',
    rateLimiter.middleware(),
    validateChatRequest,
    asyncHandler(async (req, res) => {
      await streamChat(req, res, orchestrator);
    })
  );

  return router;
}

