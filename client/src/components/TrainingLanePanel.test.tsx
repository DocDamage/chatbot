import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrainingLanePanel, trainingBlockers } from './TrainingLanePanel';

const SHA_READY = 'a'.repeat(64);
const SHA_UNKNOWN = 'b'.repeat(64);
const SHA_COPY = 'c'.repeat(64);

const policy = { training_licenses: ['owned', 'permissive', 'public_domain'] as const, quality_verified: 0.95 };
const bookOf = (over: Record<string, unknown>) => ({
  book_id: 1, sha256: SHA_READY, title: 'Ready Book', source_path: 'C:/ready.pdf', state: 'done', quality_score: 0.97,
  license_status: 'owned', review_status: 'unreviewed', counts: { sft: 12 }, ...over
});
const books = [
  bookOf({}),
  bookOf({ book_id: 2, sha256: SHA_UNKNOWN, title: 'Unlicensed Book', license_status: 'unknown', counts: { sft: 4 } }),
  bookOf({ book_id: 3, sha256: SHA_COPY, title: 'Copyrighted Book', license_status: 'copyrighted', counts: {} })
];

const sample = {
  book: { sha256: SHA_READY, title: 'Ready Book', review_status: 'unreviewed' },
  total_pairs: 12,
  decided: 0,
  sample: [{
    pair_id: '1234567890abcdef', category: 'qa', question: 'How does the tool repair a boot sector?',
    answer: 'It rebuilds the boot sector from a backup copy of that sector.', evidence: 'rebuilds the boot sector from a backup copy',
    pages: [3, 4], breadcrumbs: ['Chapter 1', 'Setup'], source_excerpt: 'The tool scans the partition table and rebuilds the boot sector.',
    generator: 'assist:test', decision: null
  }]
};

const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: vi.fn().mockResolvedValue(data) }) as unknown as Response;

function installFetch(overrides: Record<string, (init?: RequestInit) => Response> = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const key = `${init?.method ?? 'GET'} ${url.split('?')[0]}`;
    if (overrides[key]) return overrides[key](init);
    if (key === 'GET /api/knowledge-base/dabook/books') return json({ books, policy });
    if (key === 'GET /api/knowledge-base/dabook/review/sample') return json(sample);
    if (key.startsWith('POST /api/knowledge-base/dabook/')) return json({ ok: true });
    throw new Error(`Unhandled fetch: ${key}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const posted = (fetchMock: ReturnType<typeof installFetch>, endpoint: string) =>
  fetchMock.mock.calls
    .filter(([url, init]) => String(url) === `/api/knowledge-base/dabook/${endpoint}` && init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init?.body)));

describe('trainingBlockers', () => {
  const ready = bookOf({}) as any;
  it('is empty for a training-ready book and explains every blocker otherwise', () => {
    expect(trainingBlockers(ready, policy as any)).toEqual([]);
    expect(trainingBlockers({ ...ready, license_status: 'unknown' }, policy as any)).toEqual(['license is unknown']);
    expect(trainingBlockers({ ...ready, license_status: null }, policy as any)).toEqual(['license is unknown']);
    expect(trainingBlockers({ ...ready, quality_score: 0.5 }, policy as any)).toEqual(['needs review']);
    expect(trainingBlockers({ ...ready, quality_score: null }, policy as any)).toEqual(['needs review']);
    expect(trainingBlockers({ ...ready, quality_score: 0.5, review_status: 'approved' }, policy as any)).toEqual([]);
    expect(trainingBlockers({ ...ready, review_status: 'rejected' }, policy as any)).toEqual(['rejected in review']);
    expect(trainingBlockers({ ...ready, state: 'failed', license_status: 'copyrighted' }, policy as any)).toEqual(['state is failed', 'license is copyrighted']);
  });
});

describe('TrainingLanePanel', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('lists books with their license, review state and whether they can be used for training', async () => {
    installFetch();
    render(<TrainingLanePanel />);

    await screen.findByText('Ready Book');
    expect(screen.getByText('Training-ready')).toBeTruthy();
    expect(screen.getByText('RAG only: license is unknown')).toBeTruthy();
    expect(screen.getByText('RAG only: license is copyrighted')).toBeTruthy();
    expect((screen.getByLabelText('License for Ready Book') as HTMLSelectElement).value).toBe('owned');
    expect((screen.getByLabelText('License for Copyrighted Book') as HTMLSelectElement).value).toBe('copyrighted');
    expect(screen.getByText('12 sft pairs')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Review Copyrighted Book' }) as HTMLButtonElement).disabled).toBe(true); // no pairs
  });

  it('saves a license change and reloads the books', async () => {
    const fetchMock = installFetch();
    const user = userEvent.setup();
    render(<TrainingLanePanel />);
    await screen.findByText('Unlicensed Book');

    await user.selectOptions(screen.getByLabelText('License for Unlicensed Book'), 'public_domain');

    await waitFor(() => expect(posted(fetchMock, 'license')).toEqual([{ book: SHA_UNKNOWN, status: 'public_domain' }]));
    await screen.findByText('License set to public_domain');
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/dabook/books'))).toHaveLength(2);
  });

  it('shows pairs next to their source, records decisions, and applies rejections', async () => {
    const fetchMock = installFetch();
    const user = userEvent.setup();
    render(<TrainingLanePanel />);
    await screen.findByText('Ready Book');

    await user.click(screen.getByRole('button', { name: 'Review Ready Book' }));
    const review = await screen.findByRole('region', { name: 'Review' });
    expect(within(review).getByText('0 of 12 pairs decided · showing 1')).toBeTruthy();
    expect(within(review).getByText('How does the tool repair a boot sector?')).toBeTruthy();
    expect(within(review).getByText('p. 3–4 · Chapter 1 › Setup · qa')).toBeTruthy();
    expect(within(review).getByText('Evidence: rebuilds the boot sector from a backup copy')).toBeTruthy();
    expect(within(review).getByText('The tool scans the partition table and rebuilds the boot sector.')).toBeTruthy(); // excerpt
    expect(String(fetchMock.mock.calls.find(([u]) => String(u).includes('review/sample'))![0])).toContain(`book=${SHA_READY}&n=10&seed=42`);

    await user.click(within(review).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(posted(fetchMock, 'review/decision')).toEqual([{ book: SHA_READY, pairId: '1234567890abcdef', decision: 'reject' }]));
    await within(review).findByText('rejected');
    expect(within(review).getByText('1 of 12 pairs decided · showing 1')).toBeTruthy();
    expect(within(review).getByRole('button', { name: 'Reject' }).getAttribute('aria-pressed')).toBe('true');

    await user.click(within(review).getByRole('button', { name: 'Apply rejections' }));
    await screen.findByText('Rejected pairs removed from the dataset');
    expect(posted(fetchMock, 'recompile')).toEqual([{ book: SHA_READY }]);

    await user.click(within(review).getByRole('button', { name: 'Approve book' }));
    await screen.findByText('Book approved');
    expect(posted(fetchMock, 'review/book')).toEqual([{ book: SHA_READY, status: 'approved' }]);
    await user.click(within(review).getByRole('button', { name: 'Reject book' }));
    await waitFor(() => expect(posted(fetchMock, 'review/book')).toHaveLength(2));
  });

  it('draws another sample with the next seed', async () => {
    const fetchMock = installFetch();
    const user = userEvent.setup();
    render(<TrainingLanePanel />);
    await user.click(await screen.findByRole('button', { name: 'Review Ready Book' }));
    await screen.findByRole('region', { name: 'Review' });
    await user.click(screen.getByRole('button', { name: 'Another sample' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('review/sample'))).toHaveLength(2));
    expect(String(fetchMock.mock.calls.filter(([u]) => String(u).includes('review/sample'))[1][0])).toContain('seed=43');
  });

  describe('export', () => {
    it('exports with the chosen modes and formats and summarises the bundle and its audit', async () => {
      const manifest = {
        counts: { sft: { train: 9, val: 1, test: 0 }, code: { train: 2, val: 0, test: 0 } },
        governance: { embeddedEvaluationScan: { matches: 0 }, evaluation: { items: 130 } }
      };
      const fetchMock = installFetch({ 'POST /api/knowledge-base/dabook/training-export': () => json({ bundleDir: 'data/training-exports/20261005T120000Z-ab12', manifest }) });
      const user = userEvent.setup();
      render(<TrainingLanePanel />);
      await screen.findByText('Ready Book');

      const exportSection = screen.getByRole('region', { name: 'Export' });
      await user.click(within(exportSection).getByLabelText('code'));
      await user.click(within(exportSection).getByLabelText('parquet'));
      await user.click(within(exportSection).getByRole('button', { name: 'Export training bundle' }));

      await screen.findByText('Exported to data/training-exports/20261005T120000Z-ab12');
      expect(posted(fetchMock, 'training-export')).toEqual([{ modes: ['sft', 'code'], formats: ['jsonl', 'parquet'] }]);
      const result = await screen.findByLabelText('Export result');
      expect(within(result).getByText('sft: train 9 / val 1 / test 0 · code: train 2 / val 0 / test 0')).toBeTruthy();
      expect(within(result).getByText('Contamination audit: 0 matches across 130 evaluation items')).toBeTruthy();
    });

    it('cannot export without a mode or a format', async () => {
      installFetch();
      const user = userEvent.setup();
      render(<TrainingLanePanel />);
      await screen.findByText('Ready Book');
      const exportSection = screen.getByRole('region', { name: 'Export' });
      const button = within(exportSection).getByRole('button', { name: 'Export training bundle' }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      await user.click(within(exportSection).getByLabelText('sft'));
      expect(button.disabled).toBe(true);
      await user.click(within(exportSection).getByLabelText('sft'));
      await user.click(within(exportSection).getByLabelText('jsonl'));
      expect(button.disabled).toBe(true);
    });

    it('explains a governance refusal, listing each blocked book and why', async () => {
      installFetch({
        'POST /api/knowledge-base/dabook/training-export': () => json({
          error: 'export_blocked', code: 'blocked', message: 'Export refused: Copyrighted Book: license is copyrighted',
          details: { blocked: { 'Copyrighted Book': ['license is copyrighted', 'not reviewed'] } }
        }, 403)
      });
      const user = userEvent.setup();
      render(<TrainingLanePanel />);
      await screen.findByText('Ready Book');
      await user.click(screen.getByRole('button', { name: 'Export training bundle' }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('Export refused: Copyrighted Book: license is copyrighted');
      expect(within(alert).getByText('Copyrighted Book: license is copyrighted, not reviewed')).toBeTruthy();
      expect(screen.queryByLabelText('Export result')).toBeNull();
    });

    it('explains a contamination block with the overlapping items', async () => {
      installFetch({
        'POST /api/knowledge-base/dabook/training-export': () => json({
          error: 'contaminated', code: 'contaminated', message: 'Export blocked: training data overlaps held-out evaluation sets',
          details: { governance: { matchSamples: [{ evaluationId: 'eval:cases.json#q1:query', recordId: 'dabook:aaaa:sft:sft_1' }] } }
        }, 409)
      });
      const user = userEvent.setup();
      render(<TrainingLanePanel />);
      await screen.findByText('Ready Book');
      await user.click(screen.getByRole('button', { name: 'Export training bundle' }));
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('overlaps held-out evaluation sets');
      expect(within(alert).getByText('dabook:aaaa:sft:sft_1 overlaps eval:cases.json#q1:query')).toBeTruthy();
    });
  });

  it('reports an unreachable backend and a failing license save', async () => {
    installFetch({ 'GET /api/knowledge-base/dabook/books': () => json({ error: 'interpreter_not_found', message: 'No Python interpreter with DABOOK installed was found' }, 503) });
    render(<TrainingLanePanel />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No Python interpreter with DABOOK installed was found');

    cleanup();
    installFetch({ 'POST /api/knowledge-base/dabook/license': () => json({ error: 'bad_args', message: 'Unknown license status' }, 400) });
    const user = userEvent.setup();
    render(<TrainingLanePanel />);
    await screen.findByText('Ready Book');
    await user.selectOptions(screen.getByLabelText('License for Ready Book'), 'permissive');
    expect((await screen.findByRole('alert')).textContent).toContain('Unknown license status');
  });

  it('says so when there are no books, and survives a non-JSON error body', async () => {
    installFetch({ 'GET /api/knowledge-base/dabook/books': () => json({ books: [], policy }) });
    render(<TrainingLanePanel />);
    await screen.findByText('No DABOOK books yet.');

    cleanup();
    const broken = { ok: false, status: 500, json: vi.fn().mockRejectedValue(new Error('not json')) } as unknown as Response;
    installFetch({ 'GET /api/knowledge-base/dabook/books': () => broken });
    render(<TrainingLanePanel />);
    expect((await screen.findByRole('alert')).textContent).toContain('HTTP 500');
  });
});
