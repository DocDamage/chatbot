/**
 * Web Searcher - Real-time information retrieval
 * Research: Latest Agentic AI papers, Web Search
 */

import axios from 'axios';
import { Tool, ToolResult } from '../../types/tools';
import { logger } from '../observability/logger';

export class WebSearcher {
  private apiKey?: string;
  private searchEngine: 'google' | 'duckduckgo' | 'bing';

  constructor(apiKey?: string, searchEngine: 'google' | 'duckduckgo' | 'bing' = 'duckduckgo') {
    this.apiKey = apiKey;
    this.searchEngine = searchEngine;
  }

  /**
   * Search the web
   */
  async search(query: string, maxResults: number = 5): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      let results: any[];

      switch (this.searchEngine) {
        case 'duckduckgo':
          results = await this.searchDuckDuckGo(query, maxResults);
          break;
        case 'google':
          if (!this.apiKey) {
            throw new Error('Google search requires API key');
          }
          results = await this.searchGoogle(query, maxResults);
          break;
        case 'bing':
          if (!this.apiKey) {
            throw new Error('Bing search requires API key');
          }
          results = await this.searchBing(query, maxResults);
          break;
        default:
          throw new Error(`Unsupported search engine: ${this.searchEngine}`);
      }

      const executionTime = Date.now() - startTime;

      logger.info('Web search completed', {
        query: query.substring(0, 50),
        resultsCount: results.length,
        executionTime
      });

      return {
        success: true,
        data: {
          query,
          results,
          count: results.length
        },
        metadata: {
          executionTime
        }
      };
    } catch (error: any) {
      logger.error('Web search failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search using DuckDuckGo (no API key needed)
   */
  private async searchDuckDuckGo(query: string, maxResults: number): Promise<any[]> {
    try {
      // Use DuckDuckGo Instant Answer API
      const response = await this.axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: '1',
          skip_disambig: '1'
        },
        timeout: 5000
      });

      const results: any[] = [];

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
        }
      }

      return results.slice(0, maxResults);
    } catch (error: any) {
      logger.warn('DuckDuckGo search failed', { error: error.message });
      // Fallback: return empty results
      return [];
    }
  }

  /**
   * Search using Google Custom Search API
   */
  private async searchGoogle(query: string, maxResults: number): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Google API key required');
    }

    // Placeholder - would use Google Custom Search API
    logger.warn('Google search not fully implemented - requires Google Custom Search API');
    return [];
  }

  /**
   * Search using Bing Search API
   */
  private async searchBing(query: string, maxResults: number): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Bing API key required');
    }

    // Placeholder - would use Bing Search API
    logger.warn('Bing search not fully implemented - requires Bing Search API');
    return [];
  }

  /**
   * Create a web search tool
   */
  createTool(): Tool {
    return {
      id: 'web_searcher',
      name: 'search_web',
      description: 'Search the web for real-time information. Returns relevant search results.',
      category: require('../../types/tools').ToolCategory.WEB_SEARCH,
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
}

