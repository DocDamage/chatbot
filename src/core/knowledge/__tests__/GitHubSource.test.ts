import { describe, expect, it, jest } from '@jest/globals';
import { GitHubSource } from '../GitHubSource';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RT-KNOW-001: GitHubSource Knowledge Ingestion Suite', () => {
  it('checks availability and executes repository, code, and issue searches', async () => {
    (mockedAxios.get as any).mockImplementation(async (url: string) => {
      if (url.includes('/zen')) {
        return { data: 'Design for failure.' };
      }
      if (url.includes('/search/repositories')) {
        return {
          data: {
            items: [
              {
                id: 123,
                name: 'chatbot',
                full_name: 'DocDamage/chatbot',
                description: 'Autonomous AI coding chatbot',
                html_url: 'https://github.com/DocDamage/chatbot',
                stargazers_count: 500,
                forks_count: 50,
                language: 'TypeScript',
                topics: ['ai', 'agent'],
                updated_at: '2026-08-25T00:00:00Z'
              }
            ]
          }
        };
      }
      if (url.includes('/search/code')) {
        return {
          data: {
            items: [
              {
                path: 'src/index.ts',
                git_url: 'git://api.github.com/repos/DocDamage/chatbot/git/blobs/123.git',
                html_url: 'https://github.com/DocDamage/chatbot/blob/main/src/index.ts',
                repository: { full_name: 'DocDamage/chatbot' },
                language: 'TypeScript'
              }
            ]
          }
        };
      }
      if (url.includes('/repos/DocDamage/chatbot/git/blobs/123')) {
        return {
          data: {
            content: Buffer.from('console.log("hello world");').toString('base64')
          }
        };
      }
      if (url.includes('/search/issues')) {
        return {
          data: {
            items: [
              {
                number: 42,
                title: 'Feature request',
                body: 'Please add streaming chat.',
                html_url: 'https://github.com/DocDamage/chatbot/issues/42',
                repository_url: 'https://api.github.com/repos/DocDamage/chatbot',
                state: 'closed',
                labels: [{ name: 'enhancement' }],
                created_at: '2026-08-01T00:00:00Z',
                updated_at: '2026-08-02T00:00:00Z'
              }
            ]
          }
        };
      }
      if (url.includes('/repos/DocDamage/chatbot/readme')) {
        return {
          data: {
            content: Buffer.from('# ChatBot Hub\nDocumentation and guides.').toString('base64')
          }
        };
      }
      if (url.includes('/repos/DocDamage/chatbot/issues/42')) {
        return {
          data: {
            number: 42,
            title: 'Feature request',
            body: 'Please add streaming chat.',
            html_url: 'https://github.com/DocDamage/chatbot/issues/42',
            state: 'closed',
            user: { login: 'octocat' },
            labels: [{ name: 'enhancement' }],
            comments: 2,
            created_at: '2026-08-01T00:00:00Z',
            updated_at: '2026-08-02T00:00:00Z'
          }
        };
      }
      if (url.includes('/repos/DocDamage/chatbot/contents/src/index.ts')) {
        return {
          data: {
            content: Buffer.from('console.log("main index");').toString('base64'),
            html_url: 'https://github.com/DocDamage/chatbot/blob/main/src/index.ts',
            size: 26,
            sha: 'abcdef123456'
          }
        };
      }
      if (url.includes('/repos/DocDamage/chatbot')) {
        return {
          data: {
            id: 123,
            full_name: 'DocDamage/chatbot',
            description: 'Autonomous AI coding chatbot',
            html_url: 'https://github.com/DocDamage/chatbot',
            stargazers_count: 500,
            forks_count: 50,
            language: 'TypeScript',
            topics: ['ai'],
            updated_at: '2026-08-25T00:00:00Z'
          }
        };
      }
      return { data: {} };
    });

    const source = new GitHubSource('dummy-token');
    const available = await source.isAvailable();
    expect(available).toBe(true);

    const results = await source.search('chatbot', { limit: 10, type: 'all' });
    expect(results.length).toBeGreaterThanOrEqual(3);

    // Get repository by ID
    const repoResult = await source.getById('repo_DocDamage/chatbot');
    expect(repoResult).not.toBeNull();
    expect(repoResult?.title).toBe('DocDamage/chatbot');
    expect(repoResult?.content).toContain('ChatBot Hub');

    // Get issue by ID
    const issueResult = await source.getById('issue_DocDamage/chatbot_42');
    expect(issueResult).not.toBeNull();
    expect(issueResult?.title).toBe('Feature request');

    // Get code file by ID
    const codeResult = await source.getById('code_DocDamage/chatbot_src/index.ts');
    expect(codeResult).not.toBeNull();
    expect(codeResult?.title).toBe('DocDamage/chatbot/src/index.ts');
  });

  it('handles network failures gracefully', async () => {
    (mockedAxios.get as any).mockRejectedValue(new Error('GitHub API rate limit exceeded'));

    const source = new GitHubSource();
    const available = await source.isAvailable();
    expect(available).toBe(false);

    const results = await source.search('fail query');
    expect(results).toEqual([]);

    const repo = await source.getById('repo_missing/repo');
    expect(repo).toBeNull();
  });
});
