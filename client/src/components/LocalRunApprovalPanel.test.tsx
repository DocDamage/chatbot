import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocalRunApprovalPanel from './LocalRunApprovalPanel';

const runs = [
  {
    id: 'run-1',
    status: 'planned',
    commandTemplate: 'node script.js',
    cwd: '.',
    riskLevel: 'low',
    approvedByUser: true,
    executableEnabled: false,
    executablePath: '/tools/node',
    stdoutPath: '/tmp/stdout.txt',
    stderrPath: '/tmp/stderr.txt'
  }
];

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
  });

  global.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const path = String(url);
    if (path.includes('/api/local-tools/runs?')) {
      return { ok: true, json: async () => ({ runs }) } as Response;
    }
    if (path.endsWith('/files')) {
      return {
        ok: true,
        json: async () => ({
          runId: 'run-1',
          files: [
            { fileName: 'stdout.txt', size: 11, modifiedTime: '2026-05-21T00:00:00.000Z', kind: 'stdout', downloadUrl: '/stdout' },
            { fileName: 'stderr.txt', size: 5, modifiedTime: '2026-05-21T00:00:00.000Z', kind: 'stderr', downloadUrl: '/stderr' }
          ]
        })
      } as Response;
    }
    if (path.endsWith('/stdout.txt')) {
      return { ok: true, text: async () => 'hello output' } as Response;
    }
    if (path.endsWith('/stderr.txt')) {
      return { ok: true, text: async () => 'error output' } as Response;
    }
    if (path.endsWith('/start')) {
      return { ok: true, json: async () => ({ run: { ...runs[0], status: 'completed' } }) } as Response;
    }
    if (path.endsWith('/cancel')) {
      return { ok: true, json: async () => ({ runId: 'run-1', cancelRequested: false, status: 'planned' }) } as Response;
    }
    if (path.endsWith('/approve')) {
      return { ok: true, json: async () => ({ run: runs[0] }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LocalRunApprovalPanel', () => {
  it('renders polished run state, output browser, links, and copy actions', async () => {
    const user = userEvent.setup();
    render(<LocalRunApprovalPanel />);

    await waitFor(() => expect(screen.getByText('node script.js')).toBeTruthy());
    expect(screen.getByText('Executable disabled')).toBeTruthy();
    expect(screen.getByText('Output browser')).toBeTruthy();

    await waitFor(() => expect(screen.getByText(/stdout\.txt/i)).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/hello output/i)).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /stderr/i }));
    await waitFor(() => expect(screen.getByText(/error output/i)).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /copy command/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('node script.js');
  });

  it('starts approved runs from the UI', async () => {
    const user = userEvent.setup();
    render(<LocalRunApprovalPanel />);

    await waitFor(() => expect(screen.getByRole('button', { name: /^start$/i })).toBeTruthy());
    await user.click(screen.getByRole('button', { name: /^start$/i }));

    expect(fetch).toHaveBeenCalledWith('/api/local-tools/runs/run-1/start', expect.objectContaining({ method: 'POST' }));
  });
});
