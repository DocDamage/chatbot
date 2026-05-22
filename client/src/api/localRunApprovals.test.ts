import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelLocalRun,
  listLocalRunFiles,
  localRunFileUrl,
  readLocalRunFile,
  startLocalRun
} from './localRunApprovals';

const mockFetch = (response: Partial<Response>) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('local run approval API polish helpers', () => {
  it('starts and cancels runs through lifecycle endpoints', async () => {
    const fetchMock = mockFetch({ ok: true, json: async () => ({ run: { id: 'run-1', status: 'completed' } }) });

    await startLocalRun('run-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/local-tools/runs/run-1/start', expect.objectContaining({ method: 'POST' }));

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'run-1', cancelRequested: true, status: 'cancel_requested' }) });
    await cancelLocalRun('run-1');

    expect(fetchMock).toHaveBeenLastCalledWith('/api/local-tools/runs/run-1/cancel', expect.objectContaining({ method: 'POST' }));
  });

  it('lists, reads, and links output files', async () => {
    const fetchMock = mockFetch({ ok: true, json: async () => ({ files: [{ fileName: 'stdout.txt' }] }) });

    await listLocalRunFiles('run-1');
    expect(fetchMock).toHaveBeenCalledWith('/api/local-tools/runs/run-1/files');

    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => 'hello output' });
    await expect(readLocalRunFile('run-1', 'stdout.txt')).resolves.toBe('hello output');
    expect(fetchMock).toHaveBeenLastCalledWith('/api/local-tools/runs/run-1/files/stdout.txt');
    expect(localRunFileUrl('run-1', 'stderr.txt')).toBe('/api/local-tools/runs/run-1/files/stderr.txt');
  });
});
