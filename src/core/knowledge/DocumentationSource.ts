/**
 * Documentation Source - Fetch from technical documentation sites
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';
import * as cheerio from 'cheerio';

export type DocSite = 'mdn' | 'devdocs' | 'python' | 'node' | 'react' | 'vue' | 'all';

export class DocumentationSource implements KnowledgeSource {
  name = 'documentation';
  private site: DocSite;
  private baseUrls: Record<DocSite, string> = {
    mdn: 'https://developer.mozilla.org',
    devdocs: 'https://devdocs.io',
    python: 'https://docs.python.org',
    node: 'https://nodejs.org/docs',
    react: 'https://react.dev',
    vue: 'https://vuejs.org',
    all: '',
  };

  constructor(site: DocSite = 'all') {
    this.site = site;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const testUrl = this.site === 'all' ? 'https://developer.mozilla.org' : this.baseUrls[this.site];
      await axios.get(testUrl, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number; site?: DocSite } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10, site = this.site } = options;
    const results: KnowledgeResult[] = [];

    try {
      if (site === 'mdn' || site === 'all') {
        const mdnResults = await this.searchMDN(query, limit);
        results.push(...mdnResults);
      }

      if (site === 'python' || site === 'all') {
        const pythonResults = await this.searchPythonDocs(query, limit);
        results.push(...pythonResults);
      }

      if (site === 'node' || site === 'all') {
        const nodeResults = await this.searchNodeDocs(query, limit);
        results.push(...nodeResults);
      }

      if (site === 'react' || site === 'all') {
        const reactResults = await this.searchReactDocs(query, limit);
        results.push(...reactResults);
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Documentation search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      const [site, ...rest] = id.split('_');
      const docId = rest.join('_');
      const url = `${this.baseUrls[site as DocSite]}/${docId}`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)',
        },
      });

      const $ = cheerio.load(response.data);
      const title = $('h1, title').first().text().trim();
      const content = $('article, main, .content').first().text().trim().substring(0, 5000);

      return {
        id,
        title,
        content,
        source: `docs_${site}`,
        url,
        metadata: {
          site,
        },
        confidence: 0.9, // Documentation is highly reliable
      };
    } catch (error: any) {
      logger.warn('Failed to fetch documentation', { id, error: error.message });
      return null;
    }
  }

  /**
   * Search MDN (Mozilla Developer Network)
   */
  private async searchMDN(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      // MDN has a search API
      const url = `https://developer.mozilla.org/api/v1/search?q=${encodeURIComponent(query)}&locale=en-US`;
      const response = await axios.get(url);
      const documents = response.data.documents || [];

      return documents.slice(0, limit).map((doc: any) => ({
        id: `mdn_${doc.slug}`,
        title: doc.title,
        content: doc.summary || '',
        source: 'mdn',
        url: `https://developer.mozilla.org${doc.mdn_url}`,
        metadata: {
          locale: doc.locale,
          popularity: doc.popularity,
        },
        confidence: 0.95, // MDN is highly reliable
      }));
    } catch (error: any) {
      logger.error('MDN search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search Python documentation
   */
  private async searchPythonDocs(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      const url = `https://docs.python.org/3/search.html?q=${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)',
        },
      });

      const $ = cheerio.load(response.data);
      const results: KnowledgeResult[] = [];

      $('.search-results li').slice(0, limit).each((_, element) => {
        const $el = $(element);
        const title = $el.find('a').first().text().trim();
        const link = $el.find('a').first().attr('href') || '';
        const summary = $el.text().trim();

        if (title) {
          results.push({
            id: `python_${link.replace(/[^a-zA-Z0-9]/g, '_')}`,
            title,
            content: summary.substring(0, 2000),
            source: 'python_docs',
            url: link.startsWith('http') ? link : `https://docs.python.org/3/${link}`,
            metadata: {},
            confidence: 0.95,
          });
        }
      });

      return results;
    } catch (error: any) {
      logger.error('Python docs search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search Node.js documentation
   */
  private async searchNodeDocs(query: string, limit: number): Promise<KnowledgeResult[]> {
    // Similar implementation to Python docs
    return [];
  }

  /**
   * Search React documentation
   */
  private async searchReactDocs(query: string, limit: number): Promise<KnowledgeResult[]> {
    // Similar implementation
    return [];
  }
}

