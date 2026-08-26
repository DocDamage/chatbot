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
                language: 'TypeScript',
                topics: ['ai', 'agent'],
                updated_at: '2026-08-25T00:00:00Z'
              }
            ]
          }
        };
      }
      if (url.includes('/search/code')) {
        return { data: { items: [] } };
      }
      if (url.includes('/search/issues')) {
        return { data: { items: [] } };
      }
      return { data: {} };
    });

    const source = new GitHubSource('dummy-token');
    const available = await source.isAvailable();
    expect(available).toBe(true);

    const results = await source.search('chatbot', { limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('DocDamage/chatbot');
  });
});
