/**
 * Request Validation Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';
import { z } from 'zod';

const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000).trim(),
  sessionId: z.string().min(1).max(100),
  userId: z.string().max(100).optional(),
  contract: z.any().optional()
});

export const validateChatRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    chatRequestSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid request', {
        errors: error.errors
      });
    }
    throw error;
  }
};

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

