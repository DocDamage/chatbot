/**
 * Web Searcher - Real-time information retrieval with Google, Bing, and DuckDuckGo
 * Research: Latest Agentic AI papers, Web Search
 */

import axios from 'axios';
import { Tool, ToolResult, ToolCategory } from '../../types/tools';
import { logger } from '../observability/logger';

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
  displayUrl?: string;
  datePublished?: string;
}

export interface SearchConfig {
  googleApiKey?: string;
  googleCseId?: string; // Custom Search Engine ID
  bingApiKey?: string;
}

export class WebSearcher {
  private config: SearchConfig;
  private searchEngine: 'google' | 'duckduckgo' | 'bing';

  constructor(
    config: SearchConfig = {},
    searchEngine: 'google' | 'duckduckgo' | 'bing' = 'duckduckgo'
  ) {
    this.config = config;
    this.searchEngine = searchEngine;
  }

  /**
   * Search the web
   */
  async search(query: string, maxResults: number = 5): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      let results: SearchResult[];

      switch (this.searchEngine) {
        case 'duckduckgo':
          results = await this.searchDuckDuckGo(query, maxResults);
          break;
        case 'google':
          results = await this.searchGoogle(query, maxResults);
          break;
        case 'bing':
          results = await this.searchBing(query, maxResults);
          break;
        default:
          throw new Error(`Unsupported search engine: ${this.searchEngine}`);
      }

      const executionTime = Date.now() - startTime;

      logger.info('Web search completed', {
        query: query.substring(0, 50),
        engine: this.searchEngine,
        resultsCount: results.length,
        executionTime
      });

      return {
        success: true,
        data: {
          query,
          results,
          count: results.length,
          engine: this.searchEngine
        },
        metadata: {
          executionTime
        }
      };
    } catch (error: any) {
      logger.error('Web search failed', { error: error.message, engine: this.searchEngine });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search using DuckDuckGo (no API key needed)
   */
  private async searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      // Use DuckDuckGo Instant Answer API
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: '1',
          skip_disambig: '1'
        },
        timeout: 5000
      });

      const results: SearchResult[] = [];

      // Extract instant answer
      if (response.data.AbstractText) {
        results.push({
          title: response.data.Heading || query,
          snippet: response.data.AbstractText,
          url: response.data.AbstractURL,
          source: 'DuckDuckGo'
        });
      }

      // Extract related topics
      if (response.data.RelatedTopics) {
        for (const topic of response.data.RelatedTopics.slice(0, maxResults - 1)) {
          if (topic.Text) {
            results.push({
              title: topic.Text.split(' - ')[0] || query,
              snippet: topic.Text,
              url: topic.FirstURL,
              source: 'DuckDuckGo'
            });
          }
          // Handle nested topics (subtopics)
          if (topic.Topics) {
            for (const subtopic of topic.Topics) {
              if (subtopic.Text && results.length < maxResults) {
                results.push({
                  title: subtopic.Text.split(' - ')[0] || query,
                  snippet: subtopic.Text,
                  url: subtopic.FirstURL,
                  source: 'DuckDuckGo'
                });
              }
            }
          }
        }
      }

      // Also try DuckDuckGo HTML scraping as fallback for more results
      if (results.length < maxResults) {
        try {
          const htmlResults = await this.scrapeDuckDuckGo(query, maxResults - results.length);
          results.push(...htmlResults);
        } catch (e) {
          // Ignore fallback errors
        }
      }

      return results.slice(0, maxResults);
    } catch (error: any) {
      logger.warn('DuckDuckGo search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Scrape DuckDuckGo HTML results as fallback
   */
  private async scrapeDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      const response = await axios.get('https://html.duckduckgo.com/html/', {
        params: { q: query },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 5000
      });

      const results: SearchResult[] = [];
      const html = response.data;

      // Simple regex extraction (for basic results)
      const resultPattern = /<a class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]*)/g;
      let match;

      while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
        results.push({
          title: match[2].trim(),
          url: match[1],
          snippet: match[3].trim(),
          source: 'DuckDuckGo'
        });
      }

      return results;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search using Google Custom Search API
   */
  private async searchGoogle(query: string, maxResults: number): Promise<SearchResult[]> {
    if (!this.config.googleApiKey || !this.config.googleCseId) {
      throw new Error('Google search requires API key and Custom Search Engine ID. Set GOOGLE_API_KEY and GOOGLE_CSE_ID environment variables.');
    }

    try {
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: this.config.googleApiKey,
          cx: this.config.googleCseId,
          q: query,
          num: Math.min(maxResults, 10) // Google limits to 10 per request
        },
        timeout: 10000
      });

      const results: SearchResult[] = [];

      if (response.data.items) {
        for (const item of response.data.items) {
          results.push({
            title: item.title,
            snippet: item.snippet || '',
            url: item.link,
            displayUrl: item.displayLink,
            source: 'Google'
          });
        }
      }

      logger.info('Google search completed', {
        query: query.substring(0, 30),
        resultsCount: results.length
      });

      return results;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Google API quota exceeded or invalid API key');
      }
      if (error.response?.status === 400) {
        throw new Error('Invalid Google CSE configuration');
      }
      throw new Error(`Google search failed: ${error.message}`);
    }
  }

  /**
   * Search using Bing Search API (Azure Cognitive Services)
   */
  private async searchBing(query: string, maxResults: number): Promise<SearchResult[]> {
    if (!this.config.bingApiKey) {
      throw new Error('Bing search requires API key. Set BING_API_KEY environment variable.');
    }

    try {
      const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
        params: {
          q: query,
          count: Math.min(maxResults, 50),
          responseFilter: 'Webpages'
        },
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.bingApiKey
        },
        timeout: 10000
      });

      const results: SearchResult[] = [];

      if (response.data.webPages?.value) {
        for (const item of response.data.webPages.value) {
          results.push({
            title: item.name,
            snippet: item.snippet || '',
            url: item.url,
            displayUrl: item.displayUrl,
            datePublished: item.dateLastCrawled,
            source: 'Bing'
          });
        }
      }

      logger.info('Bing search completed', {
        query: query.substring(0, 30),
        resultsCount: results.length
      });

      return results;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Bing API key');
      }
      if (error.response?.status === 403) {
        throw new Error('Bing API quota exceeded');
      }
      throw new Error(`Bing search failed: ${error.message}`);
    }
  }

  /**
   * Search multiple engines and combine results
   */
  async searchMultiple(
    query: string,
    engines: Array<'google' | 'bing' | 'duckduckgo'> = ['duckduckgo'],
    maxResultsPerEngine: number = 3
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const allResults: SearchResult[] = [];
    const errors: string[] = [];

    for (const engine of engines) {
      try {
        const searcher = new WebSearcher(this.config, engine);
        const result = await searcher.search(query, maxResultsPerEngine);

        if (result.success && result.data?.results) {
          allResults.push(...result.data.results);
        }
      } catch (error: any) {
        errors.push(`${engine}: ${error.message}`);
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    return {
      success: uniqueResults.length > 0,
      data: {
        query,
        results: uniqueResults,
        count: uniqueResults.length,
        engines
      },
      metadata: {
        executionTime: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined
      }
    };
  }

  /**
   * Search for news articles
   */
  async searchNews(query: string, maxResults: number = 5): Promise<ToolResult> {
    if (!this.config.bingApiKey) {
      // Fallback to DuckDuckGo with news modifier
      return this.search(`${query} site:news.google.com OR site:bbc.com OR site:cnn.com`, maxResults);
    }

    try {
      const response = await axios.get('https://api.bing.microsoft.com/v7.0/news/search', {
        params: {
          q: query,
          count: Math.min(maxResults, 100),
          freshness: 'Week'
        },
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.bingApiKey
        },
        timeout: 10000
      });

      const results: SearchResult[] = [];

      if (response.data.value) {
        for (const item of response.data.value) {
          results.push({
            title: item.name,
            snippet: item.description || '',
            url: item.url,
            datePublished: item.datePublished,
            source: item.provider?.[0]?.name || 'Bing News'
          });
        }
      }

      return {
        success: true,
        data: {
          query,
          results,
          count: results.length,
          type: 'news'
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a web search tool
   */
  createTool(): Tool {
    return {
      id: 'web_searcher',
      name: 'search_web',
      description: 'Search the web for real-time information. Returns relevant search results.',
      category: ToolCategory.WEB_SEARCH,
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'The search query',
          required: true
        },
        {
          name: 'max_results',
          type: 'number',
          description: 'Maximum number of results to return',
          required: false,
          default: 5
        }
      ],
      execute: async (params: Record<string, any>) => {
        return this.search(params.query, params.max_results);
      }
    };
  }

  /**
   * Create from environment variables
   */
  static fromEnv(searchEngine?: 'google' | 'duckduckgo' | 'bing'): WebSearcher {
    const config: SearchConfig = {
      googleApiKey: process.env.GOOGLE_API_KEY || process.env.SEARCH_API_KEY,
      googleCseId: process.env.GOOGLE_CSE_ID,
      bingApiKey: process.env.BING_API_KEY || process.env.SEARCH_API_KEY
    };

    // Choose best available engine
    let engine: 'google' | 'bing' | 'duckduckgo' = searchEngine || (process.env.SEARCH_ENGINE as any) || 'duckduckgo';
    if (!searchEngine && config.googleApiKey && config.googleCseId) {
      engine = 'google';
    } else if (!searchEngine && config.bingApiKey) {
      engine = 'bing';
    }

    return new WebSearcher(config, engine);
  }
}
