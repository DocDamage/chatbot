/**
 * Web Design Source - Web design principles, best practices, resources
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class WebDesignSource implements KnowledgeSource {
  name = 'web_design';
  private curatedSources = [
    { name: 'MDN Web Design', url: 'https://developer.mozilla.org/en-US/docs/Learn/CSS', description: 'Web design and CSS' },
    { name: 'Web.dev', url: 'https://web.dev', description: 'Web design best practices' },
    { name: 'A List Apart', url: 'https://alistapart.com', description: 'Web design articles' },
    { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com', description: 'Web design resources' },
    { name: 'CSS-Tricks', url: 'https://css-tricks.com', description: 'CSS and web design tutorials' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search MDN
      try {
        const mdnUrl = `https://developer.mozilla.org/api/v1/search?q=${encodeURIComponent(query)}&locale=en-US`;
        const mdnResponse = await axios.get(mdnUrl);
        const mdnDocs = mdnResponse.data.documents || [];

        for (const doc of mdnDocs.slice(0, 3)) {
          results.push({
            id: `web_design_mdn_${doc.slug}`,
            title: doc.title,
            content: doc.summary || '',
            source: 'mdn',
            url: `https://developer.mozilla.org${doc.mdn_url}`,
            metadata: { topic: 'web_design' },
            confidence: 0.95,
          });
        }
      } catch {
        // MDN search failed
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `web_design_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'web_design',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Web design search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      if (id.includes('_mdn_')) {
        const slug = id.split('_mdn_')[1];
        const url = `https://developer.mozilla.org/api/v1/doc/en-US/docs/${slug}`;
        const response = await axios.get(url, { timeout: 5000 });
        const doc = response.data.doc;
        return { id, title: doc.title, content: doc.summary || '', source: 'mdn', url: `https://developer.mozilla.org/en-US/docs/${slug}`, metadata: { topic: 'web_design' }, confidence: 0.95 };
      }
      const sourceName = id.replace('web_design_', '').replace(/_/g, ' ');
      const matched = this.curatedSources.find(s => s.name.toLowerCase().includes(sourceName.toLowerCase()));
      if (matched) return { id, title: matched.name, content: matched.description, source: 'web_design', url: matched.url, metadata: { sourceName: matched.name }, confidence: 0.9 };
      return null;
    } catch (error: any) { logger.warn('Failed to get web design resource', { id, error: error.message }); return null; }
  }
}

