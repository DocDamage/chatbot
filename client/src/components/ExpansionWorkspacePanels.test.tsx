import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryCenterPanel, ProjectMemoryItem } from './MemoryCenterPanel';
import { ArchitectureCardModel, RepositoryArchitectureView } from './RepositoryArchitectureView';
import DesktopCompanionPanel from './DesktopCompanionPanel';
import WebsiteWorkspacePanel from './WebsiteWorkspacePanel';
import DocumentWorkspacePanel from './DocumentWorkspacePanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const memories: ProjectMemoryItem[] = [
  {
    id: 'decision-1',
    kind: 'decision',
    title: 'Use the capability registry',
    content: 'All capability execution is server-authoritative.',
    branch: 'main',
    confidence: 0.95,
    approvalState: 'approved',
    freshnessState: 'current',
    isProtected: true,
    tags: ['architecture'],
    updatedAt: '2026-08-25T12:00:00.000Z'
  },
  {
    id: 'gotcha-1',
    kind: 'gotcha',
    title: 'Approval digest changes',
    content: 'Mutating the proposed scope invalidates approval.',
    branch: 'feature',
    confidence: 0.8,
    approvalState: 'proposed',
    freshnessState: 'possibly_stale',
    tags: ['security'],
    updatedAt: '2026-08-25T13:00:00.000Z'
  }
];

describe('profile expansion workspace panels', () => {
  it('filters and manages project memory without silently approving proposals', async () => {
    const user = userEvent.setup();
    const approve = vi.fn();
    const reject = vi.fn();
    const protect = vi.fn();
    const exportMarkdown = vi.fn();
    render(
      <MemoryCenterPanel
        memories={memories}
        onApproveProposal={approve}
        onRejectProposal={reject}
        onSetProtected={protect}
        onExportMarkdown={exportMarkdown}
      />
    );

    await user.click(screen.getByRole('tab', { name: /Proposals/ }));
    expect(screen.getByText('Approval digest changes')).toBeTruthy();
    expect(screen.queryByText('Use the capability registry')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await user.click(screen.getByRole('button', { name: 'Protect' }));
    expect(approve).toHaveBeenCalledWith('gotcha-1');
    expect(reject).toHaveBeenCalledWith('gotcha-1');
    expect(protect).toHaveBeenCalledWith('gotcha-1', true);

    await user.click(screen.getByRole('tab', { name: /All Memories/ }));
    await user.type(screen.getByLabelText('Search memories'), 'architecture');
    expect(screen.getByText('Use the capability registry')).toBeTruthy();
    expect(screen.queryByText('Approval digest changes')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Unprotect' }));
    expect(protect).toHaveBeenCalledWith('decision-1', false);
    await user.click(screen.getByRole('button', { name: 'Export MEMORY.md' }));
    expect(exportMarkdown).toHaveBeenCalledTimes(1);

    await user.clear(screen.getByLabelText('Search memories'));
    await user.type(screen.getByLabelText('Search memories'), 'missing');
    expect(screen.getByText('No memory records match the selected filter.')).toBeTruthy();
  });

  it('navigates architecture cards and saves or cancels human notes', async () => {
    const user = userEvent.setup();
    const selectCard = vi.fn();
    const updateNotes = vi.fn();
    const cards: ArchitectureCardModel[] = [
      {
        id: 'registry', subsystem: 'capabilities', title: 'Capability Registry',
        purpose: 'Authoritative capability discovery and policy.',
        sourceFiles: [{ filePath: 'src/registry.ts', fileDigest: 'abc', sizeBytes: 10 }],
        keySymbols: [{ name: 'CapabilityRegistry', kind: 'class', filePath: 'src/registry.ts' }],
        cruxExcerpts: [{ filePath: 'src/registry.ts', startLine: 1, endLine: 3, codeSnippet: 'class CapabilityRegistry {}', explanation: 'Policy boundary' }],
        typedLinks: [], entrypoints: ['server'], tests: ['registry.test.ts'], risksAndGotchas: ['Default deny'],
        humanNotes: 'Existing note'
      },
      {
        id: 'jobs', subsystem: 'jobs', title: 'Job Runtime', purpose: 'Runs staged jobs.',
        sourceFiles: [], keySymbols: [], cruxExcerpts: [], typedLinks: [], entrypoints: [], tests: [], risksAndGotchas: []
      }
    ];
    render(<RepositoryArchitectureView cards={cards} onSelectCard={selectCard} onUpdateNotes={updateNotes} />);

    expect(screen.getByText('CapabilityRegistry')).toBeTruthy();
    expect(screen.getByText('Risks & Gotchas')).toBeTruthy();
    await user.click(screen.getByText('Job Runtime').closest('button') as HTMLButtonElement);
    expect(selectCard).toHaveBeenCalledWith('jobs');
    await user.click(screen.getByRole('button', { name: 'Add Notes' }));
    await user.type(screen.getByRole('textbox', { name: '' }), 'Runtime note');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateNotes).toHaveBeenCalledWith('jobs', 'Runtime note');
    await user.click(screen.getByRole('button', { name: 'Add Notes' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.type(screen.getByLabelText('Filter architecture cards'), 'not present');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Job Runtime' })).toBeTruthy();
  });

  it('loads companion capability state and persists only explicit context', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ available: true, message: 'ready', features: {}, consent: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    render(<DesktopCompanionPanel />);

    await user.click(screen.getByRole('button', { name: /Desktop companion/ }));
    await waitFor(() => expect(screen.getByText('Connected')).toBeTruthy());
    const input = screen.getByPlaceholderText('Paste an approved transcript or screen summary...');
    const store = screen.getByRole('button', { name: 'Store approved context' });
    expect((store as HTMLButtonElement).disabled).toBe(true);
    await user.type(input, 'Approved transcript');
    await user.click(store);
    await waitFor(() => expect(screen.getByText('Context accepted with explicit persistence.')).toBeTruthy());
    expect(fetchMock).toHaveBeenLastCalledWith('/api/desktop-companion/context', expect.objectContaining({ method: 'POST' }));
    expect((input as HTMLTextAreaElement).value).toBe('');
  });

  it('renders website previews and reports invalid project JSON', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ project: { name: 'Saved', pages: [] }, html: '<main>safe preview</main>' })
    }));
    render(<WebsiteWorkspacePanel />);
    await user.click(screen.getByRole('button', { name: /Website workspace/ }));
    await user.click(screen.getByRole('button', { name: 'Save and preview' }));
    await waitFor(() => expect(screen.getByText('Saved locally and rendered in the sandbox.')).toBeTruthy());
    const frame = screen.getByTitle('Website preview');
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.getAttribute('srcdoc')).toBe('<main>safe preview</main>');

    const editor = screen.getByRole('textbox');
    await user.clear(editor);
    await user.type(editor, 'invalid');
    await user.click(screen.getByRole('button', { name: 'Save and preview' }));
    expect(await screen.findByText(/JSON|Unexpected/i)).toBeTruthy();
  });

  it('requires a fresh document review token before saving transformed content', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'review-1', findings: [{ id: 'f1', severity: 'warning', line: 2, message: 'Long sentence', suggestion: 'Split it.' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: 'Concise draft.' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'review-2', findings: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ path: 'docs/draft.md', chunks: 2 }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<DocumentWorkspacePanel />);

    await user.click(screen.getByRole('button', { name: /Document review workspace/ }));
    const content = screen.getByPlaceholderText('Write or paste a knowledge-base document...');
    const save = screen.getByRole('button', { name: 'Save reviewed' }) as HTMLButtonElement;
    await user.type(content, 'A draft sentence that needs review.');
    await user.click(screen.getByRole('button', { name: 'Review draft' }));
    await waitFor(() => expect(screen.getByText('Long sentence')).toBeTruthy());
    expect(save.disabled).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Concise' }));
    await waitFor(() => expect((content as HTMLTextAreaElement).value).toBe('Concise draft.'));
    expect(save.disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Review it again');

    await user.click(screen.getByRole('button', { name: 'Review draft' }));
    await waitFor(() => expect(save.disabled).toBe(false));
    await user.click(save);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Saved docs/draft.md with 2 knowledge chunks'));
  });
});
