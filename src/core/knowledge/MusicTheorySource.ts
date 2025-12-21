/**
 * Music Theory Source - Music theory, composition, harmony, rhythm
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class MusicTheorySource implements KnowledgeSource {
  name = 'music_theory';
  private curatedSources = [
    { name: 'Music Theory.net', url: 'https://www.musictheory.net', description: 'Free music theory lessons' },
    { name: 'Open Music Theory', url: 'https://viva.pressbooks.pub/openmusictheory', description: 'Open music theory textbook' },
    { name: 'Khan Academy Music', url: 'https://www.khanacademy.org/humanities/music', description: 'Music theory courses' },
    { name: 'MIT Music Theory', url: 'https://ocw.mit.edu/courses/music-and-theater-arts', description: 'MIT music theory courses' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search Wikipedia
      const wikiQuery = `${query} music theory`;
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `music_theory_wiki_${wikiQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'music_theory' },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia not found
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `music_theory_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'music_theory',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Music theory search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    return null;
  }
}

