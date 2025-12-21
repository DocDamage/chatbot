/**
 * Wikipedia Knowledge Source - Fetch information from Wikipedia
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class WikipediaSource implements KnowledgeSource {
  name = 'wikipedia';
  private baseUrl = 'https://en.wikipedia.org/api/rest_v1';

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/page/summary/Test`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    try {
      // Search Wikipedia
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${options.limit || 5}`;
      const searchResponse = await axios.get(searchUrl);
      const searchResults = searchResponse.data.query?.search || [];

      const results: KnowledgeResult[] = [];

      for (const item of searchResults) {
        try {
          // Get page summary
          const summaryUrl = `${this.baseUrl}/page/summary/${encodeURIComponent(item.title)}`;
          const summaryResponse = await axios.get(summaryUrl);
          const summary = summaryResponse.data;

          results.push({
            id: `wiki_${item.pageid}`,
            title: summary.title,
            content: summary.extract || summary.description || '',
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
      const response = await axios.get(url);
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
}

