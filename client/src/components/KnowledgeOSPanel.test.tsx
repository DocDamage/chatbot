import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ staticBuild: false }));
vi.mock('../api/runtime', () => ({
  get isStaticPagesBuild() {
    return runtime.staticBuild;
  }
}));

import KnowledgeOSPanel from './KnowledgeOSPanel';

const jsonResponse = (data: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(data)
}) as unknown as Response;

const summary = {
  entities: { total: 4, byType: { tool: 4 } },
  graph: { nodes: 5, edges: 6 },
  memory: { total: 3, approved: 2, pending: 1 },
  governance: { recentReportCount: 1, recentReports: [{ id: 'r0', request: 'Initial audit', score: 0.8 }] },
  knowledgeBase: { persistentStore: true, persistence: { sources: 10, chunks: 20, embeddings: 30 } }
};

function installFetchRouter() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/knowledge-os/summary') return jsonResponse(summary);
    if (url.startsWith('/api/knowledge-base/sources?')) return jsonResponse({
      sources: [{
        id: 'source-1', source: '/library/book.pdf', sourceType: 'document', title: 'A Book', author: 'Author',
        publishedDate: '2026', fileExtension: '.pdf', citationLabel: 'Book', chunks: 12, embeddings: 11,
        warnings: ['needs review'], needsOcr: true, duplicateCount: 2, latestRun: { status: 'done' }
      }],
      total: 1234,
      limit: 75,
      offset: 0
    });
    if (url.startsWith('/api/knowledge-base/ocr-queue')) return jsonResponse({ sources: [], total: 9, limit: 1, offset: 0 });
    if (url === '/api/knowledge-os/graph/build') return jsonResponse({ centrality: [{ label: 'Core', type: 'module', degree: 7 }] });
    if (url.startsWith('/api/knowledge-os/entities/search')) return jsonResponse({
      entities: [{ label: 'FL Studio', normalized: 'fl-studio', type: 'tool', confidence: 0.95 }]
    });
    if (url === '/api/knowledge-os/wiki/pages') {
      return init?.method === 'POST'
        ? jsonResponse({ page: { slug: 'notes/saved', title: 'Saved Page' } })
        : jsonResponse({ pages: [{ slug: 'notes/listed', title: 'Listed Page' }] });
    }
    if (url.startsWith('/api/knowledge-os/wiki/search')) return jsonResponse({ pages: [{ slug: 'notes/result', title: 'Search Result' }] });
    if (url.startsWith('/api/knowledge-os/memory/recall')) return jsonResponse({
      memories: [
        { id: 'm1', content: 'Pending memory', tags: [], status: 'pending', confidence: 0.75, importance: 1 },
        { id: 'm2', content: 'Approved memory', tags: [], status: 'approved', confidence: 1, importance: 1 }
      ]
    });
    if (url.includes('/approval')) return jsonResponse({ ok: true });
    if (url.startsWith('/api/knowledge-os/governance/evidence')) return jsonResponse({
      reports: [{ id: 'r1', request: '', score: 0, createdAt: '2026-01-01' }]
    });
    if (url === '/api/knowledge-os/import/repositories') return jsonResponse({
      results: [
        { repo: 'owner/with-warnings', wikiPage: 'imports/one', chunks: 2, warnings: ['warning'] },
        { repo: 'owner/without-wiki', chunks: 0, warnings: [] }
      ]
    });
    if (url === '/api/knowledge-os/wiki/ingest') return jsonResponse({ ok: true });
    throw new Error(`Unhandled fetch: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('KnowledgeOSPanel', () => {
  beforeEach(() => {
    runtime.staticBuild = false;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads and operates every Knowledge OS screen', async () => {
    const fetchMock = installFetchRouter();
    const user = userEvent.setup();
    render(<KnowledgeOSPanel />);

    await screen.findByText('DB on');
    await user.click(screen.getByRole('button', { name: /Knowledge OS/ }));
    expect(screen.getByText('1 pending')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText('DB on');
    await user.click(screen.getByRole('button', { name: 'Build graph' }));
    await screen.findByText('Graph build complete');
    await user.click(screen.getByRole('button', { name: 'Ingest wiki' }));
    await screen.findByText('Wiki ingest complete');

    await user.click(screen.getByRole('button', { name: 'library' }));
    await screen.findByText('A Book');
    expect(screen.getByText('1,234 sources · 9 OCR queued')).toBeTruthy();
    expect(screen.getByText('2 copies')).toBeTruthy();
    await user.type(screen.getByPlaceholderText('Search title, author, or path...'), 'book');
    const switches = screen.getAllByRole('checkbox');
    await user.click(switches[0]);
    await user.click(switches[1]);
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('q=book&needsOcr=true&duplicates=true'),
      expect.any(Object)
    ));

    await user.click(screen.getByRole('button', { name: 'entities' }));
    const entityInput = screen.getByPlaceholderText('Search entities...');
    await user.clear(entityInput);
    await user.type(entityInput, 'studio & tools');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText(/FL Studio -> fl-studio/);

    await user.click(screen.getByRole('button', { name: 'graph' }));
    await user.click(screen.getByRole('button', { name: 'Build and persist graph' }));
    await screen.findByText('Core (module) degree 7');

    await user.click(screen.getByRole('button', { name: 'wiki' }));
    await user.click(screen.getByRole('button', { name: 'Search/List' }));
    await screen.findByText('Listed Page (notes/listed)');
    await user.type(screen.getByPlaceholderText('Search wiki...'), 'topic');
    await user.click(screen.getByRole('button', { name: 'Search/List' }));
    await screen.findByText('Search Result (notes/result)');
    const slug = screen.getByPlaceholderText('slug');
    const title = screen.getByPlaceholderText('title');
    await user.clear(slug);
    await user.type(slug, 'notes/saved');
    await user.clear(title);
    await user.type(title, 'Saved Page');
    await user.type(screen.getByPlaceholderText('Write canonical local knowledge...'), 'content');
    await user.click(screen.getByRole('button', { name: 'Save page' }));
    await screen.findByText('Saved Page (notes/saved)');

    await user.click(screen.getByRole('button', { name: 'memory' }));
    await user.click(screen.getByRole('button', { name: 'Load memories' }));
    await screen.findByText('Pending memory');
    expect(screen.queryByRole('button', { name: 'Approve', hidden: false })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await screen.findByText('Memory approval complete');
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await screen.findByText('Memory approval complete');

    await user.click(screen.getByRole('button', { name: 'evidence' }));
    await user.click(screen.getByRole('button', { name: 'Load reports' }));
    await screen.findByText('Evidence load complete');
    expect(screen.getByText('Initial audit · score 0.80')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'imports' }));
    await user.click(screen.getByRole('button', { name: 'Import recommended repos' }));
    await screen.findByText(/owner\/with-warnings -> imports\/one \(1 warnings\)/);
    expect(screen.getByText('owner/without-wiki -> wiki skipped')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Knowledge OS/ }));
    expect(screen.queryByRole('heading', { name: 'Repo Importers' })).toBeNull();
  });

  it('uses empty response defaults and reports request failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}, false, 503))
      .mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<KnowledgeOSPanel />);
    await screen.findByText('DB off');
    await user.click(screen.getByRole('button', { name: /Knowledge OS/ }));
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Build graph' }));
    await screen.findByText('Graph build failed: HTTP 503');

    await user.click(screen.getByRole('button', { name: 'entities' }));
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('Entity search complete');
    expect(screen.getByText('No results yet.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'graph' }));
    await user.click(screen.getByRole('button', { name: 'Build and persist graph' }));
    await screen.findByText('Graph build complete');
    expect(screen.getByText('No graph nodes loaded yet.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'wiki' }));
    await user.click(screen.getByRole('button', { name: 'Search/List' }));
    await screen.findByText('Wiki search complete');
    expect(screen.getByText('No wiki pages loaded yet.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'library' }));
    await screen.findByText('No library sources loaded yet.');
    expect(screen.getByText('0 sources · 0 OCR queued')).toBeTruthy();
  });

  it('reports initial summary HTTP failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false, 502)));
    const user = userEvent.setup();
    render(<KnowledgeOSPanel />);
    await user.click(screen.getByRole('button', { name: /Knowledge OS/ }));
    await screen.findByText('Summary failed: HTTP 502');
  });

  it('fails closed in a static pages build', async () => {
    runtime.staticBuild = true;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<KnowledgeOSPanel />);
    await user.click(screen.getByRole('button', { name: /Knowledge OS/ }));
    await screen.findByText('Knowledge OS APIs require the local backend.');
    await user.click(screen.getByRole('button', { name: 'Build graph' }));
    await screen.findByText('Graph build failed: Knowledge OS APIs require the local backend.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not update state after an in-flight summary unmounts', async () => {
    let resolveRequest!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { resolveRequest = resolve; })));
    const view = render(<KnowledgeOSPanel />);
    view.unmount();
    resolveRequest(jsonResponse(summary));
    await Promise.resolve();
  });
});
