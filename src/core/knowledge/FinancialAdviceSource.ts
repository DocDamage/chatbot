/**
 * Financial Advice Source - Personal finance, investing, budgeting
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class FinancialAdviceSource implements KnowledgeSource {
  name = 'financial_advice';
  private curatedSources = [
    { name: 'SEC Investor Education', url: 'https://www.investor.gov', description: 'SEC investor education resources' },
    { name: 'FINRA Investor Education', url: 'https://www.finra.org/investors', description: 'FINRA investor education' },
    { name: 'CFPB Financial Education', url: 'https://www.consumerfinance.gov/consumer-tools', description: 'Consumer financial protection' },
    { name: 'Investopedia', url: 'https://www.investopedia.com', description: 'Financial education and investing' },
    { name: 'Khan Academy Finance', url: 'https://www.khanacademy.org/college-careers-more/personal-finance', description: 'Free finance courses' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search Wikipedia for financial topics
      const wikiQuery = `${query} personal finance investing`;
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `financial_wiki_${wikiQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic: 'financial_advice' },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia not found, continue
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `financial_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for comprehensive information about "${query}".`,
          source: 'financial_advice',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Financial advice search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    return null;
  }

  getCuratedSources() {
    return this.curatedSources;
  }
}

