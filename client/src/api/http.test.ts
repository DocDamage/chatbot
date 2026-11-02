import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('local authenticated transport', () => {
  it('keeps the normal request unchanged when local sign-in is not enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const { apiFetch } = await import('./http');
    await apiFetch('/api/conversations');
    expect(fetchMock).toHaveBeenCalledWith('/api/conversations');
  });
  it('authenticates same-origin API calls and never sends its token to an external URL', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ token: 'local-test-token' }))).mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const { initializeLocalSession, apiFetch } = await import('./http');
    await initializeLocalSession();
    await apiFetch('/api/conversations');
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer local-test-token');
    await apiFetch('https://external.example/api/data');
    expect(fetchMock).toHaveBeenLastCalledWith('https://external.example/api/data');
  });
  it('refreshes an expired local token before retrying the rejected request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'first-token' })))
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'new-token' })))
      .mockResolvedValueOnce(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const { initializeLocalSession, apiFetch } = await import('./http');
    await initializeLocalSession();
    expect((await apiFetch('/api/conversations')).ok).toBe(true);
    expect(new Headers(fetchMock.mock.calls[3][1].headers).get('Authorization')).toBe('Bearer new-token');
  });
});
