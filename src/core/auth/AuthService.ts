/**
 * Authentication Service - JWT token generation and validation
 */

import * as jwt from 'jsonwebtoken';
import { logger } from '../observability/logger';

export interface User {
  id: string;
  email?: string;
  name?: string;
  roles?: string[];
}

export interface TokenPayload {
  userId: string;
  email?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

export class AuthService {
  private secretKey: string;
  private tokenExpiry: string;

  constructor(secretKey?: string, tokenExpiry: string = '24h') {
    this.secretKey = secretKey || process.env.JWT_SECRET || 'change-me-in-production';
    this.tokenExpiry = tokenExpiry;

    if (!secretKey && !process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET not set, using default (INSECURE FOR PRODUCTION)');
    }
  }

  /**
   * Generate JWT token for user
   */
  generateToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles || [],
    };

    return jwt.sign(payload, this.secretKey, {
      expiresIn: this.tokenExpiry,
    });
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.secretKey) as TokenPayload;
      return decoded;
    } catch (error: any) {
      logger.warn('Token verification failed', { error: error.message });
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Refresh token (generate new token with same payload)
   */
  refreshToken(token: string): string | null {
    const payload = this.verifyToken(token);
    if (!payload) return null;

    return this.generateToken({
      id: payload.userId,
      email: payload.email,
      roles: payload.roles,
    });
  }
}

