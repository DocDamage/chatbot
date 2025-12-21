/**
 * Predictive Cache - Pre-cache likely queries
 * Research: Latest caching papers, MIT Systems Group
 */

import { SemanticCache } from './SemanticCache';
import { logger } from '../observability/logger';

export class PredictiveCache {
  private semanticCache: SemanticCache<any>;
  private queryHistory: string[] = [];
  private maxHistory: number = 1000;

  constructor(semanticCache: SemanticCache<any>) {
    this.semanticCache = semanticCache;
  }

  /**
   * Record query for pattern learning
   */
  recordQuery(query: string): void {
    this.queryHistory.push(query);
    if (this.queryHistory.length > this.maxHistory) {
      this.queryHistory.shift();
    }
  }

  /**
   * Predict likely next queries
   */
  predictNextQueries(currentQuery: string, topK: number = 5): string[] {
    // Simple prediction based on query patterns
    const predictions: string[] = [];

    // Find similar queries from history
    const similar = this.findSimilarQueries(currentQuery, topK * 2);
    
    // Extract common patterns
    for (const similarQuery of similar) {
      // Simple: if query is a question, predict follow-up questions
      if (currentQuery.includes('what is')) {
        predictions.push(similarQuery.replace('what is', 'how does'));
        predictions.push(similarQuery.replace('what is', 'why is'));
      }
      if (currentQuery.includes('how')) {
        predictions.push(similarQuery.replace('how', 'what'));
      }
    }

    return predictions.slice(0, topK);
  }

  /**
   * Pre-cache predicted queries
   */
  async preCache(
    currentQuery: string,
    generateResponse: (query: string) => Promise<any>
  ): Promise<void> {
    const predictions = this.predictNextQueries(currentQuery, 3);

    logger.debug('Pre-caching predicted queries', { count: predictions.length });

    // Pre-cache in background (don't await)
    Promise.all(
      predictions.map(async (prediction) => {
        try {
          const response = await generateResponse(prediction);
          this.semanticCache.set(prediction, response);
        } catch (error: any) {
          logger.warn('Pre-cache failed', { query: prediction, error: error.message });
        }
      })
    ).catch(() => {
      // Ignore errors in pre-caching
    });
  }

  /**
   * Find similar queries from history
   */
  private findSimilarQueries(query: string, topK: number): string[] {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));

    const similarities = this.queryHistory.map(historyQuery => {
      const historyWords = new Set(historyQuery.toLowerCase().split(/\s+/));
      const intersection = new Set([...queryWords].filter(x => historyWords.has(x)));
      const union = new Set([...queryWords, ...historyWords]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      return { query: historyQuery, similarity };
    });

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(item => item.query);
  }
}

