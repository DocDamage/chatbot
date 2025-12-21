/**
 * Library of Congress Source - Access LOC digital collections
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class LibraryOfCongressSource implements KnowledgeSource {
  name = 'library_of_congress';
  private baseUrl = 'https://www.loc.gov';
  private apiUrl = 'https://www.loc.gov/search';

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number; format?: string; dateRange?: string } = {}): Promise<KnowledgeResult[]> {
    try {
      const { limit = 10, format, dateRange } = options;
      
      // Library of Congress search API
      let url = `${this.apiUrl}/?q=${encodeURIComponent(query)}&fo=json&c=${limit}`;
      
      if (format) {
        url += `&fa=format:${format}`;
      }
      if (dateRange) {
        url += `&dates=${dateRange}`;
      }

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'KnowledgeBot/1.0',
        },
      });

      const results: KnowledgeResult[] = [];
      const items = response.data.results || [];

      for (const item of items) {
        const title = item.title || item.item?.title || '';
        const description = item.description || item.item?.description || '';
        const url = item.url || item.item?.url || '';
        const date = item.date || item.item?.date || '';
        const subjects = item.subjects || item.item?.subjects || [];

        results.push({
          id: `loc_${url.split('/').pop() || Date.now()}`,
          title,
          content: `${title}\n\n${description}`.substring(0, 3000),
          source: 'library_of_congress',
          url: url.startsWith('http') ? url : `${this.baseUrl}${url}`,
          metadata: {
            date,
            subjects,
            format: item.format || item.item?.format,
            location: 'Library of Congress',
          },
          confidence: 0.95, // LOC is highly authoritative
        });
      }

      return results;
    } catch (error: any) {
      logger.error('Library of Congress search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      const itemId = id.replace('loc_', '');
      const url = `${this.baseUrl}/${itemId}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'KnowledgeBot/1.0',
        },
      });

      // Parse HTML or JSON response
      const title = response.data.title || '';
      const content = response.data.description || response.data.content || '';

      return {
        id,
        title,
        content: content.substring(0, 5000),
        source: 'library_of_congress',
        url,
        metadata: {},
        confidence: 0.95,
      };
    } catch (error: any) {
      logger.warn('Failed to fetch LOC item', { id, error: error.message });
      return null;
    }
  }
}

