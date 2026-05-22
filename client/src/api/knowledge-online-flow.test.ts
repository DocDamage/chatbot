import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkOnlineKnowledge, searchAndIngestOnlineKnowledge } from './knowledge';

const mockFetch = (response: Partial<Response>) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('knowledge online flow API', () => {
  it('posts confidence checks as JSON', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ answer: 'local answer', confidence: 0.8, needsOnlineResearch: false, suggestedQuery: 'known topic' }),
    });

    await checkOnlineKnowledge('known topic', 'gaming', 0.7);

    expect(fetchMock).toHaveBeenCalledWith('/api/knowledge-online/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'known topic', domain: 'gaming', confidenceThreshold: 0.7 }),
    });
  });

  it('posts approved search-and-store requests as JSON', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ ingested: true }),
    });

    await searchAndIngestOnlineKnowledge({
      query: 'sprite metadata',
      domain: 'gaming',
      approved: true,
      approvedBy: 'reviewer-1'
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/knowledge-online/search-and-ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'sprite metadata',
        domain: 'gaming',
        approved: true,
        approvedBy: 'reviewer-1'
      }),
    });
  });
});
