/**
 * Query Enhancer - Intelligent query understanding and expansion with NER
 * Uses Compromise.js for NLP/NER when available
 */

import { LLMAdapter } from '../providers/LLMAdapter';
import { logger } from '../observability/logger';

// Dynamic import for compromise NLP
let nlp: any = null;
let nlpLoaded = false;

async function loadNLP(): Promise<boolean> {
  if (nlp !== null) return nlpLoaded;

  try {
    nlp = require('compromise');
    nlpLoaded = true;
    logger.info('Compromise NLP loaded successfully');
    return true;
  } catch (error) {
    logger.warn('Compromise NLP not available - using basic entity extraction');
    nlpLoaded = false;
    return false;
  }
}

export interface EnhancedQuery {
  original: string;
  enhanced: string;
  keywords: string[];
  intent: string;
  entities: EntityInfo[];
  context: string;
  topics?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface EntityInfo {
  text: string;
  type: 'person' | 'place' | 'organization' | 'date' | 'time' | 'money' | 'number' | 'topic' | 'unknown';
  normalized?: string;
}

export class QueryEnhancer {
  private llmAdapter?: LLMAdapter;
  private cache: Map<string, EnhancedQuery> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour
  private cacheTimestamps: Map<string, number> = new Map();

  constructor(llmAdapter?: LLMAdapter) {
    this.llmAdapter = llmAdapter;
    // Preload NLP
    loadNLP().catch(() => { });
  }

  /**
   * Enhance query with intelligent understanding
   */
  async enhance(query: string, domain?: string): Promise<EnhancedQuery> {
    // Check cache
    const cacheKey = `${query}_${domain || 'general'}`;
    const cached = this.cache.get(cacheKey);
    const cacheTime = this.cacheTimestamps.get(cacheKey);

    if (cached && cacheTime && Date.now() - cacheTime < this.CACHE_TTL) {
      return cached;
    }

    try {
      let result: EnhancedQuery;

      if (this.llmAdapter) {
        result = await this.llmEnhance(query, domain);
      } else {
        result = await this.nlpEnhance(query, domain);
      }

      // Cache result
      this.cache.set(cacheKey, result);
      this.cacheTimestamps.set(cacheKey, Date.now());

      return result;
    } catch (error: any) {
      logger.warn('Query enhancement failed', { error: error.message });
      return this.nlpEnhance(query, domain);
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
      const response = await this.llmAdapter!.generate({
        prompt,
        maxTokens: 200,
        temperature: 0.3,
      });

      const parsed = this.parseLLMResponse(response.content);

      // Use NLP to enhance entity extraction
      const nlpEntities = await this.extractEntitiesNLP(query);
      const llmEntities = parsed.entities
        ? parsed.entities.split(',').map((e: string) => e.trim())
        : [];

      // Merge entities from both sources
      const mergedEntities = this.mergeEntities(nlpEntities, llmEntities);

      const enhanced: EnhancedQuery = {
        original: query,
        enhanced: parsed.enhanced || query,
        keywords: parsed.keywords ? parsed.keywords.split(',').map((k: string) => k.trim()) : [],
        intent: parsed.intent || 'informational',
        entities: mergedEntities,
        context: parsed.context || '',
        topics: await this.extractTopics(query),
        sentiment: await this.detectSentiment(query)
      };

      return enhanced;
    } catch (error: any) {
      logger.warn('LLM enhancement failed', { error: error.message });
      return this.nlpEnhance(query, domain);
    }
  }

  /**
   * NLP-based query enhancement (without LLM)
   */
  private async nlpEnhance(query: string, domain?: string): Promise<EnhancedQuery> {
    const words = query.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can']);

    const keywords = words.filter(w => !stopWords.has(w) && w.length > 2);

    // Get entities using NLP
    const entities = await this.extractEntitiesNLP(query);

    // Extract topics
    const topics = await this.extractTopics(query);

    // Enhance the query with synonyms
    const enhanced = await this.expandWithSynonyms(query, keywords);

    return {
      original: query,
      enhanced,
      keywords,
      intent: this.detectIntent(query),
      entities,
      context: domain || 'general',
      topics,
      sentiment: await this.detectSentiment(query)
    };
  }

  /**
   * Extract entities using Compromise NLP
   */
  private async extractEntitiesNLP(query: string): Promise<EntityInfo[]> {
    const isLoaded = await loadNLP();
    const entities: EntityInfo[] = [];

    if (isLoaded) {
      try {
        const doc = nlp(query);

        // Extract people
        doc.people().forEach((p: any) => {
          entities.push({
            text: p.text(),
            type: 'person',
            normalized: p.text()
          });
        });

        // Extract places
        doc.places().forEach((p: any) => {
          entities.push({
            text: p.text(),
            type: 'place',
            normalized: p.text()
          });
        });

        // Extract organizations
        doc.organizations().forEach((o: any) => {
          entities.push({
            text: o.text(),
            type: 'organization',
            normalized: o.text()
          });
        });

        // Extract dates
        doc.dates().forEach((d: any) => {
          entities.push({
            text: d.text(),
            type: 'date',
            normalized: d.text()
          });
        });

        // Extract money
        doc.money().forEach((m: any) => {
          entities.push({
            text: m.text(),
            type: 'money',
            normalized: m.text()
          });
        });

        // Extract numbers
        doc.numbers().forEach((n: any) => {
          entities.push({
            text: n.text(),
            type: 'number',
            normalized: n.text()
          });
        });

        // Extract nouns as potential topics
        doc.nouns().forEach((n: any) => {
          const text = n.text();
          if (!entities.some(e => e.text === text) && text.length > 2) {
            entities.push({
              text,
              type: 'topic',
              normalized: n.root().text() || text
            });
          }
        });

      } catch (error: any) {
        logger.warn('NLP entity extraction failed', { error: error.message });
      }
    }

    // Fallback: basic capitalized word extraction
    if (entities.length === 0) {
      const capitalized = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
      if (capitalized) {
        for (const text of capitalized) {
          entities.push({
            text,
            type: 'unknown',
            normalized: text
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract topics from query
   */
  private async extractTopics(query: string): Promise<string[]> {
    const isLoaded = await loadNLP();
    const topics: string[] = [];

    if (isLoaded) {
      try {
        const doc = nlp(query);
        // Get nouns and noun phrases as topics
        doc.nouns().forEach((n: any) => {
          const topic = n.text().toLowerCase();
          if (topic.length > 2 && !topics.includes(topic)) {
            topics.push(topic);
          }
        });
      } catch {
        // Fall through to basic extraction
      }
    }

    // Fallback: extract longer words as potential topics
    if (topics.length === 0) {
      const words = query.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 4 && !topics.includes(word)) {
          topics.push(word);
        }
      }
    }

    return topics.slice(0, 5);
  }

  /**
   * Detect sentiment
   */
  private async detectSentiment(query: string): Promise<'positive' | 'negative' | 'neutral'> {
    const isLoaded = await loadNLP();

    if (isLoaded) {
      try {
        const doc = nlp(query);

        // Check for sentiment indicators
        const positiveWords = doc.match('#Positive').length;
        const negativeWords = doc.match('#Negative').length;

        if (positiveWords > negativeWords) return 'positive';
        if (negativeWords > positiveWords) return 'negative';
      } catch {
        // Fall through to basic detection
      }
    }

    // Basic sentiment detection
    const lower = query.toLowerCase();
    const positiveIndicators = ['good', 'great', 'best', 'love', 'amazing', 'excellent', 'wonderful', 'fantastic'];
    const negativeIndicators = ['bad', 'worst', 'hate', 'terrible', 'awful', 'horrible', 'poor', 'fail'];

    const positiveCount = positiveIndicators.filter(w => lower.includes(w)).length;
    const negativeCount = negativeIndicators.filter(w => lower.includes(w)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Expand query with synonyms
   */
  private async expandWithSynonyms(query: string, keywords: string[]): Promise<string> {
    // Common synonym mappings
    const synonyms: Record<string, string[]> = {
      'fast': ['quick', 'rapid', 'speedy'],
      'big': ['large', 'huge', 'massive'],
      'small': ['tiny', 'little', 'compact'],
      'good': ['great', 'excellent', 'quality'],
      'bad': ['poor', 'terrible', 'awful'],
      'buy': ['purchase', 'acquire', 'get'],
      'make': ['create', 'build', 'produce'],
      'find': ['search', 'locate', 'discover'],
      'help': ['assist', 'support', 'aid'],
      'best': ['top', 'leading', 'premier']
    };

    let enhanced = query;
    for (const keyword of keywords) {
      const synList = synonyms[keyword];
      if (synList && synList.length > 0) {
        // Add one synonym to the query
        enhanced += ` ${synList[0]}`;
        break; // Only add one to avoid over-expansion
      }
    }

    return enhanced;
  }

  /**
   * Merge entities from NLP and LLM sources
   */
  private mergeEntities(nlpEntities: EntityInfo[], llmEntities: string[]): EntityInfo[] {
    const merged = [...nlpEntities];
    const existingTexts = new Set(nlpEntities.map(e => e.text.toLowerCase()));

    for (const entity of llmEntities) {
      if (!existingTexts.has(entity.toLowerCase())) {
        merged.push({
          text: entity,
          type: 'unknown',
          normalized: entity
        });
      }
    }

    return merged;
  }

  /**
   * Detect user intent
   */
  private detectIntent(query: string): string {
    const lower = query.toLowerCase();
    if (lower.match(/^(how|what|why|when|where|who|explain|describe|define)/)) {
      return 'informational';
    }
    if (lower.match(/(buy|purchase|order|price|cost|shop|deal)/)) {
      return 'transactional';
    }
    if (lower.match(/(go to|visit|find|locate|navigate|login|sign in)/)) {
      return 'navigational';
    }
    if (lower.match(/(compare|vs|versus|difference|better)/)) {
      return 'comparative';
    }
    return 'informational';
  }

  /**
   * Parse LLM response
   */
  private parseLLMResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}
