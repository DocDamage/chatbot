/**
 * CNA Source - Certified Nursing Assistant training, skills, resources
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class CNASource implements KnowledgeSource {
  name = 'cna';
  private curatedSources = [
    { name: 'NNAAP CNA Exam', url: 'https://www.ncsbn.org/nnaap.htm', description: 'CNA certification exam information' },
    { name: 'CNA Training Help', url: 'https://www.cnatraininghelp.com', description: 'CNA training resources' },
    { name: 'Red Cross CNA', url: 'https://www.redcross.org/take-a-class/cna', description: 'Red Cross CNA training' },
    { name: 'CNA Plus', url: 'https://www.cna.plus', description: 'CNA skills and training' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search Wikipedia
      const wikiQuery = `${query} certified nursing assistant CNA`;
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `cna_wiki_${wikiQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'cna' },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia not found
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `cna_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'cna',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('CNA search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    return null;
  }
}

