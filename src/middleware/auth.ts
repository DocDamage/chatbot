/**
 * Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../core/auth/AuthService';
import { AuthenticationError } from '../utils/errors';
import { logger } from '../core/observability/logger';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email?: string;
        roles?: string[];
      };
    }
  }
}

const authService = new AuthService();

/**
 * Middleware to require authentication
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    const payload = authService.verifyToken(token);
    if (!payload) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Attach user to request
    req.user = {
      userId: payload.userId,
      email: payload.email,
      roles: payload.roles,
    };

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    logger.error('Authentication error', { error });
    throw new AuthenticationError('Authentication failed');
  }
};

/**
 * Middleware to optionally authenticate (doesn't fail if no token)
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (token) {
      const payload = authService.verifyToken(token);
      if (payload) {
        req.user = {
          userId: payload.userId,
          email: payload.email,
          roles: payload.roles,
        };
      }
    }
  } catch (error) {
    // Silently fail for optional auth
    logger.debug('Optional auth failed', { error });
  }

  next();
};

/**
 * Middleware to require specific role
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const userRoles = req.user.roles || [];
    const hasRole = roles.some(role => userRoles.includes(role));

    if (!hasRole) {
      throw new AuthenticationError('Insufficient permissions');
    }

    next();
  };
};

