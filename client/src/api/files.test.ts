import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFileTree, readFile, searchFiles } from './files';

const mockFetch = (response: Partial<Response>) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('file API client', () => {
  it('builds encoded file tree and search requests', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ results: [] }),
    });

    await fetchFileTree('src/components', 2);
    await searchFiles('hello world', 'content', { limit: 25, offset: 50 });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/files/tree?root=src%2Fcomponents&maxDepth=2');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/files/search?q=hello+world&kind=content&limit=25&offset=50',
      { signal: undefined }
    );
  });

  it('throws clear errors for failed file reads', async () => {
    mockFetch({ ok: false });

    await expect(readFile('missing.ts')).rejects.toThrow('Unable to read file');
  });

  it('preserves structured 401 file route errors', async () => {
    mockFetch({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: { message: 'No authentication token provided', code: 'AUTHENTICATION_ERROR' },
      }),
    });

    await expect(searchFiles('secret')).rejects.toMatchObject({
      message: 'No authentication token provided',
      status: 401,
      code: 'AUTHENTICATION_ERROR',
    });
  });
});
