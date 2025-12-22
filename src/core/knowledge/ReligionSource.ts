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
    try {
      if (id.includes('_wiki_')) {
        const query = id.split('_wiki_')[1].replace(/_/g, ' ');
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const response = await axios.get(wikiUrl, { timeout: 5000 });
        const wiki = response.data;
        return { id, title: wiki.title, content: wiki.extract || '', source: 'wikipedia', url: wiki.content_urls?.desktop?.page, metadata: { topic: 'religion' }, confidence: 0.85 };
      }
      const sourceName = id.replace('religion_', '').replace(/_/g, ' ');
      const matched = this.curatedSources.find(s => s.name.toLowerCase().includes(sourceName.toLowerCase()));
      if (matched) return { id, title: matched.name, content: matched.description, source: 'religion', url: matched.url, metadata: { sourceName: matched.name }, confidence: 0.9 };
      return null;
    } catch (error: any) { logger.warn('Failed to get religion resource', { id, error: error.message }); return null; }
  }
}

