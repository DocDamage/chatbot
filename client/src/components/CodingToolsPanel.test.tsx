import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CodingToolsPanel from './CodingToolsPanel';
import { apiFetch } from '../api/http';

vi.mock('../api/http', () => ({ apiFetch: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const response = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response;
const status = { enabled: true, installed: { serena: true, aider: true, astGrep: true, context7: true }, workspaceRoot: 'C:/project', model: 'qwen3:8b' };
describe('coding tools workspace', () => {
  it('creates a reviewable proposal without applying it and gates application by mode', async () => {
    const patch = { operations: [{ operation: 'modify', path: 'app.ts', content: 'fixed', expectedContent: 'old', reason: 'fix', authorized: false }], conflicts: [], diff: '-old\n+fixed' };
    vi.mocked(apiFetch).mockImplementation(async url => response(url.endsWith('/status') ? status : { patch }));
    render(<CodingToolsPanel mode="ask" />); fireEvent.click(screen.getByRole('button', { name: 'Coding workspace' }));
    await screen.findByText(/aider: installed/);
    fireEvent.change(screen.getByLabelText(/Existing source files/), { target: { value: 'app.ts' } });
    fireEvent.change(screen.getByLabelText('Coding task and acceptance criteria'), { target: { value: 'fix app' } });
    fireEvent.click(screen.getByRole('button', { name: 'Draft changes' }));
    await screen.findByRole('article', { name: 'Proposed code changes' });
    expect((screen.getByRole('button', { name: 'Apply reviewed patch' }) as HTMLButtonElement).disabled).toBe(true);
    expect(apiFetch).toHaveBeenCalledWith('/api/code/tools/propose', expect.objectContaining({ method: 'POST', body: JSON.stringify({ files: ['app.ts'], newFiles: [], message: 'fix app', automaticContext: true, propertyTests: false }) }));
    expect(vi.mocked(apiFetch).mock.calls.some(([url]) => url.endsWith('/apply'))).toBe(false);
  });
  it('makes explicit documentation requests and shows returned service errors', async () => {
    vi.mocked(apiFetch).mockResolvedValue(response(status));
    render(<CodingToolsPanel mode="ask" />); fireEvent.click(screen.getByRole('button', { name: 'Coding workspace' }));
    await screen.findByText(/aider: installed/);
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'docs' } });
    fireEvent.change(screen.getByLabelText('Library name or Context7 library ID'), { target: { value: '/nodejs/node' } });
    fireEvent.change(screen.getByLabelText('Documentation question'), { target: { value: 'node:test API' } });
    vi.mocked(apiFetch).mockResolvedValue(response({ error: { message: 'Documentation service unavailable' } }, false));
    fireEvent.click(screen.getByRole('button', { name: 'Fetch documentation' }));
    await screen.findByRole('alert'); expect(screen.getByRole('alert').textContent).toBe('Documentation service unavailable');
  });
  it('supports task-only drafts, fast-check guidance and visible read-only context', async () => {
    vi.mocked(apiFetch).mockImplementation(async url => response(url.endsWith('/status') ? status : {
      patch: { operations: [], conflicts: [], diff: '' }, selection: { files: [{ path: 'math.test.ts', role: 'read_only', reason: 'Imports an editable file' }], omitted: 2, limitations: [] },
      draftChecks: { compiler: { status: 'passed', baselineErrors: 1 }, linter: { status: 'passed', baselineErrors: 0 } },
    }));
    render(<CodingToolsPanel mode="ask" />); fireEvent.click(screen.getByRole('button', { name: 'Coding workspace' }));
    await screen.findByText(/aider: installed/);
    fireEvent.change(screen.getByLabelText('Coding task and acceptance criteria'), { target: { value: 'Fix math.ts' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include fast-check property test guidance' }));
    fireEvent.click(screen.getByRole('button', { name: 'Draft changes' }));
    await screen.findByText(/math.test.ts · read-only context/);
    expect(apiFetch).toHaveBeenCalledWith('/api/code/tools/propose', expect.objectContaining({ body: JSON.stringify({ files: [], newFiles: [], message: 'Fix math.ts', automaticContext: true, propertyTests: true }) }));
    expect(screen.getByText(/Baseline snapshot diagnostics: 1 compiler, 0 lint/)).toBeTruthy();
  });
});
