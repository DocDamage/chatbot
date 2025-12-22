/**
 * RN Source - Registered Nurse training, nursing practice, resources
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class RNSource implements KnowledgeSource {
  name = 'rn';
  private curatedSources = [
    { name: 'NCSBN', url: 'https://www.ncsbn.org', description: 'National Council of State Boards of Nursing' },
    { name: 'ANA', url: 'https://www.nursingworld.org', description: 'American Nurses Association' },
    { name: 'Nurse.org', url: 'https://nurse.org', description: 'Nursing resources and education' },
    { name: 'Nursing CE Central', url: 'https://www.nursingcecentral.com', description: 'Nursing continuing education' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search Wikipedia
      const wikiQuery = `${query} registered nurse RN nursing`;
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `rn_wiki_${wikiQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'rn' },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia not found
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `rn_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'rn',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('RN search failed', { error: error.message });
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
        return { id, title: wiki.title, content: wiki.extract || '', source: 'wikipedia', url: wiki.content_urls?.desktop?.page, metadata: { topic: 'rn' }, confidence: 0.85 };
      }
      const sourceName = id.replace('rn_', '').replace(/_/g, ' ');
      const matched = this.curatedSources.find(s => s.name.toLowerCase().includes(sourceName.toLowerCase()));
      if (matched) return { id, title: matched.name, content: matched.description, source: 'rn', url: matched.url, metadata: { sourceName: matched.name }, confidence: 0.9 };
      return null;
    } catch (error: any) { logger.warn('Failed to get RN resource', { id, error: error.message }); return null; }
  }
}

