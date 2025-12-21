/**
 * Query Enhancer - Intelligent query understanding and expansion
 */

import { LLMAdapter } from '../providers/LLMAdapter';
import { logger } from '../observability/logger';

export interface EnhancedQuery {
  original: string;
  enhanced: string;
  keywords: string[];
  intent: string;
  entities: string[];
  context: string;
}

export class QueryEnhancer {
  private llmAdapter?: LLMAdapter;
  private cache: Map<string, EnhancedQuery> = new Map();

  constructor(llmAdapter?: LLMAdapter) {
    this.llmAdapter = llmAdapter;
  }

  /**
   * Enhance query with intelligent understanding
   */
  async enhance(query: string, domain?: string): Promise<EnhancedQuery> {
    // Check cache
    const cacheKey = `${query}_${domain || 'general'}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      if (this.llmAdapter) {
        return await this.llmEnhance(query, domain);
      } else {
        return this.basicEnhance(query, domain);
      }
    } catch (error: any) {
      logger.warn('Query enhancement failed', { error: error.message });
      return this.basicEnhance(query, domain);
    }
  }

  /**
   * LLM-powered query enhancement
   */
  private async llmEnhance(query: string, domain?: string): Promise<EnhancedQuery> {
    const prompt = `Analyze this search query and provide:
1. Enhanced query with synonyms and related terms
2. Key keywords (comma-separated)
3. User intent (one word: informational, navigational, transactional)
4. Named entities (comma-separated)
5. Context (one sentence)

${domain ? `Domain: ${domain}\n` : ''}Query: "${query}"

Format as JSON:
{
  "enhanced": "enhanced query",
  "keywords": "keyword1, keyword2",
  "intent": "informational",
  "entities": "entity1, entity2",
  "context": "context description"
}`;

    try {
      const response = await this.llmAdapter!.generate(prompt, {
        maxTokens: 200,
        temperature: 0.3,
      });

      const parsed = this.parseLLMResponse(response);
      const enhanced: EnhancedQuery = {
        original: query,
        enhanced: parsed.enhanced || query,
        keywords: parsed.keywords ? parsed.keywords.split(',').map(k => k.trim()) : [],
        intent: parsed.intent || 'informational',
        entities: parsed.entities ? parsed.entities.split(',').map(e => e.trim()) : [],
        context: parsed.context || '',
      };

      this.cache.set(`${query}_${domain || 'general'}`, enhanced);
      return enhanced;
    } catch (error: any) {
      logger.warn('LLM enhancement failed', { error: error.message });
      return this.basicEnhance(query, domain);
    }
  }

  /**
   * Basic query enhancement without LLM
   */
  private basicEnhance(query: string, domain?: string): EnhancedQuery {
    const words = query.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

    const keywords = words.filter(w => !stopWords.has(w) && w.length > 2);
    const enhanced = query; // Keep original for basic enhancement

    return {
      original: query,
      enhanced,
      keywords,
      intent: this.detectIntent(query),
      entities: this.extractEntities(query),
      context: domain || 'general',
    };
  }

  /**
   * Detect user intent
   */
  private detectIntent(query: string): string {
    const lower = query.toLowerCase();
    if (lower.match(/^(how|what|why|when|where|who)/)) {
      return 'informational';
    }
    if (lower.match(/(buy|purchase|order|price|cost)/)) {
      return 'transactional';
    }
    if (lower.match(/(go to|visit|find|locate)/)) {
      return 'navigational';
    }
    return 'informational';
  }

  /**
   * Extract basic entities
   */
  private extractEntities(query: string): string[] {
    // Basic entity extraction (would be enhanced with NER in production)
    const entities: string[] = [];
    const capitalized = query.match(/\b[A-Z][a-z]+\b/g);
    if (capitalized) {
      entities.push(...capitalized);
    }
    return entities;
  }

  /**
   * Parse LLM response
   */
  private parseLLMResponse(response: string): any {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch {
      return {};
    }
  }
}

