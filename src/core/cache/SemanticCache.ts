/**
 * Semantic Cache - Cache by meaning, not exact match
 * Research: Latest caching papers, MIT Systems Group
 */

import { CacheManager } from '../../utils/cache';
import { logger } from '../observability/logger';
import natural from 'natural';

export interface SemanticCacheEntry<T> {
  key: string;
  value: T;
  embedding?: number[];
  timestamp: number;
  accessCount: number;
}

export class SemanticCache<T> {
  private cache: Map<string, SemanticCacheEntry<T>> = new Map();
  private cacheManager: CacheManager;
  private similarityThreshold: number;
  private tokenizer = new natural.WordTokenizer();

  constructor(
    ttlSeconds: number = 3600,
    similarityThreshold: number = 0.7
  ) {
    this.cacheManager = new CacheManager(ttlSeconds);
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * Get value by semantic similarity
   */
  get(query: string): T | undefined {
    // First try exact match
    const exactKey = this.generateKey(query);
    const exact = this.cache.get(exactKey);
    if (exact) {
      exact.accessCount++;
      return exact.value;
    }

    // Try semantic match
    const semanticMatch = this.findSemanticMatch(query);
    if (semanticMatch) {
      semanticMatch.accessCount++;
      logger.debug('Semantic cache hit', {
        query: query.substring(0, 50),
        matchedKey: semanticMatch.key.substring(0, 50),
        similarity: semanticMatch.similarity
      });
      return semanticMatch.value;
    }

    return undefined;
  }

  /**
   * Set value with semantic key
   */
  set(query: string, value: T, ttl?: number): void {
    const key = this.generateKey(query);
    const entry: SemanticCacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      accessCount: 0
    };

    this.cache.set(key, entry);
    this.cacheManager.set(key, entry, ttl);

    // Cleanup old entries periodically
    if (this.cache.size > 1000) {
      this.cleanup();
    }
  }

  /**
   * Find semantically similar entry
   */
  private findSemanticMatch(query: string): { value: T; similarity: number; key: string } | null {
    const queryTokens = new Set(
      this.tokenizer.tokenize(query.toLowerCase()) || []
    );

    let bestMatch: { value: T; similarity: number; key: string } | null = null;
    let bestSimilarity = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Extract original query from key (if stored) or use key
      const keyTokens = new Set(
        this.tokenizer.tokenize(key.toLowerCase()) || []
      );

      // Calculate Jaccard similarity
      const intersection = new Set([...queryTokens].filter(x => keyTokens.has(x)));
      const union = new Set([...queryTokens, ...keyTokens]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      // If using embeddings, could use cosine similarity here
      if (similarity > bestSimilarity && similarity >= this.similarityThreshold) {
        bestSimilarity = similarity;
        bestMatch = {
          value: entry.value,
          similarity,
          key
        };
      }
    }

    return bestMatch;
  }

  /**
   * Generate cache key from query
   */
  private generateKey(query: string): string {
    // Normalize query: lowercase, remove extra spaces, sort words
    const normalized = query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
    
    // For semantic caching, we could also include a semantic hash
    return normalized;
  }

  /**
   * Cleanup old or unused entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const entriesToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > maxAge && entry.accessCount < 2) {
        entriesToDelete.push(key);
      }
    }

    for (const key of entriesToDelete) {
      this.cache.delete(key);
      this.cacheManager.delete(key);
    }

    logger.debug('Semantic cache cleanup', {
      deleted: entriesToDelete.length,
      remaining: this.cache.size
    });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalAccess = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0);

    return {
      size: this.cache.size,
      totalAccess,
      avgAccessPerEntry: this.cache.size > 0 ? totalAccess / this.cache.size : 0
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.cacheManager.clear();
  }
}

