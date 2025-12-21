/**
 * Smart Knowledge Source - Enhanced base class with intelligent features
 * Adds: query expansion, semantic understanding, result ranking, cross-source verification
 */

import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { LLMAdapter } from '../providers/LLMAdapter';

export interface SmartSourceOptions {
  embeddingService?: EmbeddingService;
  llmAdapter?: LLMAdapter;
  enableQueryExpansion?: boolean;
  enableSemanticRanking?: boolean;
  enableCrossVerification?: boolean;
  enableCaching?: boolean;
  maxResults?: number;
  minConfidence?: number;
}

export abstract class SmartKnowledgeSource implements KnowledgeSource {
  abstract name: string;
  protected options: SmartSourceOptions;
  protected embeddingService?: EmbeddingService;
  protected llmAdapter?: LLMAdapter;
  private queryCache: Map<string, { results: KnowledgeResult[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour

  constructor(options: SmartSourceOptions = {}) {
    this.options = {
      enableQueryExpansion: true,
      enableSemanticRanking: true,
      enableCrossVerification: false,
      enableCaching: true,
      maxResults: 10,
      minConfidence: 0.5,
      ...options,
    };
    this.embeddingService = options.embeddingService;
    this.llmAdapter = options.llmAdapter;
  }

  /**
   * Abstract method - must be implemented by subclasses
   */
  abstract searchBase(query: string, options?: any): Promise<KnowledgeResult[]>;

  /**
   * Smart search with enhancements
   */
  async search(query: string, options: any = {}): Promise<KnowledgeResult[]> {
    try {
      // Check cache
      if (this.options.enableCaching) {
        const cached = this.getCachedResults(query);
        if (cached) {
          logger.debug('Returning cached results', { query, count: cached.length });
          return cached;
        }
      }

      // Step 1: Query expansion and enhancement
      const enhancedQuery = await this.enhanceQuery(query);
      logger.debug('Query enhanced', { original: query, enhanced: enhancedQuery });

      // Step 2: Base search with expanded queries
      const baseResults = await this.searchBase(enhancedQuery, options);

      // Step 3: Semantic ranking
      let rankedResults = baseResults;
      if (this.options.enableSemanticRanking && this.embeddingService) {
        rankedResults = await this.semanticRanking(query, baseResults);
      }

      // Step 4: Cross-source verification (if enabled)
      if (this.options.enableCrossVerification) {
        rankedResults = await this.crossVerifyResults(rankedResults);
      }

      // Step 5: Filter by confidence
      const filtered = rankedResults.filter(
        r => (r.confidence || 0) >= (options.minConfidence || this.options.minConfidence || 0.5)
      );

      // Step 6: Limit results
      const limited = filtered.slice(0, options.limit || this.options.maxResults || 10);

      // Step 7: Cache results
      if (this.options.enableCaching) {
        this.cacheResults(query, limited);
      }

      return limited;
    } catch (error: any) {
      logger.error('Smart search failed', { query, error: error.message });
      // Fallback to base search
      return this.searchBase(query, options);
    }
  }

  /**
   * Enhance query with context and expansion
   */
  private async enhanceQuery(query: string): Promise<string> {
    if (!this.options.enableQueryExpansion) {
      return query;
    }

    try {
      // Use LLM to expand query if available
      if (this.llmAdapter) {
        const prompt = `Expand and enhance this search query to improve search results. 
        Add relevant synonyms, related terms, and context. Keep it concise.
        
        Original query: "${query}"
        
        Enhanced query:`;

        const response = await this.llmAdapter.generate(prompt, {
          maxTokens: 50,
          temperature: 0.3,
        });

        if (response && response.trim()) {
          return response.trim();
        }
      }

      // Fallback: Basic query enhancement
      return this.basicQueryEnhancement(query);
    } catch (error: any) {
      logger.warn('Query enhancement failed', { error: error.message });
      return query;
    }
  }

  /**
   * Basic query enhancement without LLM
   */
  private basicQueryEnhancement(query: string): string {
    // Add common synonyms and related terms
    const enhancements: Record<string, string[]> = {
      'how': ['method', 'technique', 'process', 'way'],
      'what': ['definition', 'meaning', 'concept'],
      'why': ['reason', 'cause', 'explanation'],
      'best': ['top', 'optimal', 'recommended', 'excellent'],
      'guide': ['tutorial', 'instructions', 'how-to', 'steps'],
    };

    const words = query.toLowerCase().split(/\s+/);
    const enhanced: string[] = [query];

    for (const word of words) {
      if (enhancements[word]) {
        for (const synonym of enhancements[word]) {
          enhanced.push(query.replace(new RegExp(word, 'gi'), synonym));
        }
      }
    }

    return enhanced.join(' OR ');
  }

  /**
   * Semantic ranking using embeddings
   */
  private async semanticRanking(
    originalQuery: string,
    results: KnowledgeResult[]
  ): Promise<KnowledgeResult[]> {
    if (!this.embeddingService || results.length === 0) {
      return results;
    }

    try {
      // Get query embedding
      const queryEmbedding = await this.embeddingService.generateEmbedding(originalQuery);

      // Calculate similarity for each result
      const scoredResults = await Promise.all(
        results.map(async (result) => {
          try {
            // Create text representation of result
            const resultText = `${result.title} ${result.content}`.substring(0, 500);
            const resultEmbedding = await this.embeddingService!.generateEmbedding(resultText);

            // Calculate cosine similarity
            const similarity = this.cosineSimilarity(queryEmbedding, resultEmbedding);

            // Combine with existing confidence
            const combinedConfidence = (result.confidence || 0.5) * 0.7 + similarity * 0.3;

            return {
              ...result,
              confidence: Math.min(combinedConfidence, 1.0),
              semanticScore: similarity,
            };
          } catch (error: any) {
            logger.warn('Semantic scoring failed for result', { id: result.id, error: error.message });
            return result;
          }
        })
      );

      // Sort by combined confidence
      return scoredResults.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    } catch (error: any) {
      logger.warn('Semantic ranking failed', { error: error.message });
      return results;
    }
  }

  /**
   * Cross-verify results with other sources
   */
  private async crossVerifyResults(results: KnowledgeResult[]): Promise<KnowledgeResult[]> {
    // This would verify results against other sources
    // For now, boost confidence for results that appear in multiple sources
    const verified = results.map(result => {
      // If result has multiple source references, boost confidence
      if (result.metadata?.sources && Array.isArray(result.metadata.sources) && result.metadata.sources.length > 1) {
        return {
          ...result,
          confidence: Math.min((result.confidence || 0.5) + 0.1, 1.0),
        };
      }
      return result;
    });

    return verified;
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      return 0;
    }

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

  /**
   * Cache management
   */
  private getCachedResults(query: string): KnowledgeResult[] | null {
    const cached = this.queryCache.get(query.toLowerCase());
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.results;
    }
    return null;
  }

  private cacheResults(query: string, results: KnowledgeResult[]): void {
    this.queryCache.set(query.toLowerCase(), {
      results,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    if (this.queryCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of this.queryCache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL) {
          this.queryCache.delete(key);
        }
      }
    }
  }

  abstract isAvailable(): Promise<boolean>;
  abstract getById(id: string): Promise<KnowledgeResult | null>;
}

