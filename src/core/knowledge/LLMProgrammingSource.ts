/**
 * LLM Programming Source - Large Language Model programming, training, fine-tuning
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class LLMProgrammingSource implements KnowledgeSource {
  name = 'llm_programming';
  private curatedSources = [
    { name: 'Hugging Face Transformers', url: 'https://huggingface.co/docs/transformers', description: 'Transformers library documentation' },
    { name: 'OpenAI API Docs', url: 'https://platform.openai.com/docs', description: 'OpenAI API documentation' },
    { name: 'LangChain', url: 'https://python.langchain.com', description: 'LLM application framework' },
    { name: 'Anthropic Claude Docs', url: 'https://docs.anthropic.com', description: 'Claude API documentation' },
    { name: 'LLM Fine-tuning Guide', url: 'https://huggingface.co/docs/transformers/training', description: 'LLM fine-tuning resources' },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10 } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search GitHub for LLM repositories
      try {
        if (process.env.GITHUB_TOKEN) {
          const githubUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+language:python+llm&sort=stars`;
          const githubResponse = await axios.get(githubUrl, {
            headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
          });
          const repos = githubResponse.data.items || [];

          for (const repo of repos.slice(0, 3)) {
            results.push({
              id: `llm_github_${repo.id}`,
              title: repo.name,
              content: repo.description || '',
              source: 'github',
              url: repo.html_url,
              metadata: { topic: 'llm_programming', stars: repo.stargazers_count },
              confidence: 0.85,
            });
          }
        }
      } catch {
        // GitHub search failed
      }

      // Add curated sources
      for (const source of this.curatedSources.slice(0, limit - results.length)) {
        results.push({
          id: `llm_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: `${source.description}. Visit ${source.url} for information about "${query}".`,
          source: 'llm_programming',
          url: source.url,
          metadata: { sourceName: source.name },
          confidence: 0.9,
        });
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('LLM programming search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      if (id.includes('_github_')) {
        const repoId = id.split('_github_')[1];
        if (process.env.GITHUB_TOKEN) {
          const url = `https://api.github.com/repositories/${repoId}`;
          const response = await axios.get(url, { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } });
          const repo = response.data;
          return { id, title: repo.full_name, content: repo.description || '', source: 'github', url: repo.html_url, metadata: { topic: 'llm_programming', stars: repo.stargazers_count }, confidence: 0.85 };
        }
      }
      const sourceName = id.replace('llm_', '').replace(/_/g, ' ');
      const matched = this.curatedSources.find(s => s.name.toLowerCase().includes(sourceName.toLowerCase()));
      if (matched) return { id, title: matched.name, content: matched.description, source: 'llm_programming', url: matched.url, metadata: { sourceName: matched.name }, confidence: 0.9 };
      return null;
    } catch (error: any) { logger.warn('Failed to get LLM resource', { id, error: error.message }); return null; }
  }
}

