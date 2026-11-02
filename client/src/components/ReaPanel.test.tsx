import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReaPanel from './ReaPanel';
import { apiFetch } from '../api/http';

vi.mock('../api/http', () => ({ apiFetch: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const reply = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response;
const status = { available: true, enabled: true, installed: true, version: '6.8.0', allowedRoots: ['C:/workspace'], maxInputBytes: 1048576 };

describe('REA artifact workspace', () => {
  it('submits a local path, shows evidence and restores saved analyses', async () => {
    const job = { id: 'analysis-one', target: 'app.js', status: 'completed', evidenceSha256: 'digest', steps: [{ tool: 'analyze_javascript_application', evidenceId: 'ev_observed', result: { limitations: ['static only'] } }] };
    vi.mocked(apiFetch).mockImplementation(async (url) => reply(url.endsWith('/status') ? status : url === '/api/rea/jobs' ? { jobs: [job] } : job));
    render(<ReaPanel />);
    fireEvent.click(screen.getByRole('button', { name: /REA/ }));
    await screen.findByText(/Ready for analysis/);
    fireEvent.change(screen.getByLabelText('Local file or directory'), { target: { value: 'app.js' } });
    vi.mocked(apiFetch).mockImplementation(async (url, init) => reply(url.endsWith('/status') ? status : init?.method === 'POST' ? job : { jobs: [job] }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze artifact' }));
    await screen.findByRole('button', { name: 'Download evidence bundle' });
    expect(apiFetch).toHaveBeenCalledWith('/api/rea/jobs', expect.objectContaining({ method: 'POST', body: JSON.stringify({ path: 'app.js', operation: 'auto' }) }));
    expect(screen.getByText(/ev_observed/)).toBeDefined();
    expect(screen.getByText(/Runtime behavior remains unverified/)).toBeDefined();
  });
  it('uploads an artifact and reports analysis errors without fabricated results', async () => {
    vi.mocked(apiFetch).mockImplementation(async url => reply(url.endsWith('/status') ? status : { jobs: [] }));
    render(<ReaPanel />); fireEvent.click(screen.getByRole('button', { name: /REA/ }));
    await screen.findByText(/Ready for analysis/);
    fireEvent.change(screen.getByLabelText(/Or upload/), { target: { files: [new File(['42'], 'app.js')] } });
    vi.mocked(apiFetch).mockResolvedValue(reply({ error: { message: 'Provider unavailable' } }, false));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze artifact' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Provider unavailable'));
    expect(apiFetch).toHaveBeenLastCalledWith('/api/rea/upload', expect.objectContaining({ method: 'POST', body: expect.any(FormData) }));
    expect(screen.queryByRole('button', { name: 'Download evidence bundle' })).toBeNull();
  });
});
