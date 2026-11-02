/**
 * Wikipedia Knowledge Source - Fetch information from Wikipedia
 * Enhanced with smart features: query expansion, semantic ranking, result deduplication
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';
import { QueryEnhancer } from './QueryEnhancer';
import { ResultRanker } from './ResultRanker';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { LLMAdapter } from '../providers/LLMAdapter';

export class WikipediaSource implements KnowledgeSource {
  name = 'wikipedia';
  private baseUrl = 'https://en.wikipedia.org/api/rest_v1';
  private readonly requestConfig = {
    headers: { 'User-Agent': 'AIChatbotHub/1.0 (local knowledge assistant)' },
    timeout: 10000
  };
  private queryEnhancer?: QueryEnhancer;
  private resultRanker?: ResultRanker;
  private resultCache: Map<string, { results: KnowledgeResult[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour

  constructor(embeddingService?: EmbeddingService, llmAdapter?: LLMAdapter) {
    if (embeddingService || llmAdapter) {
      this.queryEnhancer = new QueryEnhancer(llmAdapter);
      this.resultRanker = new ResultRanker(embeddingService);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/page/summary/Test`, this.requestConfig);
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number; includeDetails?: boolean } = {}): Promise<KnowledgeResult[]> {
    // Check cache
    const cacheKey = `${query.toLowerCase()}|details=${options.includeDetails === true}`;
    const cached = this.resultCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.debug('Returning cached Wikipedia results', { query });
      return cached.results.slice(0, options.limit || 10);
    }

    // Enhance query if enhancer available
    let searchQuery = query;
    if (this.queryEnhancer) {
      try {
        const enhanced = await this.queryEnhancer.enhance(query, 'general knowledge');
        searchQuery = enhanced.enhanced;
        logger.debug('Query enhanced', { original: query, enhanced: searchQuery });
      } catch (error: any) {
        logger.warn('Query enhancement failed', { error: error.message });
      }
    }

    // Perform base search
    const results = await this.searchBase(searchQuery, options);

    // Rank results if ranker available
    let rankedResults = results;
    if (this.resultRanker && results.length > 0) {
      try {
        rankedResults = await this.resultRanker.rank(query, results);
        logger.debug('Results ranked', { count: rankedResults.length });
      } catch (error: any) {
        logger.warn('Result ranking failed', { error: error.message });
      }
    }

    // Deduplicate results
    const deduplicated = this.deduplicateResults(rankedResults);

    // Cache results
    this.resultCache.set(cacheKey, {
      results: deduplicated,
      timestamp: Date.now(),
    });

    return deduplicated.slice(0, options.limit || 10);
  }

  /**
   * Base search implementation
   */
  private async searchBase(query: string, options: { limit?: number; includeDetails?: boolean } = {}): Promise<KnowledgeResult[]> {
    try {
      // Search Wikipedia
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${options.limit || 5}`;
      const searchResponse = await axios.get(searchUrl, this.requestConfig);
      const searchResults = searchResponse.data.query?.search || [];

      const results: KnowledgeResult[] = [];

      for (const item of searchResults) {
        try {
          // Get page summary
          const summaryUrl = `${this.baseUrl}/page/summary/${encodeURIComponent(item.title)}`;
          const summaryResponse = await axios.get(summaryUrl, this.requestConfig);
          const summary = summaryResponse.data;
          let content = summary.extract || summary.description || '';
          if (options.includeDetails && content.length < 500) {
            const detailedContent = await this.fetchDetailedContent(item.title);
            if (detailedContent) {
              content = detailedContent;
            }
          }

          results.push({
            id: `wiki_${item.pageid}`,
            title: summary.title,
            content,
            source: 'wikipedia',
            url: summary.content_urls?.desktop?.page,
            metadata: {
              pageId: item.pageid,
              snippet: item.snippet,
              wordCount: summary.extract?.split(' ').length || 0,
            },
            confidence: 0.8,
          });
        } catch (error: any) {
          logger.warn('Failed to fetch Wikipedia page', { title: item.title, error: error.message });
        }
      }

      return results;
    } catch (error: any) {
      logger.error('Wikipedia search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      const pageTitle = id.replace('wiki_', '');
      const url = `${this.baseUrl}/page/summary/${encodeURIComponent(pageTitle)}`;
      const response = await axios.get(url, this.requestConfig);
      const data = response.data;

      return {
        id,
        title: data.title,
        content: data.extract || data.description || '',
        source: 'wikipedia',
        url: data.content_urls?.desktop?.page,
        metadata: {
          pageId: data.pageid,
          wordCount: data.extract?.split(' ').length || 0,
        },
        confidence: 0.9,
      };
    } catch (error: any) {
      logger.warn('Failed to fetch Wikipedia page by ID', { id, error: error.message });
      return null;
    }
  }

  private async fetchDetailedContent(title: string): Promise<string> {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2`;
      const response = await axios.get(url, this.requestConfig);
      const wikitext = String(response.data?.parse?.wikitext || '');
      return this.cleanWikitext(wikitext).slice(0, 12000);
    } catch (error: any) {
      logger.warn('Failed to fetch detailed Wikipedia content', { title, error: error.message });
      return '';
    }
  }

  private cleanWikitext(value: string): string {
    return value
      .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
      .replace(/<ref\b[^/>]*\/>/gi, '')
      .replace(/\[\[(?:File|Image):[^\]]+\]\]/gi, '')
      .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
      .replace(/\{\{[^{}]*\}\}/g, '')
      .replace(/^\{\|.*$/gm, '')
      .replace(/^\|\}.*$/gm, '')
      .replace(/^\|-.*$/gm, '')
      .replace(/^[|!]\s*/gm, '')
      .replace(/\|\|/g, ' | ')
      .replace(/'{2,3}/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private deduplicateResults(results: KnowledgeResult[]): KnowledgeResult[] {
    const seen = new Set<string>();
    return results.filter((result) => {
      const key = result.url || result.id || result.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

