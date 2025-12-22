/**
 * Anatomy Source - Human anatomy, body systems, medical anatomy
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class AnatomySource implements KnowledgeSource {
  name = 'anatomy';
  private curatedSources = [
    { name: 'Visible Body', url: 'https://www.visiblebody.com', description: '3D anatomy models and resources' },
    { name: 'Kenhub Anatomy', url: 'https://www.kenhub.com', description: 'Anatomy learning platform' },
    { name: 'TeachMeAnatomy', url: 'https://teachmeanatomy.info', description: 'Free anatomy education' },
    { name: 'Gray\'s Anatomy Online', url: 'https://www.bartleby.com/107', description: 'Gray\'s Anatomy textbook' },
    { name: 'PubMed Anatomy', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=anatomy', description: 'Anatomy research papers' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search Wikipedia
      const wikiQuery = `${query} anatomy`;
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `anatomy_wiki_${wikiQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'anatomy' },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia not found
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `anatomy_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'anatomy',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Anatomy search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      // Check if it's a Wikipedia result
      if (id.includes('_wiki_')) {
        const query = id.split('_wiki_')[1].replace(/_/g, ' ');
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const response = await axios.get(wikiUrl, { timeout: 5000 });
        const wiki = response.data;

        return {
          id,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'anatomy' },
          confidence: 0.85
        };
      }

      // Check curated sources
      const sourceName = id.replace('anatomy_', '').replace(/_/g, ' ');
      const matchedSource = this.curatedSources.find(s =>
        s.name.toLowerCase().includes(sourceName.toLowerCase())
      );

      if (matchedSource) {
        return {
          id,
          title: matchedSource.name,
          content: matchedSource.description,
          source: 'anatomy',
          url: matchedSource.url,
          metadata: { sourceName: matchedSource.name },
          confidence: 0.9
        };
      }

      return null;
    } catch (error: any) {
      logger.warn('Failed to get anatomy resource', { id, error: error.message });
      return null;
    }
  }
}

