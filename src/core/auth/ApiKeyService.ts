/**
 * API Key Service - API key generation and validation
 */

import crypto from 'crypto';
import { logger } from '../observability/logger';

export interface ApiKey {
  id: string;
  key: string; // Hashed key
  keyPrefix: string; // First 8 chars for identification
  userId?: string;
  name: string;
  scopes: string[];
  rateLimit?: number; // Requests per minute
  createdAt: Date;
  expiresAt?: Date;
  lastUsed?: Date;
  isActive: boolean;
}

export interface ApiKeyCreateOptions {
  userId?: string;
  name: string;
  scopes: string[];
  rateLimit?: number;
  expiresInDays?: number;
}

export class ApiKeyService {
  private keys: Map<string, ApiKey> = new Map(); // keyPrefix -> ApiKey
  private keyToPrefix: Map<string, string> = new Map(); // fullKey -> keyPrefix

  /**
   * Generate a new API key
   */
  generateKey(options: ApiKeyCreateOptions): { key: string; apiKey: ApiKey } {
    // Generate random key
    const rawKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12);

    const expiresAt = options.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const apiKey: ApiKey = {
      id: `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      key: keyHash,
      keyPrefix,
      userId: options.userId,
      name: options.name,
      scopes: options.scopes,
      rateLimit: options.rateLimit,
      createdAt: new Date(),
      expiresAt,
      isActive: true,
    };

    this.keys.set(keyPrefix, apiKey);
    this.keyToPrefix.set(keyHash, keyPrefix);

    logger.info('API key generated', { keyPrefix, scopes: options.scopes });

    return {
      key: rawKey, // Return raw key only once
      apiKey,
    };
  }

  /**
   * Validate API key
   */
  validateKey(key: string): ApiKey | null {
    const keyHash = this.hashKey(key);
    const keyPrefix = this.keyToPrefix.get(keyHash);

    if (!keyPrefix) {
      return null;
    }

    const apiKey = this.keys.get(keyPrefix);
    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      logger.warn('API key expired', { keyPrefix });
      return null;
    }

    // Update last used
    apiKey.lastUsed = new Date();

    return apiKey;
  }

  /**
   * Revoke API key
   */
  revokeKey(keyPrefix: string): boolean {
    const apiKey = this.keys.get(keyPrefix);
    if (!apiKey) {
      return false;
    }

    apiKey.isActive = false;
    logger.info('API key revoked', { keyPrefix });
    return true;
  }

  /**
   * List API keys for a user
   */
  listKeys(userId?: string): ApiKey[] {
    const allKeys = Array.from(this.keys.values());
    
    if (userId) {
      return allKeys.filter(key => key.userId === userId);
    }

    return allKeys;
  }

  /**
   * Get API key by prefix
   */
  getKey(keyPrefix: string): ApiKey | undefined {
    return this.keys.get(keyPrefix);
  }

  /**
   * Check if key has required scope
   */
  hasScope(apiKey: ApiKey, requiredScope: string): boolean {
    return apiKey.scopes.includes(requiredScope) || apiKey.scopes.includes('*');
  }

  /**
   * Hash API key for storage
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }
}

