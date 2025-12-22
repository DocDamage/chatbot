/**
 * Pottery Source - Pottery techniques, ceramics, clay work
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class PotterySource implements KnowledgeSource {
  name = 'pottery';
  private curatedSources = [
    { name: 'Ceramic Arts Network', url: 'https://ceramicartsnetwork.org', description: 'Pottery and ceramics resources' },
    { name: 'The Pottery Wheel', url: 'https://thepotterywheel.com', description: 'Pottery techniques and tutorials' },
    { name: 'Digital Fire', url: 'https://digitalfire.com', description: 'Ceramic chemistry and glazes' },
    { name: 'Pottery Making Info', url: 'https://potterymakinginfo.com', description: 'Pottery making guides' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search Wikipedia
      const wikiQuery = `${query} pottery ceramics`;
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `pottery_wiki_${wikiQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'pottery' },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia not found
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `pottery_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'pottery',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Pottery search failed', { error: error.message });
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
        return { id, title: wiki.title, content: wiki.extract || '', source: 'wikipedia', url: wiki.content_urls?.desktop?.page, metadata: { topic: 'pottery' }, confidence: 0.85 };
      }
      const sourceName = id.replace('pottery_', '').replace(/_/g, ' ');
      const matched = this.curatedSources.find(s => s.name.toLowerCase().includes(sourceName.toLowerCase()));
      if (matched) return { id, title: matched.name, content: matched.description, source: 'pottery', url: matched.url, metadata: { sourceName: matched.name }, confidence: 0.9 };
      return null;
    } catch (error: any) { logger.warn('Failed to get pottery resource', { id, error: error.message }); return null; }
  }
}

