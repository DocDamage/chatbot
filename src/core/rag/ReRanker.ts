/**
 * Re-Ranker - Cross-encoder re-ranking for top-k results
 * Research: Latest RAG papers on re-ranking
 */

import { RetrievalResult, DocumentChunk } from '../../types/rag';
import { logger } from '../observability/logger';
import { LLMAdapter } from '../providers/LLMAdapter';
import natural from 'natural';

export type ReRankerMode = 'heuristic' | 'llm' | 'embedding' | 'cross_encoder';

export interface ReRankerOptions {
  mode?: ReRankerMode;
  llmAdapter?: LLMAdapter;
}

export class ReRanker {
  private tokenizer = new natural.WordTokenizer();
  private mode: ReRankerMode;
  private llmAdapter?: LLMAdapter;

  constructor(options: ReRankerOptions = {}) {
    this.mode = options.mode || (process.env.RERANKER_MODE as ReRankerMode) || 'heuristic';
    this.llmAdapter = options.llmAdapter;
  }

  /**
   * Re-rank retrieval results using cross-encoder approach
   */
  async rerank(
    query: string,
    results: RetrievalResult[],
    topK: number = 5
  ): Promise<RetrievalResult[]> {
    if (results.length === 0) return [];

    if (this.mode === 'llm' && this.llmAdapter) {
      return this.llmRerank(query, results, topK);
    }

    // Calculate cross-encoder scores
    const reranked = results.map(result => ({
      ...result,
      score: this.mode === 'embedding'
        ? this.calculateEmbeddingScore(query, result.chunk)
        : this.calculateCrossEncoderScore(query, result.chunk)
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

  private async llmRerank(
    query: string,
    results: RetrievalResult[],
    topK: number
  ): Promise<RetrievalResult[]> {
    const prompt = `Rank these chunks for the query. Return strict JSON with a scores array.

Query: ${query}

Chunks:
${results.map(result => `- ${result.chunk.id}: ${result.chunk.content.substring(0, 500)}`).join('\n')}

JSON format:
{"scores":[{"chunkId":"abc","score":0.91,"reason":"why"}]}`;

    try {
      const response = await this.llmAdapter!.generate({
        prompt,
        systemPrompt: 'You are a relevance reranker. Return only JSON.',
        temperature: 0,
        maxTokens: 700
      });
      const parsed = JSON.parse(response.content);
      const scores = new Map<string, { score: number; reason?: string }>();
      for (const item of parsed.scores || []) {
        scores.set(item.chunkId, {
          score: Number(item.score) || 0,
          reason: item.reason
        });
      }

      return results
        .map(result => {
          const scored = scores.get(result.chunk.id);
          return {
            ...result,
            score: scored?.score ?? result.score,
            chunk: {
              ...result.chunk,
              metadata: {
                ...result.chunk.metadata,
                rerankReason: scored?.reason
              }
            }
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    } catch (error: any) {
      logger.warn('LLM rerank failed, falling back to heuristic', { error: error.message });
      const fallback = new ReRanker({ mode: 'heuristic' });
      return fallback.rerank(query, results, topK);
    }
  }

  private calculateEmbeddingScore(query: string, chunk: DocumentChunk): number {
    const queryTokens = new Set(this.tokenizer.tokenize(query.toLowerCase()) || []);
    const docTokens = new Set(this.tokenizer.tokenize(chunk.content.toLowerCase()) || []);
    const intersection = [...queryTokens].filter(token => docTokens.has(token)).length;
    const union = new Set([...queryTokens, ...docTokens]).size;
    const lexical = union > 0 ? intersection / union : 0;
    const trust = typeof chunk.metadata.trustScore === 'number' ? chunk.metadata.trustScore : 0.7;
    return lexical * 0.8 + trust * 0.2;
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

