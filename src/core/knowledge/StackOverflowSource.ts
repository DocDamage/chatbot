/**
 * Stack Overflow Knowledge Source - Fetch Q&A from Stack Overflow
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class StackOverflowSource implements KnowledgeSource {
  name = 'stackoverflow';
  private baseUrl = 'https://api.stackexchange.com/2.3';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.STACKOVERFLOW_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/questions?order=desc&sort=activity&site=stackoverflow&pagesize=1`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number; tagged?: string[]; sort?: 'relevance' | 'activity' | 'votes' | 'creation' } = {}): Promise<KnowledgeResult[]> {
    try {
      const { limit = 10, tagged, sort = 'relevance' } = options;
      
      let url = `${this.baseUrl}/search/advanced?q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=${limit}&sort=${sort}&order=desc`;
      
      if (tagged && tagged.length > 0) {
        url += `&tagged=${tagged.join(';')}`;
      }

      if (this.apiKey) {
        url += `&key=${this.apiKey}`;
      }

      const response = await axios.get(url);
      const questions = response.data.items || [];

      const results: KnowledgeResult[] = [];

      for (const question of questions) {
        // Fetch accepted answer if available
        let answerContent = '';
        if (question.accepted_answer_id) {
          try {
            const answerUrl = `${this.baseUrl}/answers/${question.accepted_answer_id}?site=stackoverflow&filter=withbody${this.apiKey ? `&key=${this.apiKey}` : ''}`;
            const answerResponse = await axios.get(answerUrl);
            const answer = answerResponse.data.items?.[0];
            if (answer) {
              answerContent = this.stripHtml(answer.body);
            }
          } catch (error: any) {
            logger.warn('Failed to fetch answer', { questionId: question.question_id, error: error.message });
          }
        }

        const content = `${this.stripHtml(question.body || '')}\n\n${answerContent}`.substring(0, 3000);

        results.push({
          id: `stackoverflow_${question.question_id}`,
          title: question.title,
          content,
          source: 'stackoverflow',
          url: question.link,
          metadata: {
            questionId: question.question_id,
            tags: question.tags || [],
            score: question.score,
            viewCount: question.view_count,
            answerCount: question.answer_count,
            isAnswered: question.is_answered,
            acceptedAnswerId: question.accepted_answer_id,
            created: new Date(question.creation_date * 1000).toISOString(),
          },
          confidence: this.calculateConfidence(question),
        });
      }

      return results;
    } catch (error: any) {
      logger.error('Stack Overflow search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      const questionId = id.replace('stackoverflow_', '');
      const url = `${this.baseUrl}/questions/${questionId}?site=stackoverflow&filter=withbody${this.apiKey ? `&key=${this.apiKey}` : ''}`;
      const response = await axios.get(url);
      const question = response.data.items?.[0];
      
      if (!question) return null;

      let answerContent = '';
      if (question.accepted_answer_id) {
        try {
          const answerUrl = `${this.baseUrl}/answers/${question.accepted_answer_id}?site=stackoverflow&filter=withbody${this.apiKey ? `&key=${this.apiKey}` : ''}`;
          const answerResponse = await axios.get(answerUrl);
          const answer = answerResponse.data.items?.[0];
          if (answer) {
            answerContent = `\n\nAccepted Answer:\n${this.stripHtml(answer.body)}`;
          }
        } catch (error: any) {
          // Ignore answer fetch errors
        }
      }

      return {
        id,
        title: question.title,
        content: `${this.stripHtml(question.body || '')}${answerContent}`.substring(0, 5000),
        source: 'stackoverflow',
        url: question.link,
        metadata: {
          questionId: question.question_id,
          tags: question.tags || [],
          score: question.score,
          viewCount: question.view_count,
        },
        confidence: this.calculateConfidence(question),
      };
    } catch (error: any) {
      logger.warn('Failed to fetch Stack Overflow question', { id, error: error.message });
      return null;
    }
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Calculate confidence based on question quality
   */
  private calculateConfidence(question: any): number {
    let confidence = 0.5;

    // Higher score = more reliable
    if (question.score > 10) confidence += 0.2;
    else if (question.score > 0) confidence += 0.1;

    // Has accepted answer = more reliable
    if (question.is_answered) confidence += 0.2;

    // More views = more popular/relevant
    if (question.view_count > 1000) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }
}

