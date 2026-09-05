import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectIntelligencePanel from './ProjectIntelligencePanel';

vi.mock('../api/runtime', () => ({ isStaticPagesBuild: false }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ProjectIntelligencePanel expansion surfaces', () => {
  it('makes the repository architecture map and Memory Center reachable from the workspace', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/project-intelligence/overview')) {
        return new Response(JSON.stringify({
          project: { name: 'ChatBot', description: 'fixture', type: 'application', language: ['TypeScript'], frameworks: ['React'] },
          summary: { files: 1, lines: 120, symbols: 8, churnedFiles: 1, averageRisk: 72 },
          hotspots: [{ path: 'src/core/example.ts', lines: 120, symbols: 8, complexity: 12, churn: 3, risk: 72, recommendation: 'Add focused tests.' }],
          duplicateCandidates: [],
          recommendations: ['Review the high-risk hotspot.']
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/api/project-memory/resume')) {
        return new Response(JSON.stringify({ path: 'MEMORY.md', entries: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/api/project-memory/entries') && init?.method === 'POST') {
        return new Response(JSON.stringify({ entry: { id: 'new' } }), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        entries: [{ id: 'mem-1', category: 'decision', content: 'Use route manifests', tags: ['architecture'], createdAt: '2026-08-25T00:00:00.000Z' }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<ProjectIntelligencePanel />);
    await user.click(screen.getByRole('button', { name: /Project intelligence/i }));

    expect(await screen.findByRole('region', { name: 'Repository Architecture Map' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Project Memory Center' })).toBeTruthy();
    expect(screen.getAllByText('src/core/example.ts').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Use route manifests').length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('button', { name: 'Export MEMORY.md' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Generated MEMORY.md from 1 entries'));
  });
});
