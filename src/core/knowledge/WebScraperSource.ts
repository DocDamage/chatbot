/**
 * Web Scraper Knowledge Source - Extract knowledge from web pages
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';
import * as cheerio from 'cheerio';

export class WebScraperSource implements KnowledgeSource {
  name = 'web_scraper';
  private allowedDomains: string[] = [];
  private maxDepth: number = 1;

  constructor(allowedDomains: string[] = [], maxDepth: number = 1) {
    this.allowedDomains = allowedDomains;
    this.maxDepth = maxDepth;
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }

  async search(query: string, options: { urls?: string[]; limit?: number } = {}): Promise<KnowledgeResult[]> {
    const results: KnowledgeResult[] = [];

    // If URLs provided, scrape them
    if (options.urls && options.urls.length > 0) {
      for (const url of options.urls.slice(0, options.limit || 5)) {
        try {
          const result = await this.scrapeUrl(url);
          if (result) {
            results.push(result);
          }
        } catch (error: any) {
          logger.warn('Failed to scrape URL', { url, error: error.message });
        }
      }
    }

    return results;
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    // ID is the URL
    return this.scrapeUrl(id);
  }

  private async scrapeUrl(url: string): Promise<KnowledgeResult | null> {
    try {
      // Check domain if restrictions exist
      if (this.allowedDomains.length > 0) {
        const urlObj = new URL(url);
        if (!this.allowedDomains.some(domain => urlObj.hostname.includes(domain))) {
          logger.warn('URL not in allowed domains', { url, allowedDomains: this.allowedDomains });
          return null;
        }
      }

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)',
        },
      });

      const $ = cheerio.load(response.data);

      // Extract main content
      const title = $('title').text() || $('h1').first().text() || '';
      const content = $('article, main, .content, #content, .post, .entry')
        .first()
        .text()
        .trim() || $('body').text().trim();

      // Clean content
      const cleanedContent = content
        .replace(/\s+/g, ' ')
        .substring(0, 5000); // Limit to 5000 chars

      return {
        id: url,
        title: title.substring(0, 200),
        content: cleanedContent,
        source: 'web_scraper',
        url,
        metadata: {
          contentLength: cleanedContent.length,
          scrapedAt: new Date().toISOString(),
        },
        confidence: 0.7,
      };
    } catch (error: any) {
      logger.error('Web scraping failed', { url, error: error.message });
      return null;
    }
  }
}

