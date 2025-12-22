/**
 * Astrology Source - Astrology, horoscopes, zodiac signs
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class AstrologySource implements KnowledgeSource {
  name = 'astrology';
  private curatedSources = [
    { name: 'Astro.com', url: 'https://www.astro.com', description: 'Astrology charts and resources' },
    { name: 'Cafe Astrology', url: 'https://cafeastrology.com', description: 'Astrology information and charts' },
    { name: 'Astrology.com', url: 'https://www.astrology.com', description: 'Astrology and horoscopes' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search Wikipedia
      const wikiQuery = `${query} astrology`;
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `astrology_wiki_${wikiQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'astrology' },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia not found
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `astrology_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'astrology',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Astrology search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      if (id.includes('_wiki_')) {
        const query = id.split('_wiki_')[1].replace(/_/g, ' ');
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const response = await axios.get(wikiUrl, { timeout: 5000 });
        const wiki = response.data;
        return {
          id, title: wiki.title, content: wiki.extract || '',
          source: 'wikipedia', url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'astrology' }, confidence: 0.85
        };
      }
      const sourceName = id.replace('astrology_', '').replace(/_/g, ' ');
      const matched = this.curatedSources.find(s => s.name.toLowerCase().includes(sourceName.toLowerCase()));
      if (matched) {
        return {
          id, title: matched.name, content: matched.description,
          source: 'astrology', url: matched.url,
          metadata: { sourceName: matched.name }, confidence: 0.9
        };
      }
      return null;
    } catch (error: any) {
      logger.warn('Failed to get astrology resource', { id, error: error.message });
      return null;
    }
  }
}

