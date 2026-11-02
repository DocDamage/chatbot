import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  applyStructuredCodePatch,
  askCodeAgent,
  createCodePatch,
  createStructuredCodePatch,
  getCodeRepository,
  getCodeSymbols,
  planCodeWork,
  repairCode,
  retrieveCodeEvidence,
  reviewCodeDiff,
  searchCodeFiles,
  verifyCode,
  verifyNativeCode
} from './code';

describe('code API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('searches code files through the dedicated route and handles empty results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ path: 'src/index.ts' }] }),
    } as Response);

    await expect(searchCodeFiles('index')).resolves.toEqual([{ path: 'src/index.ts' }]);
    expect(fetch).toHaveBeenCalledWith('/api/code/files/search?q=index', { signal: undefined });

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);
    await expect(searchCodeFiles('missing')).resolves.toEqual([]);
  });

  it('loads symbols and posts code workflows with fallback defaults', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ symbols: [{ name: 'App' }], ok: true }),
    } as Response);

    await askCodeAgent('where is App?', true);
    await askCodeAgent('where is App?');
    await planCodeWork('add tests');
    await getCodeSymbols('src/App.tsx');
    await createCodePatch('replace foo', 'implement');
    await reviewCodeDiff('diff --git a/a b/a', ['security']);
    await reviewCodeDiff('diff --git a/a b/a');
    await verifyCode(['npm run type-check'], 'implement');

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/code/ask', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/code/ask', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/code/plan', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/code/symbols?file=src%2FApp.tsx');
    expect(fetch).toHaveBeenNthCalledWith(5, '/api/code/patch', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(6, '/api/code/review', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(7, '/api/code/review', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(8, '/api/code/verify', expect.objectContaining({ method: 'POST' }));

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);
    await expect(getCodeSymbols('src/empty.tsx')).resolves.toEqual([]);
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
    await verifyNativeCode('debug', false);
    await verifyNativeCode('debug');
    await repairCode(operations, 'debug', 5);
    await repairCode(operations, 'debug');

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/code/repository', expect.objectContaining({ headers: { 'x-work-mode': 'plan' } }));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/code/retrieve', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/code/patch/structured', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/code/patch/apply', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(5, '/api/code/verify/native', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(6, '/api/code/verify/native', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(7, '/api/code/repair', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(8, '/api/code/repair', expect.objectContaining({ method: 'POST' }));
    expect((fetch as any).mock.calls[3][1].body).toContain('"authorized":true');
  });

  it('handles error paths across all code endpoints', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failure' }),
    } as Response);

    const ops = [{ operation: 'modify' as const, path: 'b.ts', reason: 'fix', authorized: false }];

    await expect(askCodeAgent('error')).rejects.toThrow();
    await expect(planCodeWork('error')).rejects.toThrow();
    await expect(searchCodeFiles('error')).rejects.toThrow();
    await expect(getCodeSymbols('err.ts')).rejects.toThrow();
    await expect(createCodePatch('msg', 'mode')).rejects.toThrow();
    await expect(reviewCodeDiff('diff')).rejects.toThrow();
    await expect(verifyCode(['test'], 'mode')).rejects.toThrow();
    await expect(getCodeRepository('mode')).rejects.toThrow();
    await expect(retrieveCodeEvidence('query', 'mode')).rejects.toThrow();
    await expect(createStructuredCodePatch('msg', 'mode')).rejects.toThrow();
    await expect(applyStructuredCodePatch(ops, 'mode')).rejects.toThrow();
    await expect(verifyNativeCode('mode')).rejects.toThrow();
    await expect(repairCode(ops, 'mode')).rejects.toThrow();
  });
});
