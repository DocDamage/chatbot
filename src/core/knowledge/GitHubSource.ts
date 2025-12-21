/**
 * GitHub Knowledge Source - Fetch information from GitHub repositories
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class GitHubSource implements KnowledgeSource {
  name = 'github';
  private token?: string;
  private baseUrl = 'https://api.github.com';

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const headers = this.getHeaders();
      await axios.get(`${this.baseUrl}/zen`, { headers, timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number; type?: 'repositories' | 'code' | 'issues' | 'all' } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10, type = 'all' } = options;
    const results: KnowledgeResult[] = [];

    try {
      if (type === 'repositories' || type === 'all') {
        const repos = await this.searchRepositories(query, limit);
        results.push(...repos);
      }

      if (type === 'code' || type === 'all') {
        const code = await this.searchCode(query, limit);
        results.push(...code);
      }

      if (type === 'issues' || type === 'all') {
        const issues = await this.searchIssues(query, limit);
        results.push(...issues);
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('GitHub search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      if (id.startsWith('repo_')) {
        return await this.getRepository(id.replace('repo_', ''));
      } else if (id.startsWith('issue_')) {
        return await this.getIssue(id.replace('issue_', ''));
      } else if (id.startsWith('code_')) {
        return await this.getCodeFile(id.replace('code_', ''));
      }
      return null;
    } catch (error: any) {
      logger.warn('Failed to fetch GitHub resource by ID', { id, error: error.message });
      return null;
    }
  }

  /**
   * Search repositories
   */
  private async searchRepositories(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      const url = `${this.baseUrl}/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}&sort=stars`;
      const response = await axios.get(url, { headers: this.getHeaders() });
      const repos = response.data.items || [];

      return repos.map((repo: any) => ({
        id: `repo_${repo.full_name}`,
        title: repo.full_name,
        content: `${repo.description || ''}\n\nLanguage: ${repo.language || 'N/A'}\nStars: ${repo.stargazers_count}\nForks: ${repo.forks_count}`.substring(0, 2000),
        source: 'github',
        url: repo.html_url,
        metadata: {
          fullName: repo.full_name,
          language: repo.language,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          createdAt: repo.created_at,
          updatedAt: repo.updated_at,
          topics: repo.topics || [],
        },
        confidence: this.calculateRepoConfidence(repo),
      }));
    } catch (error: any) {
      logger.error('GitHub repository search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search code
   */
  private async searchCode(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      const url = `${this.baseUrl}/search/code?q=${encodeURIComponent(query)}&per_page=${limit}`;
      const response = await axios.get(url, { headers: this.getHeaders() });
      const items = response.data.items || [];

      const results: KnowledgeResult[] = [];

      for (const item of items) {
        try {
          // Fetch file content
          const contentUrl = item.git_url.replace('git://', 'https://api.github.com/repos/').replace('.git', '');
          const contentResponse = await axios.get(contentUrl, { headers: this.getHeaders() });
          const content = Buffer.from(contentResponse.data.content, 'base64').toString('utf-8');

          results.push({
            id: `code_${item.repository.full_name}_${item.path}`,
            title: `${item.repository.full_name}/${item.path}`,
            content: content.substring(0, 5000),
            source: 'github',
            url: item.html_url,
            metadata: {
              repository: item.repository.full_name,
              path: item.path,
              language: item.language,
            },
            confidence: 0.8,
          });
        } catch (error: any) {
          logger.warn('Failed to fetch code file content', { path: item.path, error: error.message });
        }
      }

      return results;
    } catch (error: any) {
      logger.error('GitHub code search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search issues
   */
  private async searchIssues(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      const url = `${this.baseUrl}/search/issues?q=${encodeURIComponent(query)}&per_page=${limit}&sort=updated`;
      const response = await axios.get(url, { headers: this.getHeaders() });
      const issues = response.data.items || [];

      return issues.map((issue: any) => ({
        id: `issue_${issue.repository_url.split('/').slice(-2).join('/')}_${issue.number}`,
        title: issue.title,
        content: `${issue.body || ''}`.substring(0, 3000),
        source: 'github',
        url: issue.html_url,
        metadata: {
          repository: issue.repository_url.split('/').slice(-2).join('/'),
          number: issue.number,
          state: issue.state,
          labels: issue.labels?.map((l: any) => l.name) || [],
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
        },
        confidence: issue.state === 'closed' ? 0.9 : 0.7,
      }));
    } catch (error: any) {
      logger.error('GitHub issues search failed', { error: error.message });
      return [];
    }
  }

  private async getRepository(fullName: string): Promise<KnowledgeResult | null> {
    try {
      const url = `${this.baseUrl}/repos/${fullName}`;
      const response = await axios.get(url, { headers: this.getHeaders() });
      const repo = response.data;

      // Get README if available
      let readme = '';
      try {
        const readmeUrl = `${this.baseUrl}/repos/${fullName}/readme`;
        const readmeResponse = await axios.get(readmeUrl, { headers: this.getHeaders() });
        readme = Buffer.from(readmeResponse.data.content, 'base64').toString('utf-8');
      } catch {
        // README not available
      }

      return {
        id: `repo_${fullName}`,
        title: fullName,
        content: `${repo.description || ''}\n\n${readme}`.substring(0, 5000),
        source: 'github',
        url: repo.html_url,
        metadata: {
          fullName: repo.full_name,
          language: repo.language,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
        },
        confidence: this.calculateRepoConfidence(repo),
      };
    } catch (error: any) {
      logger.warn('Failed to fetch GitHub repository', { fullName, error: error.message });
      return null;
    }
  }

  private async getIssue(issueId: string): Promise<KnowledgeResult | null> {
    // Implementation similar to searchIssues but for single issue
    return null;
  }

  private async getCodeFile(fileId: string): Promise<KnowledgeResult | null> {
    // Implementation similar to searchCode but for single file
    return null;
  }

  private calculateRepoConfidence(repo: any): number {
    let confidence = 0.5;

    // More stars = more reliable
    if (repo.stargazers_count > 1000) confidence += 0.2;
    else if (repo.stargazers_count > 100) confidence += 0.1;

    // Active repository
    const updated = new Date(repo.updated_at);
    const daysSinceUpdate = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 30) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    return headers;
  }
}

