/**
 * Result Ranker - Intelligent result ranking and scoring
 */

import { KnowledgeResult } from './KnowledgeSource';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { logger } from '../observability/logger';

export interface RankingFactors {
  semanticSimilarity?: number;
  recency?: number;
  authority?: number;
  completeness?: number;
  userRelevance?: number;
}

export class ResultRanker {
  private embeddingService?: EmbeddingService;

  constructor(embeddingService?: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * Rank results using multiple factors
   */
  async rank(
    query: string,
    results: KnowledgeResult[],
    factors: Partial<RankingFactors> = {}
  ): Promise<KnowledgeResult[]> {
    if (results.length === 0) {
      return results;
    }

    try {
      // Calculate scores for each result
      const scoredResults = await Promise.all(
        results.map(async (result) => {
          const scores: RankingFactors = {
            semanticSimilarity: await this.calculateSemanticSimilarity(query, result),
            recency: this.calculateRecency(result),
            authority: this.calculateAuthority(result),
            completeness: this.calculateCompleteness(result),
            userRelevance: result.confidence || 0.5,
          };

          // Combine scores with weights
          const finalScore = this.combineScores(scores, factors);

          return {
            ...result,
            confidence: Math.min(finalScore, 1.0),
            rankingFactors: scores,
          };
        })
      );

      // Sort by final score
      return scoredResults.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    } catch (error: any) {
      logger.warn('Result ranking failed', { error: error.message });
      return results;
    }
  }

  /**
   * Calculate semantic similarity
   */
  private async calculateSemanticSimilarity(
    query: string,
    result: KnowledgeResult
  ): Promise<number> {
    if (!this.embeddingService) {
      return 0.5; // Default if no embedding service
    }

    try {
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      const resultText = `${result.title} ${result.content}`.substring(0, 500);
      const resultEmbedding = await this.embeddingService.generateEmbedding(resultText);

      return this.cosineSimilarity(queryEmbedding, resultEmbedding);
    } catch (error: any) {
      logger.warn('Semantic similarity calculation failed', { error: error.message });
      return 0.5;
    }
  }

  /**
   * Calculate recency score
   */
  private calculateRecency(result: KnowledgeResult): number {
    if (!result.metadata?.publishedAt && !result.metadata?.created) {
      return 0.5; // Unknown recency
    }

    const dateStr = result.metadata.publishedAt || result.metadata.created;
    if (!dateStr) return 0.5;

    try {
      const date = new Date(dateStr);
      const now = new Date();
      const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

      // Score: 1.0 for today, 0.5 for 1 year ago, 0.0 for 5+ years ago
      if (daysDiff < 1) return 1.0;
      if (daysDiff < 30) return 0.9;
      if (daysDiff < 90) return 0.8;
      if (daysDiff < 365) return 0.6;
      if (daysDiff < 1825) return 0.4;
      return 0.2;
    } catch {
      return 0.5;
    }
  }

  /**
   * Calculate authority score
   */
  private calculateAuthority(result: KnowledgeResult): number {
    // Check source authority
    const authoritativeSources = [
      'wikipedia',
      'library_of_congress',
      'mdn',
      'nasa',
      'nih',
      'cdc',
      'sec',
      'finra',
    ];

    if (authoritativeSources.includes(result.source)) {
      return 0.95;
    }

    // Check if URL is from authoritative domain
    if (result.url) {
      const domain = new URL(result.url).hostname.toLowerCase();
      if (
        domain.includes('.edu') ||
        domain.includes('.gov') ||
        domain.includes('.org') ||
        domain.includes('wikipedia.org')
      ) {
        return 0.85;
      }
    }

    // Check metadata for authority indicators
    if (result.metadata?.authority || result.metadata?.verified) {
      return 0.8;
    }

    return 0.5; // Default
  }

  /**
   * Calculate completeness score
   */
  private calculateCompleteness(result: KnowledgeResult): number {
    const contentLength = (result.content || '').length;
    const titleLength = (result.title || '').length;

    // Score based on content length and quality
    if (contentLength > 2000 && titleLength > 10) return 1.0;
    if (contentLength > 1000 && titleLength > 5) return 0.8;
    if (contentLength > 500) return 0.6;
    if (contentLength > 100) return 0.4;
    return 0.2;
  }

  /**
   * Combine scores with weights
   */
  private combineScores(scores: RankingFactors, weights: Partial<RankingFactors>): number {
    const defaultWeights: RankingFactors = {
      semanticSimilarity: 0.4,
      recency: 0.15,
      authority: 0.2,
      completeness: 0.15,
      userRelevance: 0.1,
    };

    const finalWeights = { ...defaultWeights, ...weights };
    const totalWeight = Object.values(finalWeights).reduce((a, b) => a + (b || 0), 0);

    let weightedSum = 0;
    for (const [key, weight] of Object.entries(finalWeights)) {
      const score = scores[key as keyof RankingFactors] || 0;
      weightedSum += score * (weight || 0);
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

