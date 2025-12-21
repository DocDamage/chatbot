/**
 * UI Design Source - User interface design principles, patterns, resources
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class UIDesignSource implements KnowledgeSource {
  name = 'ui_design';
  private curatedSources = [
    { name: 'Material Design', url: 'https://material.io/design', description: 'Google Material Design guidelines' },
    { name: 'Apple Human Interface Guidelines', url: 'https://developer.apple.com/design', description: 'Apple UI/UX guidelines' },
    { name: 'Nielsen Norman Group', url: 'https://www.nngroup.com', description: 'UX research and best practices' },
    { name: 'UI Patterns', url: 'https://ui-patterns.com', description: 'UI design patterns library' },
    { name: 'Dribbble', url: 'https://dribbble.com', description: 'UI design inspiration' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search Wikipedia
      const wikiQuery = `${query} user interface design`;
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `ui_design_wiki_${wikiQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'ui_design' },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia not found
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `ui_design_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'ui_design',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('UI design search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    return null;
  }
}

