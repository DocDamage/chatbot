/**
 * Mental Health Source - Mental health information, resources, support
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class MentalHealthSource implements KnowledgeSource {
  name = 'mental_health';
  private curatedSources = [
    { name: 'NIMH', url: 'https://www.nimh.nih.gov', description: 'National Institute of Mental Health' },
    { name: 'SAMHSA', url: 'https://www.samhsa.gov', description: 'Substance Abuse and Mental Health Services Administration' },
    { name: 'Mental Health America', url: 'https://www.mhanational.org', description: 'Mental health resources and support' },
    { name: 'NAMI', url: 'https://www.nami.org', description: 'National Alliance on Mental Illness' },
    { name: 'CDC Mental Health', url: 'https://www.cdc.gov/mentalhealth', description: 'CDC mental health resources' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search Wikipedia
      const wikiQuery = `${query} mental health`;
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `mental_health_wiki_${wikiQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'mental_health' },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia not found
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `mental_health_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'mental_health',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Mental health search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    return null;
  }
}

