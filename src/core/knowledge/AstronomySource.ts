/**
 * Astronomy Source - Astronomy, space science, celestial objects
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class AstronomySource implements KnowledgeSource {
  name = 'astronomy';
  private curatedSources = [
    { name: 'NASA', url: 'https://www.nasa.gov', description: 'NASA astronomy and space science' },
    { name: 'ESA', url: 'https://www.esa.int', description: 'European Space Agency' },
    { name: 'Hubble Space Telescope', url: 'https://hubblesite.org', description: 'Hubble telescope images and data' },
    { name: 'Astronomy.com', url: 'https://www.astronomy.com', description: 'Astronomy news and resources' },
    { name: 'Sky & Telescope', url: 'https://skyandtelescope.org', description: 'Astronomy magazine and resources' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search Wikipedia
      const wikiQuery = `${query} astronomy`;
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `astronomy_wiki_${wikiQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'astronomy' },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia not found
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `astronomy_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'astronomy',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Astronomy search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    return null;
  }
}

