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
      apiKey?: {
        id: string;
        userId?: string;
        scopes: string[];
        rateLimit?: number;
      };
    }
  }
}

const getAuthService = () => new AuthService();

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
    const authService = getAuthService();
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
    const authService = getAuthService();
    const token = authService.extractTokenFromHeader(authHeader);

    if (token) {
      const payload = authService.verifyToken(token);
      if (payload) {
        req.user = {
          userId: payload.userId,
          email: payload.email,
          roles: payload.roles,
        };
      } else {
        logger.warn('Optional auth token rejected', {
          path: req.path,
          method: req.method,
          ip: req.ip
        });
      }
    }
  } catch (error) {
    logger.warn('Optional auth failed', {
      error,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
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

/**
 * Middleware to require a CSRF token for browser-originated state changes.
 * Bearer-only API calls may omit it, but cookie/session requests must present
 * a token that matches CSRF_TOKEN.
 */
export const requireCsrfForStateChange = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const hasCookie = Boolean(req.headers.cookie);
  const expectedToken = process.env.CSRF_TOKEN;

  if (!hasCookie) {
    next();
    return;
  }

  if (!expectedToken) {
    throw new AuthenticationError('CSRF protection is not configured');
  }

  const providedToken = req.headers['x-csrf-token'];
  if (providedToken !== expectedToken) {
    throw new AuthenticationError('Invalid CSRF token');
  }

  next();
};

export const auditPrivilegedRequest = (action: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    logger.info('Privileged route access', {
      action,
      method: req.method,
      path: req.path,
      userId: req.user?.userId,
      roles: req.user?.roles || [],
    });
    next();
  };
};

