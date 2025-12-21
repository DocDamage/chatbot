/**
 * Quora Source - Fetch Q&A from Quora
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';
import * as cheerio from 'cheerio';

export class QuoraSource implements KnowledgeSource {
  name = 'quora';
  private baseUrl = 'https://www.quora.com';

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/search?q=test`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    try {
      const limit = options.limit || 10;
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)',
        },
      });

      const $ = cheerio.load(response.data);
      const results: KnowledgeResult[] = [];

      // Extract questions and answers
      $('[data-testid="question"], .q-text').slice(0, limit).each((index, element) => {
        const $el = $(element);
        const question = $el.text().trim();
        const link = $el.find('a').first().attr('href') || '';
        const fullUrl = link.startsWith('http') ? link : `${this.baseUrl}${link}`;

        if (question) {
          // Try to get answer preview
          const answerPreview = $el.siblings('.answer').first().text().trim() || 
                               $el.closest('.q-box').find('.answer').first().text().trim();

          results.push({
            id: `quora_${link.split('/').pop() || index}`,
            title: question,
            content: `${question}\n\n${answerPreview}`.substring(0, 2000),
            source: 'quora',
            url: fullUrl,
            metadata: {},
            confidence: 0.7,
          });
        }
      });

      return results;
    } catch (error: any) {
      logger.error('Quora search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      const questionId = id.replace('quora_', '');
      const url = `${this.baseUrl}/${questionId}`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)',
        },
      });

      const $ = cheerio.load(response.data);
      const question = $('[data-testid="question-title"], h1').first().text().trim();
      const answers = $('.answer, [data-testid="answer"]').map((_, el) => $(el).text().trim()).get();
      const content = `${question}\n\n${answers.join('\n\n---\n\n')}`.substring(0, 5000);

      return {
        id,
        title: question,
        content,
        source: 'quora',
        url,
        metadata: {
          answerCount: answers.length,
        },
        confidence: 0.8,
      };
    } catch (error: any) {
      logger.warn('Failed to fetch Quora question', { id, error: error.message });
      return null;
    }
  }
}

