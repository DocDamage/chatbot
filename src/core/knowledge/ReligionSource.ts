/**
 * Religion Source - Information about religions, religious texts, practices
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class ReligionSource implements KnowledgeSource {
  name = 'religion';
  private curatedSources = [
    { name: 'Library of Congress - Religion', url: 'https://www.loc.gov/collections/religion', description: 'Religious collections' },
    { name: 'Project Gutenberg - Religious Texts', url: 'https://www.gutenberg.org/ebooks/search/?query=religion', description: 'Free religious texts' },
    { name: 'Internet Sacred Text Archive', url: 'https://www.sacred-texts.com', description: 'Sacred texts from world religions' },
    { name: 'Harvard Divinity School', url: 'https://hds.harvard.edu', description: 'Religious studies resources' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number; religion?: string } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10, religion } = options;
    const results: KnowledgeResult[] = [];

    try {
      let searchQuery = query;
      if (religion) {
        searchQuery = `${religion} ${query}`;
      }

      // Search Wikipedia
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchQuery)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `religion_wiki_${searchQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'religion', religion },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia not found
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `religion_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'religion',
          url: source.url,
          metadata: { sourceName: source.name, religion },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Religion search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    return null;
  }
}

