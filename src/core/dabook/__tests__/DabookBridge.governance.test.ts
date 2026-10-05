import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DabookBridge, DabookError, NativeRunner } from '../DabookBridge';
import { DabookConfig } from '../DabookConfig';

const SHA = 'a'.repeat(64);
const book = (extra: Record<string, unknown> = {}) => ({
  book_id: 1, sha256: SHA, source_path: 'C:/b.pdf', title: 'T', pages: 8, doc_type: 'native', state: 'done', quality_score: 0.97,
  license_status: 'owned', review_status: 'approved', warnings: [], error: null, datasets: { sft: 'books/x/sft.jsonl' }, counts: { sft: 3 },
  splits: { sft: { train: 'books/x/splits/train/sft.jsonl' } }, ...extra
});

describe('DabookBridge governance commands', () => {
  let dir: string;
  let workspace: string;
  let python: string;
  let calls: string[][];
  type Reply = { exitCode: number; stdout: string; stderr?: string };
  let respond: (args: string[]) => Reply | Promise<Reply>;
  let killTree: jest.Mock;

  const config = (): DabookConfig => ({
    enabled: false, // governance works on existing data even when ingestion is switched off
    workspace, profile: 'balanced', timeoutMs: 600_000, dashboard: false,
    interpreterCandidates: [{ source: 'DABOOK_PYTHON', path: python }], warnings: []
  });

  const bridge = () => {
    const runner: NativeRunner = async (_exe, args, options) => {
      if (args[0] === '-c') return { exitCode: 0, stdout: '1.1.0', stderr: '', durationMs: 1 };
      calls.push(args);
      options?.onSpawn?.({ pid: 777 } as any);
      const out = await respond(args);
      return { stderr: '', durationMs: 1, ...out };
    };
    return new DabookBridge({ config: config(), runner, killTree });
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dabook-gov-'));
    workspace = path.join(dir, 'ws');
    python = path.join(dir, 'python.exe');
    fs.writeFileSync(python, '');
    fs.mkdirSync(workspace, { recursive: true });
    calls = [];
    killTree = jest.fn();
    respond = () => ({ exitCode: 0, stdout: '{}' });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('lists books together with the export policy', async () => {
    respond = () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        schema: 'dabook.books.v1', dabook_version: '1.1.0', workspace,
        policy: { training_licenses: ['owned', 'permissive', 'public_domain'], quality_verified: 0.95, review_statuses: ['unreviewed', 'approved', 'rejected'] },
        books: [book()]
      })
    });
    const report = await bridge().listBooks();
    expect(calls[0]).toEqual(['-m', 'dabook', 'books', '-w', workspace, '--json']);
    expect(report.policy.quality_verified).toBe(0.95);
    expect(report.books[0].splits?.sft?.train).toContain('splits/train');
    expect(report.books[0].review_status).toBe('approved');
  });

  it('builds exact argument vectors for license, review and recompile', async () => {
    const b = bridge();
    respond = () => ({ exitCode: 0, stdout: JSON.stringify({ book_id: 1, sha256: SHA, license_status: 'owned' }) });
    await b.setLicense('abc123', 'owned');
    respond = () => ({ exitCode: 0, stdout: JSON.stringify({ sha256: SHA, pair_id: 'p', action: 'reject', at: 1 }) });
    await b.reviewDecision('abc123', 'p', 'reject', 'wrong answer');
    await b.reviewDecision('abc123', 'p', 'reject');
    respond = () => ({ exitCode: 0, stdout: JSON.stringify({ book_id: 1, sha256: SHA, review_status: 'approved' }) });
    await b.reviewBook('abc123', 'approved');
    respond = () => ({ exitCode: 0, stdout: JSON.stringify({ replanned: { pending: 1 }, book: book() }) });
    await b.recompile('abc123');

    const tail = ['-w', workspace, '--json'];
    expect(calls).toEqual([
      ['-m', 'dabook', 'license', 'abc123', 'owned', ...tail],
      ['-m', 'dabook', 'review', 'decide', 'abc123', 'p', 'reject', '--reason', 'wrong answer', ...tail],
      ['-m', 'dabook', 'review', 'decide', 'abc123', 'p', 'reject', ...tail],
      ['-m', 'dabook', 'review', 'book', 'abc123', 'approved', ...tail],
      ['-m', 'dabook', 'recompile', 'abc123', ...tail]
    ]);
  });

  it('samples pairs for review with a deterministic seed', async () => {
    respond = () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        book: { book_id: 1, sha256: SHA, title: 'T', review_status: 'unreviewed', license_status: 'owned' },
        total_pairs: 12, decided: 1,
        sample: [{ pair_id: 'a1', category: 'qa', question: 'Q?', answer: 'A.', evidence: 'E', pages: [3, 3], breadcrumbs: ['Ch 1'], source_excerpt: 'src', generator: 'assist:m', grounding: { overlap: 0.9 }, decision: null }]
      })
    });
    const sample = await bridge().reviewSample('abc123', { count: 5, seed: 7 });
    expect(calls[0].slice(2, 8)).toEqual(['review', 'sample', 'abc123', '-n', '5', '--seed']);
    expect(calls[0][8]).toBe('7');
    expect(sample.sample[0]).toMatchObject({ pair_id: 'a1', source_excerpt: 'src', pages: [3, 3] });
    await bridge().reviewSample('abc123');
    expect(calls[1]).toEqual(expect.arrayContaining(['-n', '10', '--seed', '42']));
  });

  it('builds the export command, using --book once per book', async () => {
    respond = () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        schema: 'dabook.export.v1', dabook_version: '1.1.0', modes: ['sft'], formats: ['jsonl'], books: [], skipped_books: {},
        counts: { sft: { train: 1, val: 0, test: 0 } }, generators: { 'assist:m': 1 }, excluded_heuristic_records: 0, files: []
      })
    });
    await bridge().exportBundle({ outDir: path.join(dir, 'out'), books: ['1', '2'], modes: ['sft', 'code'], formats: ['jsonl', 'hf'], allowHeuristic: true, splits: false });
    expect(calls[0]).toEqual([
      '-m', 'dabook', 'export', '--out', path.join(dir, 'out'), '--modes', 'sft,code', '--format', 'jsonl,hf',
      '--no-splits', '--allow-heuristic', '--book', '1', '--book', '2', '-w', workspace, '--json'
    ]);
    await bridge().exportBundle({ outDir: 'o', modes: ['sft'], formats: ['jsonl'] });
    expect(calls[1]).not.toEqual(expect.arrayContaining(['--no-splits', '--allow-heuristic', '--book']));
  });

  describe('exit codes map to typed errors', () => {
    const fail = (exitCode: number, error: Record<string, unknown>) => {
      respond = () => ({ exitCode, stdout: JSON.stringify({ error }) });
    };

    it('exit 6 -> export_blocked, carrying the per-book reasons', async () => {
      fail(6, { code: 'export_blocked', message: 'Export refused: Book: license is copyrighted', details: { Book: ['license is copyrighted'] } });
      const error = await bridge().exportBundle({ outDir: 'o', modes: ['sft'], formats: ['jsonl'] }).catch(e => e);
      expect(error).toBeInstanceOf(DabookError);
      expect(error).toMatchObject({ reason: 'export_blocked', message: expect.stringContaining('copyrighted') });
      expect(error.details.blocked).toEqual({ Book: ['license is copyrighted'] });
    });

    it('exit 5 -> bad_args, exit 4 -> lock_held, anything else -> failed', async () => {
      fail(5, { code: 'bad_args', message: 'Unknown license status' });
      await expect(bridge().setLicense('x', 'owned')).rejects.toMatchObject({ reason: 'bad_args', message: 'Unknown license status' });
      fail(4, { code: 'lock_held', message: 'DABOOK is already running' });
      await expect(bridge().recompile('x')).rejects.toMatchObject({ reason: 'lock_held' });
      fail(9, { message: 'boom' });
      await expect(bridge().listBooks()).rejects.toMatchObject({ reason: 'failed', message: 'boom' });
      respond = () => ({ exitCode: 9, stdout: '{"nothing": true}' });
      await expect(bridge().listBooks()).rejects.toMatchObject({ reason: 'failed', message: expect.stringContaining('exited 9') });
    });

    it('rejects unusable output as bad_output (and still maps a locked workspace)', async () => {
      respond = () => ({ exitCode: 0, stdout: 'not json' });
      await expect(bridge().listBooks()).rejects.toMatchObject({ reason: 'bad_output' });
      respond = () => ({ exitCode: 4, stdout: '' });
      await expect(bridge().listBooks()).rejects.toMatchObject({ reason: 'lock_held' });
      respond = () => ({ exitCode: 0, stdout: JSON.stringify({ schema: 'dabook.books.v1' }) });
      await expect(bridge().listBooks()).rejects.toMatchObject({ reason: 'bad_output', message: expect.stringContaining('invalid') });
    });

    it('kills the process tree on timeout and reports it', async () => {
      respond = () => Promise.reject(new Error('Native command timed out after 60000ms: python'));
      await expect(bridge().listBooks()).rejects.toMatchObject({ reason: 'timeout' });
      expect(killTree).toHaveBeenCalledWith(777);
      respond = () => Promise.reject(new Error('EPERM'));
      await expect(bridge().listBooks()).rejects.toMatchObject({ reason: 'spawn_error' });
    });

    it('reports a missing interpreter', async () => {
      const none = new DabookBridge({ config: { ...config(), interpreterCandidates: [{ source: 'managed-venv', path: path.join(dir, 'gone') }] }, runner: jest.fn() as any });
      await expect(none.listBooks()).rejects.toMatchObject({ reason: 'interpreter_not_found' });
    });
  });

  it('serializes governance commands with ingests (one writer at a time)', async () => {
    let active = 0;
    let peak = 0;
    respond = async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 15));
      active -= 1;
      return { exitCode: 0, stdout: JSON.stringify({ book_id: 1, sha256: SHA, license_status: 'owned' }) };
    };
    const b = bridge();
    await Promise.all([b.setLicense('1', 'owned'), b.setLicense('2', 'owned'), b.setLicense('3', 'owned')]);
    expect(peak).toBe(1);
  });

  it('reads JSONL datasets with optional validation and refuses path escapes', async () => {
    const rel = 'books/x/sft.jsonl';
    fs.mkdirSync(path.join(workspace, 'books', 'x'), { recursive: true });
    fs.writeFileSync(path.join(workspace, rel), '{"id":1}\n\n{"id":2}\n');
    const b = bridge();
    expect(await b.readJsonl(rel)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(await b.readJsonl<number>(rel, (value: any) => value.id * 10)).toEqual([10, 20]);
    fs.writeFileSync(path.join(workspace, rel), '{"id":1}\n{broken\n');
    await expect(b.readJsonl(rel)).rejects.toMatchObject({ reason: 'bad_output', message: expect.stringContaining('line 2') });
    await expect(b.readJsonl('../outside.jsonl')).rejects.toMatchObject({ reason: 'bad_output' });
  });
});
