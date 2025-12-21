/**
 * Medium Source - Fetch articles from Medium
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';
import * as cheerio from 'cheerio';

export class MediumSource implements KnowledgeSource {
  name = 'medium';
  private baseUrl = 'https://medium.com';

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/search?q=test`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number; tag?: string } = {}): Promise<KnowledgeResult[]> {
    try {
      const { limit = 10, tag } = options;
      
      // Medium search URL
      let searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
      if (tag) {
        searchUrl += `&tag=${encodeURIComponent(tag)}`;
      }

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)',
        },
      });

      const $ = cheerio.load(response.data);
      const results: KnowledgeResult[] = [];

      // Extract articles from Medium's JSON-LD or HTML structure
      // Note: Medium's structure may change, this is a basic implementation
      $('article, [data-post-id]').slice(0, limit).each((index, element) => {
        const $el = $(element);
        const title = $el.find('h2, h3, [data-testid="post-title"]').first().text().trim();
        const excerpt = $el.find('p, [data-testid="post-excerpt"]').first().text().trim();
        const link = $el.find('a').first().attr('href') || '';
        const fullUrl = link.startsWith('http') ? link : `${this.baseUrl}${link}`;

        if (title && excerpt) {
          results.push({
            id: `medium_${link.split('/').pop() || index}`,
            title,
            content: excerpt.substring(0, 2000),
            source: 'medium',
            url: fullUrl,
            metadata: {
              tag: tag || '',
            },
            confidence: 0.7,
          });
        }
      });

      // If HTML parsing fails, try RSS feed approach
      if (results.length === 0) {
        try {
          const rssUrl = `${this.baseUrl}/feed/tag/${encodeURIComponent(tag || query)}`;
          const rssResponse = await axios.get(rssUrl, {
            headers: {
              'Accept': 'application/rss+xml',
            },
          });

          const parser = require('xml2js');
          const parsed = await parser.parseStringPromise(rssResponse.data);
          const items = parsed.rss?.channel?.[0]?.item || [];

          for (const item of items.slice(0, limit)) {
            const title = item.title?.[0] || '';
            const description = item.description?.[0] || '';
            const link = item.link?.[0] || '';

            results.push({
              id: `medium_${link.split('/').pop()}`,
              title,
              content: description.substring(0, 2000),
              source: 'medium',
              url: link,
              metadata: {},
              confidence: 0.7,
            });
          }
        } catch (error: any) {
          logger.warn('Medium RSS parsing failed', { error: error.message });
        }
      }

      return results;
    } catch (error: any) {
      logger.error('Medium search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      const articleId = id.replace('medium_', '');
      const url = `${this.baseUrl}/${articleId}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)',
        },
      });

      const $ = cheerio.load(response.data);
      const title = $('h1, [data-testid="post-title"]').first().text().trim();
      const content = $('article p, [data-testid="post-content"] p').map((_, el) => $(el).text()).get().join('\n\n').substring(0, 5000);

      return {
        id,
        title,
        content,
        source: 'medium',
        url,
        metadata: {},
        confidence: 0.8,
      };
    } catch (error: any) {
      logger.warn('Failed to fetch Medium article', { id, error: error.message });
      return null;
    }
  }
}

