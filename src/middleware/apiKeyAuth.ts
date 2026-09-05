/**
 * API Key Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../core/auth/ApiKeyService';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { logger } from '../core/observability/logger';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        keyPrefix?: string;
        userId?: string;
        scopes: string[];
        rateLimit?: number;
      };
    }
  }
}

export const apiKeyService = new ApiKeyService();

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
      keyPrefix: validatedKey.keyPrefix,
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

    const keyScopes = req.apiKey.scopes || [];
    const hasScope = scopes.some(scope => keyScopes.includes(scope) || keyScopes.includes('*'));

    if (!hasScope) {
      throw new AuthorizationError('Insufficient permissions');
    }

    next();
  };
};

