import { afterEach, describe, expect, it, vi } from 'vitest';
import { ingestOnlineKnowledge, searchOnlineKnowledge } from './knowledge';

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

  it('preserves structured 500 online knowledge errors', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: { message: 'Search provider unavailable', code: 'INTERNAL_ERROR' },
      }),
    });

    await expect(searchOnlineKnowledge('latest docs', 'engineering')).rejects.toMatchObject({
      message: 'Search provider unavailable',
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  });
});
