/**
 * API Key Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../core/auth/ApiKeyService';
import { AuthenticationError } from '../utils/errors';
import { logger } from '../core/observability/logger';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        userId?: string;
        scopes: string[];
        rateLimit?: number;
      };
    }
  }
}

const apiKeyService = new ApiKeyService();

/**
 * Middleware to authenticate via API key
 */
export const requireApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const apiKey = req.headers['x-api-key'] as string || 
                   req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      throw new AuthenticationError('API key required');
    }

    const validatedKey = apiKeyService.validateKey(apiKey);
    if (!validatedKey) {
      throw new AuthenticationError('Invalid or expired API key');
    }

    // Attach API key info to request
    req.apiKey = {
      id: validatedKey.id,
      userId: validatedKey.userId,
      scopes: validatedKey.scopes,
      rateLimit: validatedKey.rateLimit,
    };

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    logger.error('API key authentication error', { error });
    throw new AuthenticationError('API key authentication failed');
  }
};

/**
 * Middleware to require specific scope
 */
export const requireScope = (...scopes: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      throw new AuthenticationError('API key required');
    }

    const hasScope = scopes.some(scope => 
      apiKeyService.hasScope(
        apiKeyService.getKey(req.apiKey!.id.substring(0, 12))!,
        scope
      )
    );

    if (!hasScope) {
      throw new AuthenticationError('Insufficient API key scopes');
    }

    next();
  };
};

