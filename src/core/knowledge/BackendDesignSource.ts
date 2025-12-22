/**
 * Backend Design Source - Backend architecture, API design, server-side development
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class BackendDesignSource implements KnowledgeSource {
  name = 'backend_design';
  private curatedSources = [
    { name: 'REST API Tutorial', url: 'https://restfulapi.net', description: 'REST API design best practices' },
    { name: 'API Design Guide', url: 'https://cloud.google.com/apis/design', description: 'Google API design guide' },
    { name: 'Microsoft API Guidelines', url: 'https://github.com/microsoft/api-guidelines', description: 'Microsoft API design guidelines' },
    { name: '12 Factor App', url: 'https://12factor.net', description: 'Backend application design principles' },
    { name: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer', description: 'System design resources' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search Stack Overflow for backend topics
      try {
        const soUrl = `https://api.stackexchange.com/2.3/search/advanced?q=${encodeURIComponent(query)}&site=stackoverflow&tagged=backend&sort=votes`;
        const soResponse = await axios.get(soUrl);
        const questions = soResponse.data.items || [];

        for (const question of questions.slice(0, 3)) {
          results.push({
            id: `backend_so_${question.question_id}`,
            title: question.title,
            content: question.body?.substring(0, 500) || '',
            source: 'stackoverflow',
            url: question.link,
            metadata: { topic: 'backend_design' },
            confidence: 0.85,
          });
        }
      } catch {
        // Stack Overflow search failed
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `backend_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'backend_design',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Backend design search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      if (id.includes('_so_')) {
        const questionId = id.split('_so_')[1];
        const url = `https://api.stackexchange.com/2.3/questions/${questionId}?site=stackoverflow&filter=withbody`;
        const response = await axios.get(url);
        const question = response.data.items?.[0];
        if (question) return { id, title: question.title, content: question.body?.substring(0, 3000) || '', source: 'stackoverflow', url: question.link, metadata: { topic: 'backend_design' }, confidence: 0.85 };
      }
      const sourceName = id.replace('backend_', '').replace(/_/g, ' ');
      const matched = this.curatedSources.find(s => s.name.toLowerCase().includes(sourceName.toLowerCase()));
      if (matched) return { id, title: matched.name, content: matched.description, source: 'backend_design', url: matched.url, metadata: { sourceName: matched.name }, confidence: 0.9 };
      return null;
    } catch (error: any) { logger.warn('Failed to get backend resource', { id, error: error.message }); return null; }
  }
}

