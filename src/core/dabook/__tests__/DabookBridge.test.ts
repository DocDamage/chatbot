import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DabookBridge, DabookError, NativeRunner } from '../DabookBridge';
import { DabookConfig } from '../DabookConfig';
import { DABOOK_SCHEMA_ID } from '../DabookContract';

const SHA = 'a'.repeat(64);

function bookReport(overrides: Record<string, unknown> = {}) {
  return {
    book_id: 1,
    sha256: SHA,
    source_path: '',
    title: 'Disk Recovery Handbook',
    pages: 8,
    doc_type: 'native',
    state: 'done',
    quality_score: 0.97,
    license_status: 'unknown',
    warnings: [],
    error: null,
    datasets: { rag: 'books/aaaaaaaaaaaa/datasets/rag.jsonl', raw: 'books/aaaaaaaaaaaa/datasets/raw.jsonl' },
    counts: { rag: 6, raw: 30 },
    ...overrides
  };
}

describe('DabookBridge', () => {
  let dir: string;
  let pdf: string;
  let python: string;
  let workspace: string;
  let config: DabookConfig;

  const run = (stdout: string, exitCode = 0, stderr = '') => ({ exitCode, stdout, stderr, durationMs: 5 });
  const reportJson = (book: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => JSON.stringify({
    schema: DABOOK_SCHEMA_ID,
    dabook_version: '1.1.0',
    workspace,
    books: [bookReport({ source_path: pdf, ...book })],
    ...extra
  });

  /** Runner that answers the interpreter probe and delegates `ingest` to `onIngest`. */
  const makeRunner = (onIngest: (args: string[], options: any) => ReturnType<typeof run> | Promise<ReturnType<typeof run>>) => {
    const calls: Array<{ exe: string; args: string[]; options: any }> = [];
    const runner: NativeRunner = async (exe, args, options) => {
      calls.push({ exe, args, options });
      if (args[0] === '-c') return run('1.1.0\n');
      if (args.includes('doctor')) {
        return run(JSON.stringify({ ok: true, dabook_version: '1.1.0', checks: [{ name: 'Python version', ok: true }] }));
      }
      return onIngest(args, options);
    };
    return { runner, calls };
  };

  const bridge = (runner: NativeRunner, overrides: Partial<DabookConfig> = {}, extra: Record<string, unknown> = {}) =>
    new DabookBridge({ config: { ...config, ...overrides }, runner, ...extra });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dabook-bridge-'));
    pdf = path.join(dir, 'book.pdf');
    python = path.join(dir, 'python.exe');
    workspace = path.join(dir, 'workspace');
    fs.writeFileSync(pdf, '%PDF-1.4');
    fs.writeFileSync(python, '');
    fs.mkdirSync(workspace, { recursive: true });
    config = {
      enabled: true,
      workspace,
      profile: 'balanced',
      timeoutMs: 60_000,
      dashboard: false,
      interpreterCandidates: [{ source: 'DABOOK_PYTHON', path: python }],
      warnings: []
    };
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('ingest', () => {
    it('invokes `dabook ingest` with a safe argument vector and returns the validated book', async () => {
      const { runner, calls } = makeRunner(() => run(reportJson()));
      const result = await bridge(runner).ingest(pdf, { licenseStatus: 'owned', modes: ['rag', 'sft'], profile: 'accurate' });

      expect(result.book.sha256).toBe(SHA);
      expect(result.book.datasets.rag).toContain('rag.jsonl');
      expect(result.workspace).toBe(workspace);
      expect(result.report.dabook_version).toBe('1.1.0');

      const ingest = calls.find(call => call.args.includes('ingest'))!;
      expect(ingest.exe).toBe(python);
      expect(ingest.args).toEqual([
        '-m', 'dabook', 'ingest',
        '-w', workspace,
        '--json',
        '--profile', 'accurate',
        '--modes', 'rag,sft',
        '--timeout-s', '55',
        '--lock-wait-s', '30',
        '--license', 'owned',
        '--',
        path.resolve(pdf)
      ]);
      // a path can never be mistaken for an option, and nothing runs through a shell
      expect(ingest.args[ingest.args.length - 2]).toBe('--');
      expect(ingest.options.env.PYTHONUTF8).toBe('1');
      expect(ingest.options.timeoutMs).toBe(60_000 + 25_000);
    });

    it('defaults to the configured profile and the rag+raw datasets', async () => {
      const { runner, calls } = makeRunner(() => run(reportJson()));
      await bridge(runner, { profile: 'fast' }).ingest(pdf);
      const args = calls.find(call => call.args.includes('ingest'))!.args;
      expect(args).toEqual(expect.arrayContaining(['--profile', 'fast', '--modes', 'rag,raw']));
      expect(args).not.toContain('--license');
    });

    it.each([
      [2, 'needs_input', { state: 'needs_input', error: 'Scanned PDF: OCR is not implemented' }],
      [3, 'failed', { state: 'failed', error: 'corrupt_pdf: not a readable PDF' }],
      [9, 'failed', { state: 'failed', error: 'boom' }]
    ])('maps exit code %i to a %s error carrying the report', async (exitCode, reason, book) => {
      const { runner } = makeRunner(() => run(reportJson({ ...book, datasets: {}, counts: {} }), exitCode));
      const error = await bridge(runner).ingest(pdf).catch(e => e);
      expect(error).toBeInstanceOf(DabookError);
      expect(error.reason).toBe(reason);
      expect(error.message).toContain(String(book.error));
      expect(error.details.exitCode).toBe(exitCode);
      expect(error.details.book.state).toBe(book.state);
    });

    it('maps exit 4 (workspace locked) and exit 5 (bad args) using the JSON error document', async () => {
      const doc = (code: string, message: string) => JSON.stringify({
        schema: DABOOK_SCHEMA_ID, dabook_version: '1.1.0', books: [], error: { code, message }
      });
      const locked = makeRunner(() => run(doc('lock_held', 'DABOOK is already running'), 4));
      await expect(bridge(locked.runner).ingest(pdf)).rejects.toMatchObject({ reason: 'lock_held', message: 'DABOOK is already running' });

      const bad = makeRunner(() => run(doc('bad_args', 'unknown profile'), 5));
      await expect(bridge(bad.runner).ingest(pdf)).rejects.toMatchObject({ reason: 'bad_args', message: 'unknown profile' });
    });

    it('still reports lock_held from the exit code when the output is unusable', async () => {
      const { runner } = makeRunner(() => run('', 4, 'locked'));
      await expect(bridge(runner).ingest(pdf)).rejects.toMatchObject({ reason: 'lock_held' });
    });

    it.each([
      ['empty stdout', ''],
      ['log noise instead of JSON', 'Supervisor starting...\n'],
      ['two documents', `${reportJson()}\n${reportJson()}`]
    ])('rejects malformed output (%s) as bad_output', async (_name, stdout) => {
      const { runner } = makeRunner(() => run(stdout, 0, 'stderr tail'));
      const error = await bridge(runner).ingest(pdf).catch(e => e);
      expect(error.reason).toBe('bad_output');
      expect(error.details.stderr).toBe('stderr tail');
    });

    it('rejects a document that does not match the dabook.ingest.v1 schema', async () => {
      const wrongSchema = JSON.stringify({ schema: 'something.else', dabook_version: '1', books: [] });
      await expect(bridge(makeRunner(() => run(wrongSchema)).runner).ingest(pdf)).rejects.toMatchObject({ reason: 'bad_output' });

      const badBook = JSON.stringify({ schema: DABOOK_SCHEMA_ID, dabook_version: '1', books: [{ book_id: 1 }] });
      await expect(bridge(makeRunner(() => run(badBook)).runner).ingest(pdf)).rejects.toMatchObject({ reason: 'bad_output' });
    });

    it('treats a "done" book without a rag dataset, or no books at all, as bad_output', async () => {
      const noRag = makeRunner(() => run(reportJson({ datasets: {}, counts: {} })));
      await expect(bridge(noRag.runner).ingest(pdf)).rejects.toMatchObject({ reason: 'bad_output' });

      const empty = makeRunner(() => run(JSON.stringify({ schema: DABOOK_SCHEMA_ID, dabook_version: '1', books: [] })));
      await expect(bridge(empty.runner).ingest(pdf)).rejects.toMatchObject({ reason: 'bad_output' });
    });

    it('accepts a book in the review state (low quality but usable)', async () => {
      const { runner } = makeRunner(() => run(reportJson({ state: 'review', warnings: ['needs_review'] })));
      const result = await bridge(runner).ingest(pdf);
      expect(result.book.state).toBe('review');
      expect(result.book.warnings).toEqual(['needs_review']);
    });

    it('kills the whole process tree and reports a timeout when the runner times out', async () => {
      const killTree = jest.fn();
      const runner: NativeRunner = async (_exe, args, options) => {
        if (args[0] === '-c') return run('1.1.0');
        options?.onSpawn?.({ pid: 4242 } as any);
        throw new Error('Native command timed out after 85000ms: python');
      };
      const error = await bridge(runner, {}, { killTree }).ingest(pdf).catch(e => e);
      expect(error.reason).toBe('timeout');
      expect(error.message).toContain('60s');
      expect(killTree).toHaveBeenCalledWith(4242);
    });

    it('reports a vanished interpreter as interpreter_not_found and forgets the cached probe', async () => {
      let ingestCalls = 0;
      const runner: NativeRunner = async (_exe, args) => {
        if (args[0] === '-c') return run('1.1.0');
        ingestCalls += 1;
        throw Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' });
      };
      const instance = bridge(runner);
      await expect(instance.ingest(pdf)).rejects.toMatchObject({ reason: 'interpreter_not_found' });
      await expect(instance.ingest(pdf)).rejects.toMatchObject({ reason: 'interpreter_not_found' });
      expect(ingestCalls).toBe(2);
    });

    it('wraps unexpected spawn failures', async () => {
      const runner: NativeRunner = async (_exe, args) => {
        if (args[0] === '-c') return run('1.1.0');
        throw new Error('EPERM: operation not permitted');
      };
      await expect(bridge(runner).ingest(pdf)).rejects.toMatchObject({ reason: 'spawn_error' });
    });

    it('refuses to run when disabled, for non-PDFs, or without an interpreter', async () => {
      const { runner, calls } = makeRunner(() => run(reportJson()));
      await expect(bridge(runner, { enabled: false }).ingest(pdf)).rejects.toMatchObject({ reason: 'disabled' });
      await expect(bridge(runner).ingest(path.join(dir, 'notes.txt'))).rejects.toMatchObject({ reason: 'bad_args' });
      expect(calls).toHaveLength(0);

      const none = bridge(runner, { interpreterCandidates: [{ source: 'managed-venv', path: path.join(dir, 'missing') }] });
      await expect(none.ingest(pdf)).rejects.toMatchObject({ reason: 'interpreter_not_found' });
    });

    it('serializes concurrent calls (DABOOK holds a single-writer workspace lock)', async () => {
      let active = 0;
      let peak = 0;
      const order: string[] = [];
      const { runner } = makeRunner(async args => {
        active += 1;
        peak = Math.max(peak, active);
        order.push(args[args.length - 1]);
        await new Promise(resolve => setTimeout(resolve, 20));
        active -= 1;
        return run(reportJson({ source_path: args[args.length - 1] }));
      });
      const instance = bridge(runner);
      const other = path.join(dir, 'other.pdf');
      fs.writeFileSync(other, '%PDF');
      await Promise.all([instance.ingest(pdf), instance.ingest(other), instance.ingest(pdf)]);
      expect(peak).toBe(1);
      expect(order).toEqual([path.resolve(pdf), path.resolve(other), path.resolve(pdf)]);
    });

    it('keeps serving the queue after a failed call', async () => {
      let n = 0;
      const { runner } = makeRunner(() => (++n === 1 ? run('', 3) : run(reportJson())));
      const instance = bridge(runner);
      await expect(instance.ingest(pdf)).rejects.toBeInstanceOf(DabookError);
      await expect(instance.ingest(pdf)).resolves.toMatchObject({ book: { state: 'done' } });
    });

    it('matches the returned book to the requested file when a report lists several', async () => {
      const mine = bookReport({ book_id: 2, source_path: path.resolve(pdf), title: 'Mine' });
      const stdout = JSON.stringify({ schema: DABOOK_SCHEMA_ID, dabook_version: '1', books: [bookReport({ source_path: '/x/other.pdf' }), mine] });
      const { runner } = makeRunner(() => run(stdout));
      expect((await bridge(runner).ingest(pdf)).book.title).toBe('Mine');
    });
  });

  describe('interpreter resolution and health', () => {
    it('takes the first candidate that can import dabook and caches the result', async () => {
      const second = path.join(dir, 'py2.exe');
      const third = path.join(dir, 'py3.exe');
      fs.writeFileSync(second, '');
      fs.writeFileSync(third, '');
      const probed: string[] = [];
      const runner: NativeRunner = async (exe, args) => {
        probed.push(exe);
        if (exe === second) return run('', 1, 'ModuleNotFoundError: No module named dabook');
        return run('1.1.0');
      };
      const instance = bridge(runner, {
        interpreterCandidates: [
          { source: 'DABOOK_PYTHON', path: path.join(dir, 'missing.exe') },
          { source: 'CHATBOT_NATIVE_PYTHON', path: second },
          { source: 'managed-venv', path: third }
        ]
      });
      expect(await instance.resolveInterpreter()).toBe(third);
      expect(probed).toEqual([second, third]); // the missing file is never executed
      await instance.resolveInterpreter();
      expect(probed).toHaveLength(2); // cached
      await instance.resolveInterpreter(true);
      expect(probed).toHaveLength(4); // force re-probes
    });

    it('caches a failed probe briefly, then retries', async () => {
      let t = 1_000_000;
      let installed = false;
      const runner: NativeRunner = async () => (installed ? run('1.1.0') : run('', 1, 'No module named dabook'));
      const instance = bridge(runner, {}, { now: () => t });
      expect(await instance.resolveInterpreter()).toBeUndefined();
      installed = true;
      expect(await instance.resolveInterpreter()).toBeUndefined(); // negative cache
      t += 16_000;
      expect(await instance.resolveInterpreter()).toBe(python);
    });

    it('survives a probe that throws', async () => {
      const runner: NativeRunner = async () => { throw new Error('spawn blew up'); };
      const health = await bridge(runner).health();
      expect(health.available).toBe(false);
      expect(health.candidates[0]).toMatchObject({ exists: true, importable: false, error: 'spawn blew up' });
    });

    it('reports ready when enabled and importable', async () => {
      const { runner } = makeRunner(() => run(reportJson()));
      const health = await bridge(runner).health();
      expect(health).toMatchObject({ enabled: true, available: true, status: 'ready', interpreter: python, version: '1.1.0', workspace });
      expect(health.doctor).toBeUndefined();
      expect(health.candidates).toEqual([expect.objectContaining({ source: 'DABOOK_PYTHON', exists: true, importable: true, version: '1.1.0' })]);
    });

    it('lists every candidate, including why earlier ones were skipped and those never tried', async () => {
      const second = path.join(dir, 'py2.exe');
      const third = path.join(dir, 'py3.exe');
      fs.writeFileSync(second, '');
      fs.writeFileSync(third, '');
      const runner: NativeRunner = async exe => (exe === second ? run('', 1, 'No module named dabook') : run('1.1.0'));
      const health = await bridge(runner, {
        interpreterCandidates: [
          { source: 'DABOOK_PYTHON', path: path.join(dir, 'gone.exe') },
          { source: 'CHATBOT_NATIVE_PYTHON', path: second },
          { source: 'managed-venv', path: third }
        ]
      }).health();
      expect(health.interpreter).toBe(third);
      expect(health.candidates).toEqual([
        expect.objectContaining({ source: 'DABOOK_PYTHON', exists: false, error: 'file not found' }),
        expect.objectContaining({ source: 'CHATBOT_NATIVE_PYTHON', exists: true, importable: false, error: 'No module named dabook' }),
        expect.objectContaining({ source: 'managed-venv', importable: true, version: '1.1.0' })
      ]);
    });

    it('distinguishes installed-but-disabled from unavailable', async () => {
      const { runner } = makeRunner(() => run(reportJson()));
      const disabled = await bridge(runner, { enabled: false }).health();
      expect(disabled).toMatchObject({ available: true, status: 'disabled' });
      expect(disabled.reason).toContain('DABOOK_ENABLED');

      const missing = await bridge(runner, { interpreterCandidates: [{ source: 'managed-venv', path: path.join(dir, 'nope') }] }).health();
      expect(missing).toMatchObject({ available: false, status: 'unavailable' });
      expect(missing.reason).toContain('npm run setup:dabook');
      expect(missing.candidates).toEqual([expect.objectContaining({ exists: false, source: 'managed-venv', importable: false })]);

      const off = await bridge(runner, { enabled: false, interpreterCandidates: [{ source: 'managed-venv', path: path.join(dir, 'nope') }] }).health();
      expect(off.status).toBe('disabled');
    });

    it('includes the doctor report when asked, caches it, and downgrades on a failing required check', async () => {
      let doctorCalls = 0;
      let doctorOk = true;
      const runner: NativeRunner = async (_exe, args) => {
        if (args[0] === '-c') return run('1.1.0');
        doctorCalls += 1;
        return run(JSON.stringify({
          ok: doctorOk,
          dabook_version: '1.1.0',
          checks: [{ name: 'pypdfium2', ok: doctorOk, detail: 'x' }, { name: 'Port 8765', ok: false, required: false }]
        }));
      };
      const instance = bridge(runner);
      expect((await instance.health({ deep: true })).doctor?.ok).toBe(true);
      await instance.health({ deep: true });
      expect(doctorCalls).toBe(1);

      doctorOk = false;
      const failing = await instance.health({ deep: true, force: true });
      expect(failing).toMatchObject({ available: false, status: 'unavailable' });
      expect(failing.reason).toBe('dabook doctor failed: pypdfium2');
    });

    it('ignores an unusable doctor response', async () => {
      const runner: NativeRunner = async (_exe, args) => (args[0] === '-c' ? run('1.1.0') : run('not json'));
      const health = await bridge(runner).health({ deep: true });
      expect(health.available).toBe(true);
      expect(health.doctor).toBeUndefined();
    });

    it('reads the configuration lazily so environment changes apply', async () => {
      let enabled = false;
      const { runner } = makeRunner(() => run(reportJson()));
      const instance = new DabookBridge({ config: () => ({ ...config, enabled }), runner });
      expect(instance.isEnabled()).toBe(false);
      enabled = true;
      expect(instance.isEnabled()).toBe(true);
      expect(instance.config.workspace).toBe(workspace);
    });
  });

  describe('dataset access', () => {
    const ragLine = (n: number) => JSON.stringify({
      chunk_id: `c${n}`, book_sha256: SHA, book_title: 'T', page_start: 1, page_end: 2, breadcrumbs: ['A'],
      node_ids: ['p0_b0'], node_types: ['paragraph'], has_code: false, token_count: 12, quality: 0.9, content: `chunk ${n}`
    });
    const writeRag = (...lines: string[]) => {
      const file = path.join(workspace, 'books', 'aaaaaaaaaaaa', 'datasets', 'rag.jsonl');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, lines.join('\n'));
    };
    const book = () => ({ ...bookReport(), datasets: { rag: 'books/aaaaaaaaaaaa/datasets/rag.jsonl' } }) as any;
    const instance = () => bridge(makeRunner(() => run(reportJson())).runner);

    it('reads and validates rag.jsonl, skipping blank lines', async () => {
      writeRag(ragLine(0), '', ragLine(1), '');
      const records = await instance().readRagRecords({ book: book(), workspace });
      expect(records.map(r => r.chunk_id)).toEqual(['c0', 'c1']);
    });

    it('fails the whole read on an invalid or non-JSON line (no partial data)', async () => {
      writeRag(ragLine(0), '{not json');
      await expect(instance().readRagRecords({ book: book(), workspace })).rejects.toMatchObject({ reason: 'bad_output', message: expect.stringContaining('line 2') });
      writeRag(ragLine(0), JSON.stringify({ chunk_id: 'x' }));
      await expect(instance().readRagRecords({ book: book(), workspace })).rejects.toMatchObject({ reason: 'bad_output' });
    });

    it('requires a rag dataset path', async () => {
      await expect(instance().readRagRecords({ book: { ...book(), datasets: {} }, workspace })).rejects.toMatchObject({ reason: 'bad_output' });
    });

    it('refuses dataset paths that escape the workspace', () => {
      const b = instance();
      expect(() => b.resolveDatasetPath('../../etc/passwd', workspace)).toThrow(DabookError);
      expect(() => b.resolveDatasetPath(path.join(dir, 'outside.jsonl'), workspace)).toThrow(/escapes/);
      expect(b.resolveDatasetPath('books/x/rag.jsonl', workspace)).toBe(path.join(workspace, 'books', 'x', 'rag.jsonl'));
    });
  });
});
