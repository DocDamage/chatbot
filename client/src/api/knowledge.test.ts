import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkOnlineKnowledge,
  deepResearchOnlineKnowledge,
  ingestOnlineKnowledge,
  searchAndIngestOnlineKnowledge,
  searchOnlineKnowledge
} from './knowledge';

const mockFetch = (response: Partial<Response>) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('online knowledge API client', () => {
  it('posts search requests as JSON', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await searchOnlineKnowledge('modular servers', 'engineering');

    expect(fetchMock).toHaveBeenCalledWith('/api/knowledge-online/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'modular servers', domain: 'engineering' }),
    });
  });

  it('marks ingestion requests as approved with provenance', async () => {
    const preview = { reviewToken: 'token-1' };
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ success: true }),
    });

    await ingestOnlineKnowledge(preview, 'session-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/knowledge-online/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preview, approved: true, approvedBy: 'session-1' }),
    });
  });

  it('executes confidence checks, deep research, and combined search-and-ingest', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ answer: 'test', confidence: 0.9, needsOnlineResearch: false, suggestedQuery: '' }),
    });

    await checkOnlineKnowledge('What is RAG?', 'engineering', 0.8);
    await checkOnlineKnowledge('What is RAG?', 'engineering');
    await deepResearchOnlineKnowledge('deep topic', 'science');
    await searchAndIngestOnlineKnowledge({
      query: 'deep query',
      domain: 'science',
      approved: true,
      approvedBy: 'session-2',
      notes: 'test note'
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/knowledge-online/check', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/knowledge-online/check', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/knowledge-online/research', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/knowledge-online/search-and-ingest', expect.objectContaining({ method: 'POST' }));
  });

  it('preserves structured 500 online knowledge errors across endpoints', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: { message: 'Search provider unavailable', code: 'INTERNAL_ERROR' },
      }),
    });

    await expect(checkOnlineKnowledge('q', 'd')).rejects.toThrow();
    await expect(searchOnlineKnowledge('latest docs', 'engineering')).rejects.toMatchObject({
      message: 'Search provider unavailable',
      status: 500,
      code: 'INTERNAL_ERROR',
    });
    await expect(ingestOnlineKnowledge({}, 's')).rejects.toThrow();
    await expect(deepResearchOnlineKnowledge('q', 'd')).rejects.toThrow();
    await expect(searchAndIngestOnlineKnowledge({ query: 'q', domain: 'd', approved: true, approvedBy: 's' })).rejects.toThrow();
  });
});
