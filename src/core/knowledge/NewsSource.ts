/**
 * News Source - Fetch news articles from various news APIs
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export type NewsProvider = 'newsapi' | 'guardian' | 'nytimes' | 'all';

export class NewsSource implements KnowledgeSource {
  name = 'news';
  private provider: NewsProvider;
  private newsApiKey?: string;
  private guardianApiKey?: string;
  private nytimesApiKey?: string;

  constructor(
    provider: NewsProvider = 'all',
    newsApiKey?: string,
    guardianApiKey?: string,
    nytimesApiKey?: string
  ) {
    this.provider = provider;
    this.newsApiKey = newsApiKey || process.env.NEWS_API_KEY;
    this.guardianApiKey = guardianApiKey || process.env.GUARDIAN_API_KEY;
    this.nytimesApiKey = nytimesApiKey || process.env.NYTIMES_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    // Check if at least one provider is available
    if (this.provider === 'newsapi' && this.newsApiKey) return true;
    if (this.provider === 'guardian' && this.guardianApiKey) return true;
    if (this.provider === 'nytimes' && this.nytimesApiKey) return true;
    if (this.provider === 'all') {
      return !!(this.newsApiKey || this.guardianApiKey || this.nytimesApiKey);
    }
    return false;
  }

  async search(query: string, options: { limit?: number; provider?: NewsProvider; language?: string } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10, provider = this.provider, language = 'en' } = options;
    const results: KnowledgeResult[] = [];

    try {
      if (provider === 'newsapi' || provider === 'all') {
        if (this.newsApiKey) {
          const newsApiResults = await this.searchNewsAPI(query, limit, language);
          results.push(...newsApiResults);
        }
      }

      if (provider === 'guardian' || provider === 'all') {
        if (this.guardianApiKey) {
          const guardianResults = await this.searchGuardian(query, limit);
          results.push(...guardianResults);
        }
      }

      if (provider === 'nytimes' || provider === 'all') {
        if (this.nytimesApiKey) {
          const nytimesResults = await this.searchNYTimes(query, limit);
          results.push(...nytimesResults);
        }
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('News search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      if (id.startsWith('newsapi_')) {
        // NewsAPI doesn't support fetching by ID, so search with URL fragment
        const urlFragment = id.replace('newsapi_', '');
        const results = await this.search(urlFragment, { limit: 1, provider: 'newsapi' });
        return results.find(r => r.id === id) || results[0] || null;
      }

      if (id.startsWith('guardian_')) {
        if (!this.guardianApiKey) return null;
        const articleId = id.replace('guardian_', '');
        const url = `https://content.guardianapis.com/${articleId}?api-key=${this.guardianApiKey}&show-fields=body,trailText`;
        const response = await axios.get(url);
        const article = response.data.response?.content;

        if (!article) return null;

        return {
          id,
          title: article.webTitle || '',
          content: `${article.fields?.trailText || ''}\n\n${article.fields?.body || ''}`.substring(0, 5000),
          source: 'guardian',
          url: article.webUrl,
          metadata: {
            section: article.sectionName,
            publishedAt: article.webPublicationDate
          },
          confidence: 0.85
        };
      }

      if (id.startsWith('nytimes_')) {
        // NYTimes doesn't have a direct article fetch API, use search
        const articleId = id.replace('nytimes_', '');
        const url = `https://api.nytimes.com/svc/search/v2/articlesearch.json?fq=_id:("${articleId}")&api-key=${this.nytimesApiKey}`;
        const response = await axios.get(url);
        const article = response.data.response?.docs?.[0];

        if (!article) return null;

        return {
          id,
          title: article.headline?.main || '',
          content: `${article.abstract || ''}\n\n${article.lead_paragraph || ''}`.substring(0, 5000),
          source: 'nytimes',
          url: article.web_url,
          metadata: {
            section: article.section_name,
            publishedAt: article.pub_date,
            byline: article.byline?.original
          },
          confidence: 0.9
        };
      }

      return null;
    } catch (error: any) {
      logger.warn('Failed to fetch news article by ID', { id, error: error.message });
      return null;
    }
  }

  /**
   * Search NewsAPI
   */
  private async searchNewsAPI(query: string, limit: number, language: string): Promise<KnowledgeResult[]> {
    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${this.newsApiKey}&pageSize=${limit}&language=${language}&sortBy=relevancy`;
      const response = await axios.get(url);
      const articles = response.data.articles || [];

      return articles.map((article: any) => ({
        id: `newsapi_${article.url?.split('/').pop() || Date.now()}`,
        title: article.title || '',
        content: `${article.description || ''}\n\n${article.content || ''}`.substring(0, 3000),
        source: 'newsapi',
        url: article.url,
        metadata: {
          author: article.author,
          publishedAt: article.publishedAt,
          source: article.source?.name,
        },
        confidence: 0.8,
      }));
    } catch (error: any) {
      logger.error('NewsAPI search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search The Guardian
   */
  private async searchGuardian(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      const url = `https://content.guardianapis.com/search?q=${encodeURIComponent(query)}&api-key=${this.guardianApiKey}&page-size=${limit}&show-fields=body,trailText`;
      const response = await axios.get(url);
      const articles = response.data.response?.results || [];

      return articles.map((article: any) => ({
        id: `guardian_${article.id}`,
        title: article.webTitle || '',
        content: `${article.fields?.trailText || ''}\n\n${article.fields?.body || ''}`.substring(0, 3000),
        source: 'guardian',
        url: article.webUrl,
        metadata: {
          section: article.sectionName,
          publishedAt: article.webPublicationDate,
        },
        confidence: 0.85,
      }));
    } catch (error: any) {
      logger.error('Guardian search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search NY Times
   */
  private async searchNYTimes(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      const url = `https://api.nytimes.com/svc/search/v2/articlesearch.json?q=${encodeURIComponent(query)}&api-key=${this.nytimesApiKey}&page=0`;
      const response = await axios.get(url);
      const articles = response.data.response?.docs || [];

      return articles.slice(0, limit).map((article: any) => ({
        id: `nytimes_${article._id}`,
        title: article.headline?.main || '',
        content: `${article.abstract || ''}\n\n${article.lead_paragraph || ''}`.substring(0, 3000),
        source: 'nytimes',
        url: article.web_url,
        metadata: {
          section: article.section_name,
          publishedAt: article.pub_date,
          byline: article.byline?.original,
        },
        confidence: 0.9,
      }));
    } catch (error: any) {
      logger.error('NY Times search failed', { error: error.message });
      return [];
    }
  }
}

