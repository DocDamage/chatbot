/**
 * Re-Ranker - Cross-encoder re-ranking for top-k results
 * Research: Latest RAG papers on re-ranking
 */

import { RetrievalResult, DocumentChunk } from '../../types/rag';
import { logger } from '../observability/logger';
import natural from 'natural';

export class ReRanker {
  private tokenizer = new natural.WordTokenizer();

  /**
   * Re-rank retrieval results using cross-encoder approach
   */
  async rerank(
    query: string,
    results: RetrievalResult[],
    topK: number = 5
  ): Promise<RetrievalResult[]> {
    if (results.length === 0) return [];

    // Calculate cross-encoder scores
    const reranked = results.map(result => ({
      ...result,
      score: this.calculateCrossEncoderScore(query, result.chunk)
    }));

    // Sort by new score
    reranked.sort((a, b) => b.score - a.score);

    logger.debug('Re-ranking completed', {
      query,
      originalCount: results.length,
      topK,
      topScore: reranked[0]?.score
    });

    return reranked.slice(0, topK);
  }

  /**
   * Calculate cross-encoder score (query-document interaction)
   */
  private calculateCrossEncoderScore(query: string, chunk: DocumentChunk): number {
    const queryTokens = new Set(
      this.tokenizer.tokenize(query.toLowerCase()) || []
    );
    const docTokens = new Set(
      this.tokenizer.tokenize(chunk.content.toLowerCase()) || []
    );

    // Term overlap
    const intersection = new Set([...queryTokens].filter(x => docTokens.has(x)));
    const termOverlap = queryTokens.size > 0 ? intersection.size / queryTokens.size : 0;

    // Document length normalization (prefer medium-length documents)
    const docLength = chunk.content.length;
    const lengthScore = this.lengthScore(docLength);

    // Position bonus (if query terms appear early in document)
    const positionScore = this.positionScore(query, chunk.content);

    // Metadata bonus
    const metadataScore = this.metadataScore(query, chunk);

    // Combined score
    const score = (
      termOverlap * 0.4 +
      lengthScore * 0.2 +
      positionScore * 0.2 +
      metadataScore * 0.2
    );

    return score;
  }

  /**
   * Length score (prefer documents of medium length)
   */
  private lengthScore(length: number): number {
    // Optimal length around 200-500 words
    if (length < 50) return 0.3; // Too short
    if (length > 2000) return 0.5; // Too long
    if (length >= 200 && length <= 500) return 1.0; // Optimal
    return 0.7; // Acceptable
  }

  /**
   * Position score (bonus for early appearance of query terms)
   */
  private positionScore(query: string, content: string): number {
    const queryTerms = this.tokenizer.tokenize(query.toLowerCase()) || [];
    const contentLower = content.toLowerCase();
    let earliestPosition = content.length;

    for (const term of queryTerms) {
      const position = contentLower.indexOf(term);
      if (position >= 0 && position < earliestPosition) {
        earliestPosition = position;
      }
    }

    if (earliestPosition === content.length) return 0;

    // Normalize: earlier = higher score
    return Math.max(0, 1 - earliestPosition / content.length);
  }

  /**
   * Metadata score (bonus for relevant metadata)
   */
  private metadataScore(query: string, chunk: DocumentChunk): number {
    let score = 0.5; // Base score

    // Check if query terms appear in title
    if (chunk.metadata.title) {
      const titleLower = chunk.metadata.title.toLowerCase();
      const queryLower = query.toLowerCase();
      if (titleLower.includes(queryLower) || queryLower.includes(titleLower)) {
        score += 0.3;
      }
    }

    // Check if query terms appear in section
    if (chunk.metadata.section) {
      const sectionLower = chunk.metadata.section.toLowerCase();
      const queryLower = query.toLowerCase();
      if (sectionLower.includes(queryLower)) {
        score += 0.2;
      }
    }

    return Math.min(1.0, score);
  }
}

