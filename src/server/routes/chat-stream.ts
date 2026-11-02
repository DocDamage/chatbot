/**
 * Streaming Chat Endpoint - SSE streaming for LLM responses
 */

import { Request, Response } from 'express';
import { EnhancedOrchestrator } from '../../core/orchestrator/EnhancedOrchestrator';
import { logger } from '../../core/observability/logger';

/**
 * Stream chat response using Server-Sent Events
 */
export async function streamChat(
  req: Request,
  res: Response,
  orchestrator: { processRequest: EnhancedOrchestrator['processRequest'] }
): Promise<void> {
  const { message, sessionId, userId } = req.body;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write('data: {"type":"connected"}\n\n');

  try {
    // For now, we'll simulate streaming by chunking the response
    // In a real implementation, the orchestrator would support streaming
    const response = await orchestrator.processRequest({
      ...req.body,
      message,
      sessionId,
      userId: req.user?.userId || userId,
    });

    // Split response into chunks and stream
    const chunks = response.response.split(' ');
    let accumulated = '';

    for (let i = 0; i < chunks.length; i++) {
      accumulated += (i > 0 ? ' ' : '') + chunks[i];
      
      // Send chunk
      res.write(`data: ${JSON.stringify({
        type: 'chunk',
        content: chunks[i] + (i < chunks.length - 1 ? ' ' : ''),
        accumulated,
      })}\n\n`);

      if (res.destroyed) return;
    }

    // Send completion message
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      response: response.response,
      sessionId,
      model: response.model,
      sources: (response as any).sources,
      citations: (response as any).citations,
    })}\n\n`);

    res.end();
  } catch (error: any) {
    logger.error('Streaming error', { error: error.message });
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message,
    })}\n\n`);
    res.end();
  }
}

