import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocalRunApprovalPanel from './LocalRunApprovalPanel';
import {
  restoreBrowserTestGlobals,
  stubClipboard,
  stubExecCommand
} from '../test/browserTestUtils';

const runs = [
  {
    id: 'run-1',
    status: 'planned',
    commandTemplate: 'node script.js',
    cwd: '.',
    riskLevel: 'low',
    approvedByUser: false,
    executableEnabled: false,
    executablePath: '/tools/node',
    stdoutPath: '/tmp/stdout.txt',
    stderrPath: '/tmp/stderr.txt',
    durationMs: 120
  },
  {
    id: 'run-2',
    status: 'running',
    commandTemplate: 'npm run watch',
    cwd: './src',
    riskLevel: 'high',
    approvedByUser: true,
    executableEnabled: true,
    stdoutPath: '/tmp/stdout2.txt'
  }
];

beforeEach(() => {
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
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
            { fileName: 'stdout.txt', size: 500, modifiedTime: '2026-05-21T00:00:00.000Z', kind: 'stdout', downloadUrl: '/stdout' },
            { fileName: 'stderr.txt', size: 2048, modifiedTime: '2026-05-21T00:00:00.000Z', kind: 'stderr', downloadUrl: '/stderr' },
            { fileName: 'huge.log', size: 2 * 1024 * 1024, modifiedTime: '2026-05-21T00:00:00.000Z', kind: 'output', downloadUrl: '/huge' }
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
      return { ok: true, json: async () => ({ runId: 'run-2', cancelRequested: true, status: 'cancel_requested' }) } as Response;
    }
    if (path.endsWith('/approve')) {
      return { ok: true, json: async () => ({ run: { ...runs[0], approvedByUser: true } }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
});

afterEach(() => {
  cleanup();
  restoreBrowserTestGlobals();
  vi.restoreAllMocks();
});

describe('LocalRunApprovalPanel', () => {
  it('renders polished run state, output browser, links, and copy actions', async () => {
    const user = userEvent.setup();
    const clipboardWriteText = vi.fn(async (_value: string) => undefined);
    stubClipboard(clipboardWriteText);
    render(<LocalRunApprovalPanel />);

    await waitFor(() => expect(screen.getByText('node script.js')).toBeTruthy());
    expect(screen.getByText('Executable disabled')).toBeTruthy();
    expect(screen.getByText('Output browser')).toBeTruthy();
    expect(screen.getByText('120ms')).toBeTruthy();

    await waitFor(() => expect(screen.getByText(/stdout\.txt/i)).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/hello output/i)).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /stderr/i }));
    await waitFor(() => expect(screen.getByText(/error output/i)).toBeTruthy());

    // Copy command
    await user.click(screen.getAllByRole('button', { name: /copy command/i })[0]);
    expect(clipboardWriteText).toHaveBeenCalledWith('node script.js');
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/copied to clipboard/i));

    // Copy output path
    await user.click(screen.getAllByRole('button', { name: /copy output path/i })[0]);
    expect(clipboardWriteText).toHaveBeenCalledWith('/tmp/stdout.txt');

    // Reload output
    await user.click(screen.getByRole('button', { name: /reload output/i }));
    expect(fetch).toHaveBeenCalledWith('/api/local-tools/runs/run-1/files');
  });

  it('approves a planned run and cancels a running run', async () => {
    const user = userEvent.setup();
    render(<LocalRunApprovalPanel />);

    await waitFor(() => expect(screen.getByText('node script.js')).toBeTruthy());

    // Edit approval note
    const noteInput = screen.getByPlaceholderText('Why this run is approved');
    fireEvent.change(noteInput, { target: { value: 'Custom security approval' } });

    // Approve run-1
    await user.click(screen.getAllByRole('button', { name: /^approve$/i })[0]);
    expect(fetch).toHaveBeenCalledWith('/api/local-tools/runs/run-1/approve', expect.objectContaining({ method: 'POST' }));

    // Select run-2 and Cancel
    const selectButtons = screen.getAllByRole('button', { name: /^select$/i });
    await user.click(selectButtons[1]);
    await user.click(screen.getAllByRole('button', { name: /^cancel$/i })[1]);
    expect(fetch).toHaveBeenCalledWith('/api/local-tools/runs/run-2/cancel', expect.objectContaining({ method: 'POST' }));
  });

  it('handles empty runs and hidden panel state', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runs: [] })
    } as Response);

    const { container } = render(<LocalRunApprovalPanel visible={false} />);
    expect(container.firstChild).toBeNull();

    cleanup();
    render(<LocalRunApprovalPanel visible={true} />);
    await waitFor(() => {
      expect(screen.getByText(/no local runs have been planned yet/i)).toBeTruthy();
    });
  });

  it('maps friendly error messages on local tool failures', async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Process requires explicit user approval'));
    render(<LocalRunApprovalPanel />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/needs approval before it can start/i);
    });

    cleanup();
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Executable is not enabled'));
    render(<LocalRunApprovalPanel />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/selected executable is disabled/i);
    });

    cleanup();
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Path resolves outside workspace'));
    render(<LocalRunApprovalPanel />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/resolves outside the trusted workspace/i);
    });

    cleanup();
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('File not found'));
    render(<LocalRunApprovalPanel />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/run or output file was not found/i);
    });
  });

  it('reports clipboard rejection without breaking the run controls', async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn(async (_value: string) => {
      throw new DOMException('Permission denied', 'NotAllowedError');
    }));
    stubExecCommand(() => false);
    render(<LocalRunApprovalPanel />);

    await waitFor(() => expect(screen.getByText('node script.js')).toBeTruthy());
    await user.click(screen.getAllByRole('button', { name: /copy command/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/clipboard access is unavailable/i);
    });
  });
});
