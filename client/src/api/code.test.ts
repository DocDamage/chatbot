import { describe, expect, it, vi, beforeEach } from 'vitest';
import { applyStructuredCodePatch, askCodeAgent, createCodePatch, createStructuredCodePatch, getCodeRepository, getCodeSymbols, planCodeWork, retrieveCodeEvidence, reviewCodeDiff, searchCodeFiles, verifyCode, verifyNativeCode } from './code';

describe('code API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('searches code files through the dedicated route', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ path: 'src/index.ts' }] }),
    } as Response);

    await expect(searchCodeFiles('index')).resolves.toEqual([{ path: 'src/index.ts' }]);
    expect(fetch).toHaveBeenCalledWith('/api/code/files/search?q=index', { signal: undefined });
  });

  it('loads symbols and posts code workflows', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ symbols: [{ name: 'App' }], ok: true }),
    } as Response);

    await askCodeAgent('where is App?', true);
    await planCodeWork('add tests');
    await getCodeSymbols('src/App.tsx');
    await createCodePatch('replace foo', 'implement');
    await reviewCodeDiff('diff --git a/a b/a');
    await verifyCode(['npm run type-check'], 'implement');

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/code/ask', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/code/plan', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/code/symbols?file=src%2FApp.tsx');
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/code/patch', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(5, '/api/code/review', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(6, '/api/code/verify', expect.objectContaining({ method: 'POST' }));
  });

  it('exposes repository evidence, structured patch approval, and native verification routes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ operations: [{ operation: 'create', path: 'a.ts', reason: 'test', authorized: true }] }),
    } as Response);
    const operations = [{ operation: 'create' as const, path: 'a.ts', reason: 'test', authorized: true }];

    await getCodeRepository('plan');
    await retrieveCodeEvidence('find the handler', 'debug');
    await createStructuredCodePatch('create a.ts with "export {}"', 'implement');
    await applyStructuredCodePatch(operations, 'implement');
    await verifyNativeCode('debug');

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/code/repository', expect.objectContaining({ headers: { 'x-work-mode': 'plan' } }));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/code/retrieve', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/code/patch/structured', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/code/patch/apply', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(5, '/api/code/verify/native', expect.objectContaining({ method: 'POST' }));
    expect((fetch as any).mock.calls[3][1].body).toContain('"authorized":true');
  });
});
