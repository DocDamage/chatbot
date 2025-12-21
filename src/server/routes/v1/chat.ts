/**
 * API v1 Chat Routes
 */

import { Router } from 'express';
import { rateLimiter } from '../../../middleware/rateLimiter';
import { validateChatRequest, sanitizeInput } from '../../../middleware/validator';
import { asyncHandler } from '../../../middleware/errorHandler';
import { ChatRequest } from '../../../core/orchestrator/Orchestrator';

export function createChatRouter(orchestrator: any) {
  const router = Router();

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

  return router;
}

