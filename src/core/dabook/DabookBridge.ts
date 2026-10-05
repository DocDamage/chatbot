/**
 * DabookBridge: runs the DABOOK Python sidecar as a one-shot CLI and returns typed results.
 *
 * Why a subprocess and not HTTP: `dabook ingest --json` exits when it is done, so there is no
 * port, token or lifecycle to manage. The bridge only has to (1) find a working interpreter,
 * (2) serialize calls (DABOOK holds a single-writer workspace lock), and (3) turn exit codes and
 * output into either a validated result or a typed `DabookError` the extractor can fall back on.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { logger } from '../observability/logger';
import { NativeCommandOptions, NativeCommandResult, runNativeCommand } from '../native-runtime/NativeCommandRunner';
import {
  DABOOK_EXIT,
  DABOOK_LICENSE_STATUSES,
  DABOOK_REVIEW_STATUSES,
  DabookBookReport,
  DabookBooksReport,
  DabookDoctorReport,
  DabookExportFormat,
  DabookExportManifest,
  DabookIngestReport,
  DabookLicenseStatus,
  DabookRagRecord,
  DabookReviewSample,
  DabookTrainingMode,
  dabookBookSchema,
  dabookBooksReportSchema,
  dabookDoctorSchema,
  dabookExportManifestSchema,
  dabookRagRecordSchema,
  dabookReviewSampleSchema,
  parseIngestReport
} from './DabookContract';
import { DabookConfig, resolveDabookConfig } from './DabookConfig';

export type DabookErrorReason =
  | 'disabled'
  | 'interpreter_not_found'
  | 'timeout'
  | 'needs_input'
  | 'failed'
  | 'lock_held'
  | 'bad_args'
  | 'bad_output'
  | 'export_blocked'
  | 'spawn_error';

export class DabookError extends Error {
  constructor(
    readonly reason: DabookErrorReason,
    message: string,
    readonly details: {
      exitCode?: number;
      stderr?: string;
      report?: DabookIngestReport;
      book?: DabookBookReport;
      /** Per-book reasons when governance blocked an export. */
      blocked?: Record<string, string[]>;
    } = {}
  ) {
    super(message);
    this.name = 'DabookError';
  }
}

export type NativeRunner = (executable: string, args: string[], options?: NativeCommandOptions) => Promise<NativeCommandResult>;

export interface DabookBridgeOptions {
  /** Defaults to `resolveDabookConfig(process.env)`, re-read per call so env changes apply. */
  config?: DabookConfig | (() => DabookConfig);
  /** Injectable for tests. */
  runner?: NativeRunner;
  /** Injectable for tests. */
  killTree?: (pid: number) => void;
  now?: () => number;
}

export interface DabookIngestOptions {
  profile?: DabookConfig['profile'];
  modes?: string[];
  timeoutMs?: number;
  licenseStatus?: DabookLicenseStatus;
}

export interface DabookIngestResult {
  report: DabookIngestReport;
  book: DabookBookReport;
  workspace: string;
  durationMs: number;
  /** Stderr tail (supervisor log lines); useful for diagnostics, never parsed. */
  stderrTail: string;
}

export interface DabookInterpreterProbe {
  source: string;
  path: string;
  exists: boolean;
  importable: boolean;
  version?: string;
  error?: string;
}

export interface DabookHealth {
  enabled: boolean;
  /** True when an interpreter that can import dabook was found. */
  available: boolean;
  status: 'disabled' | 'ready' | 'unavailable';
  interpreter?: string;
  version?: string;
  workspace: string;
  profile: string;
  reason?: string;
  candidates: DabookInterpreterProbe[];
  doctor?: DabookDoctorReport;
  configWarnings: string[];
  checkedAt: string;
}

const PROBE_TTL_OK_MS = 60_000;
const PROBE_TTL_FAIL_MS = 15_000;
const PROBE_TIMEOUT_MS = 20_000;
const TIMEOUT_MARGIN_S = 5;
const OUTER_TIMEOUT_MARGIN_MS = 25_000;
const STDERR_TAIL_CHARS = 4_000;

function samePath(a: string, b: string): boolean {
  const norm = (value: string) => path.resolve(value).replace(/\\/g, '/');
  return process.platform === 'win32' ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
}

function defaultKillTree(pid: number): void {
  try {
    if (process.platform === 'win32') {
      // The venv launcher stub re-execs the real interpreter, so killing only the child
      // would leave the DABOOK supervisor (and the workspace lock) alive.
      execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => undefined);
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch {
    // already gone
  }
}

export class DabookBridge {
  private readonly runner: NativeRunner;
  private readonly killTree: (pid: number) => void;
  private readonly now: () => number;
  private readonly configSource: () => DabookConfig;
  private queue: Promise<unknown> = Promise.resolve();
  private interpreter?: { path: string; version: string; checkedAt: number };
  private interpreterFailure?: { error: string; candidates: DabookInterpreterProbe[]; checkedAt: number };
  /** Result of the most recent candidate probe, successful or not (for diagnostics). */
  private lastProbes: DabookInterpreterProbe[] = [];
  private doctor?: { report: DabookDoctorReport; checkedAt: number; interpreter: string };

  constructor(options: DabookBridgeOptions = {}) {
    this.runner = options.runner ?? runNativeCommand;
    this.killTree = options.killTree ?? defaultKillTree;
    this.now = options.now ?? (() => Date.now());
    const supplied = options.config;
    this.configSource = typeof supplied === 'function' ? supplied : supplied ? () => supplied : () => resolveDabookConfig();
  }

  get config(): DabookConfig {
    return this.configSource();
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Forget cached probes (call after the operator changes interpreters or installs DABOOK). */
  invalidate(): void {
    this.interpreter = undefined;
    this.interpreterFailure = undefined;
    this.doctor = undefined;
    this.lastProbes = [];
  }

  // ------------------------------------------------------------------ interpreter + health
  private async probeCandidates(): Promise<{ chosen?: { path: string; version: string }; probes: DabookInterpreterProbe[] }> {
    const probes: DabookInterpreterProbe[] = [];
    for (const candidate of this.config.interpreterCandidates) {
      const probe: DabookInterpreterProbe = {
        source: candidate.source,
        path: candidate.path,
        exists: fs.existsSync(candidate.path),
        importable: false
      };
      probes.push(probe);
      if (!probe.exists) {
        probe.error = 'file not found';
        continue;
      }
      try {
        const result = await this.runner(candidate.path, ['-c', 'import dabook; print(dabook.__version__)'], {
          timeoutMs: PROBE_TIMEOUT_MS,
          env: this.childEnv()
        });
        if (result.exitCode === 0 && result.stdout.trim()) {
          probe.importable = true;
          probe.version = result.stdout.trim().split(/\r?\n/).pop();
          return { chosen: { path: candidate.path, version: probe.version! }, probes };
        }
        probe.error = (result.stderr.trim().split(/\r?\n/).pop() || `exit ${result.exitCode}`).slice(0, 200);
      } catch (error) {
        probe.error = error instanceof Error ? error.message.slice(0, 200) : String(error);
      }
    }
    return { probes };
  }

  /** The first configured interpreter that can import dabook (cached). */
  async resolveInterpreter(force = false): Promise<string | undefined> {
    const now = this.now();
    if (!force && this.interpreter && now - this.interpreter.checkedAt < PROBE_TTL_OK_MS) {
      return this.interpreter.path;
    }
    if (!force && this.interpreterFailure && now - this.interpreterFailure.checkedAt < PROBE_TTL_FAIL_MS) {
      return undefined;
    }
    const { chosen, probes } = await this.probeCandidates();
    this.lastProbes = probes;
    if (chosen) {
      this.interpreter = { ...chosen, checkedAt: now };
      this.interpreterFailure = undefined;
      return chosen.path;
    }
    this.interpreter = undefined;
    this.interpreterFailure = {
      error: 'No Python interpreter with DABOOK installed was found',
      candidates: probes,
      checkedAt: now
    };
    return undefined;
  }

  /**
   * Environment status for the health endpoint and the capability hub. Probes interpreters even
   * when the feature is disabled, so an operator can see whether turning it on would work.
   */
  async health(options: { force?: boolean; deep?: boolean } = {}): Promise<DabookHealth> {
    const config = this.config;
    const python = await this.resolveInterpreter(options.force);
    // Every configured candidate, annotated with what the last probe found (candidates after the
    // winner were never tried and are listed as such).
    const candidates: DabookInterpreterProbe[] = config.interpreterCandidates.map(candidate => (
      this.lastProbes.find(probe => probe.path === candidate.path)
      ?? { source: candidate.source, path: candidate.path, exists: fs.existsSync(candidate.path), importable: false }
    ));
    const base = {
      enabled: config.enabled,
      workspace: config.workspace,
      profile: config.profile,
      configWarnings: config.warnings,
      checkedAt: new Date(this.now()).toISOString()
    };

    if (!python) {
      return {
        ...base,
        available: false,
        status: config.enabled ? 'unavailable' : 'disabled',
        reason: 'No Python interpreter with DABOOK installed was found. Run `npm run setup:dabook` or set DABOOK_PYTHON.',
        candidates
      };
    }

    const result: DabookHealth = {
      ...base,
      available: true,
      status: config.enabled ? 'ready' : 'disabled',
      interpreter: python,
      version: this.interpreter?.version,
      reason: config.enabled ? undefined : 'DABOOK is installed but DABOOK_ENABLED is not true',
      candidates
    };

    if (options.deep) {
      const doctor = await this.runDoctor(python, options.force);
      result.doctor = doctor;
      if (doctor && !doctor.ok) {
        result.available = false;
        result.status = config.enabled ? 'unavailable' : 'disabled';
        result.reason = `dabook doctor failed: ${doctor.checks.filter(c => !c.ok && c.required !== false).map(c => c.name).join(', ')}`;
      }
    }
    return result;
  }

  private async runDoctor(python: string, force = false): Promise<DabookDoctorReport | undefined> {
    const now = this.now();
    if (!force && this.doctor && this.doctor.interpreter === python && now - this.doctor.checkedAt < PROBE_TTL_OK_MS) {
      return this.doctor.report;
    }
    try {
      const run = await this.runner(python, ['-m', 'dabook', 'doctor', '--json', '-w', this.config.workspace], {
        timeoutMs: PROBE_TIMEOUT_MS,
        env: this.childEnv()
      });
      const parsed = dabookDoctorSchema.safeParse(JSON.parse(run.stdout.trim()));
      if (!parsed.success) return undefined;
      this.doctor = { report: parsed.data, checkedAt: now, interpreter: python };
      return parsed.data;
    } catch (error) {
      logger.warn('dabook doctor failed', { error: error instanceof Error ? error.message : String(error) });
      return undefined;
    }
  }

  // ------------------------------------------------------------------ ingest
  /**
   * Ingest one PDF. Calls are serialized: DABOOK takes a single-writer lock on its workspace.
   * Resolves with a validated result, or rejects with a `DabookError` the caller can fall back on.
   */
  ingest(pdfPath: string, options: DabookIngestOptions = {}): Promise<DabookIngestResult> {
    return this.serialize(() => this.runIngest(pdfPath, options));
  }

  /** Run *task* after every earlier call finished; a failed call never stalls the queue. */
  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async runIngest(pdfPath: string, options: DabookIngestOptions): Promise<DabookIngestResult> {
    const config = this.config;
    if (!config.enabled) {
      throw new DabookError('disabled', 'DABOOK is disabled (set DABOOK_ENABLED=true)');
    }
    const absolute = path.resolve(pdfPath);
    if (path.extname(absolute).toLowerCase() !== '.pdf') {
      throw new DabookError('bad_args', `DABOOK only ingests .pdf files: ${path.basename(absolute)}`);
    }
    const python = await this.resolveInterpreter();
    if (!python) {
      throw new DabookError('interpreter_not_found', this.interpreterFailure?.error ?? 'DABOOK interpreter not found');
    }

    const timeoutMs = Math.max(5_000, options.timeoutMs ?? config.timeoutMs);
    const modes = options.modes?.length ? options.modes : ['rag', 'raw'];
    const args = [
      '-m', 'dabook', 'ingest',
      '-w', config.workspace,
      '--json',
      '--profile', options.profile ?? config.profile,
      '--modes', modes.join(','),
      // Python stops itself first (leaving the workspace resumable); the outer kill is a backstop.
      '--timeout-s', String(Math.max(1, Math.floor(timeoutMs / 1000) - TIMEOUT_MARGIN_S)),
      '--lock-wait-s', '30',
      ...(options.licenseStatus ? ['--license', options.licenseStatus] : []),
      '--',
      absolute
    ];

    let pid: number | undefined;
    const startedAt = this.now();
    let result: NativeCommandResult;
    try {
      result = await this.runner(python, args, {
        timeoutMs: timeoutMs + OUTER_TIMEOUT_MARGIN_MS,
        env: this.childEnv(),
        onSpawn: child => { pid = child.pid; }
      });
    } catch (error) {
      if (pid !== undefined) this.killTree(pid);
      const message = error instanceof Error ? error.message : String(error);
      if (/timed out/i.test(message)) {
        throw new DabookError('timeout', `DABOOK did not finish within ${Math.round(timeoutMs / 1000)}s`);
      }
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        this.invalidate();
        throw new DabookError('interpreter_not_found', `DABOOK interpreter vanished: ${python}`);
      }
      throw new DabookError('spawn_error', message);
    }

    const stderrTail = result.stderr.slice(-STDERR_TAIL_CHARS);
    let report: DabookIngestReport;
    try {
      report = parseIngestReport(result.stdout);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      // Exit code still tells us *why* when the output is unusable.
      throw new DabookError(
        result.exitCode === DABOOK_EXIT.LOCK_HELD ? 'lock_held' : 'bad_output',
        `DABOOK exited ${result.exitCode} with unusable output: ${detail}`,
        { exitCode: result.exitCode, stderr: stderrTail }
      );
    }

    const book = report.books.find(b => samePath(b.source_path, absolute)) ?? report.books[0];
    const details = { exitCode: result.exitCode, stderr: stderrTail, report, book };

    switch (result.exitCode) {
      case DABOOK_EXIT.OK:
        if (!book) throw new DabookError('bad_output', 'DABOOK reported success but no books', details);
        if (!book.datasets.rag) throw new DabookError('bad_output', 'DABOOK finished without a rag dataset', details);
        return { report, book, workspace: config.workspace, durationMs: this.now() - startedAt, stderrTail };
      case DABOOK_EXIT.NEEDS_INPUT:
        throw new DabookError('needs_input', book?.error || 'PDF has no text layer and needs OCR', details);
      case DABOOK_EXIT.LOCK_HELD:
        throw new DabookError('lock_held', report.error?.message ?? 'DABOOK workspace is locked by another process', details);
      case DABOOK_EXIT.BAD_ARGS:
        throw new DabookError('bad_args', report.error?.message ?? 'DABOOK rejected the arguments', details);
      default:
        throw new DabookError('failed', book?.error || report.error?.message || `DABOOK exited with code ${result.exitCode}`, details);
    }
  }

  // ------------------------------------------------------------------ governance commands
  /**
   * Run a DABOOK CLI command that prints one JSON document, serialized with every other call.
   * Exit codes follow the CLI contract: 0 ok, 4 locked, 5 bad arguments, 6 blocked by governance.
   */
  private runJsonCommand<T>(
    args: string[],
    schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: Array<{ path: (string | number)[]; message: string }> } } },
    options: { timeoutMs?: number } = {}
  ): Promise<T> {
    return this.serialize(async () => {
      const config = this.config;
      const python = await this.resolveInterpreter();
      if (!python) {
        throw new DabookError('interpreter_not_found', this.interpreterFailure?.error ?? 'DABOOK interpreter not found');
      }
      const timeoutMs = options.timeoutMs ?? 120_000;
      let pid: number | undefined;
      let result: NativeCommandResult;
      try {
        result = await this.runner(python, ['-m', 'dabook', ...args, '-w', config.workspace, '--json'], {
          timeoutMs,
          env: this.childEnv(),
          onSpawn: child => { pid = child.pid; }
        });
      } catch (error) {
        if (pid !== undefined) this.killTree(pid);
        const message = error instanceof Error ? error.message : String(error);
        throw new DabookError(/timed out/i.test(message) ? 'timeout' : 'spawn_error', message);
      }

      const stderr = result.stderr.slice(-STDERR_TAIL_CHARS);
      let json: any;
      try {
        json = JSON.parse(result.stdout.trim());
      } catch {
        throw new DabookError(
          result.exitCode === DABOOK_EXIT.LOCK_HELD ? 'lock_held' : 'bad_output',
          `dabook ${args[0]} exited ${result.exitCode} with unusable output`,
          { exitCode: result.exitCode, stderr }
        );
      }
      const failure = json?.error;
      const details = { exitCode: result.exitCode, stderr, ...(failure?.details ? { blocked: failure.details } : {}) };
      switch (result.exitCode) {
        case DABOOK_EXIT.OK: {
          const parsed = schema.safeParse(json);
          if (!parsed.success) {
            const issue = parsed.error.issues[0];
            throw new DabookError('bad_output', `dabook ${args[0]} output is invalid: ${issue?.path.join('.')}: ${issue?.message}`, details);
          }
          return parsed.data;
        }
        case DABOOK_EXIT.LOCK_HELD:
          throw new DabookError('lock_held', failure?.message ?? 'DABOOK workspace is locked', details);
        case DABOOK_EXIT.BAD_ARGS:
          throw new DabookError('bad_args', failure?.message ?? 'DABOOK rejected the arguments', details);
        case DABOOK_EXIT.EXPORT_BLOCKED:
          throw new DabookError('export_blocked', failure?.message ?? 'Export blocked by governance', details);
        default:
          throw new DabookError('failed', failure?.message ?? `dabook ${args[0]} exited ${result.exitCode}`, details);
      }
    });
  }

  /** Books with license, review state, dataset paths and the export gate's policy. */
  listBooks(): Promise<DabookBooksReport> {
    return this.runJsonCommand(['books'], dabookBooksReportSchema, { timeoutMs: 60_000 });
  }

  setLicense(book: string, status: DabookLicenseStatus): Promise<{ book_id: number; sha256: string; license_status: DabookLicenseStatus }> {
    return this.runJsonCommand(['license', book, status], z.object({
      book_id: z.number(), sha256: z.string(), license_status: z.enum(DABOOK_LICENSE_STATUSES)
    }), { timeoutMs: 60_000 });
  }

  reviewSample(book: string, options: { count?: number; seed?: number } = {}): Promise<DabookReviewSample> {
    return this.runJsonCommand(
      ['review', 'sample', book, '-n', String(options.count ?? 10), '--seed', String(options.seed ?? 42)],
      dabookReviewSampleSchema,
      { timeoutMs: 60_000 }
    );
  }

  reviewDecision(book: string, pairId: string, decision: 'accept' | 'reject', reason?: string) {
    return this.runJsonCommand(
      ['review', 'decide', book, pairId, decision, ...(reason ? ['--reason', reason] : [])],
      z.object({ sha256: z.string(), pair_id: z.string(), action: z.enum(['accept', 'reject']) }).passthrough(),
      { timeoutMs: 60_000 }
    );
  }

  reviewBook(book: string, status: 'unreviewed' | 'approved' | 'rejected') {
    return this.runJsonCommand(['review', 'book', book, status], z.object({
      book_id: z.number(), sha256: z.string(), review_status: z.enum(DABOOK_REVIEW_STATUSES)
    }), { timeoutMs: 60_000 });
  }

  /** Re-run only the stages whose inputs changed (e.g. after review decisions). */
  recompile(book: string) {
    return this.runJsonCommand(['recompile', book], z.object({
      replanned: z.record(z.number()),
      book: dabookBookSchema
    }).passthrough(), { timeoutMs: this.config.timeoutMs });
  }

  /**
   * Build a governed training bundle. DABOOK enforces the license and review gates itself, so a
   * blocked export fails with reason `export_blocked` whichever client asked.
   */
  exportBundle(options: {
    outDir: string;
    books?: string[];
    modes: DabookTrainingMode[];
    formats: DabookExportFormat[];
    allowHeuristic?: boolean;
    splits?: boolean;
  }): Promise<DabookExportManifest> {
    return this.runJsonCommand([
      'export',
      '--out', options.outDir,
      '--modes', options.modes.join(','),
      '--format', options.formats.join(','),
      ...(options.splits === false ? ['--no-splits'] : []),
      ...(options.allowHeuristic ? ['--allow-heuristic'] : []),
      ...(options.books ?? []).flatMap(book => ['--book', book])
    ], dabookExportManifestSchema, { timeoutMs: this.config.timeoutMs });
  }

  /** Read a JSONL dataset file from the workspace (path-contained). Invalid lines fail the read. */
  async readJsonl<T = Record<string, unknown>>(
    relativePath: string,
    validate?: (value: unknown, line: number) => T,
    workspace: string = this.config.workspace
  ): Promise<T[]> {
    const text = await fs.promises.readFile(this.resolveDatasetPath(relativePath, workspace), 'utf8');
    const rows: T[] = [];
    text.split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        throw new DabookError('bad_output', `${relativePath} line ${index + 1} is not valid JSON`);
      }
      rows.push(validate ? validate(value, index + 1) : (value as T));
    });
    return rows;
  }

  // ------------------------------------------------------------------ datasets
  /** Absolute path of a dataset file, refusing anything that escapes the workspace. */
  resolveDatasetPath(relativePath: string, workspace: string = this.config.workspace): string {
    const resolved = path.resolve(workspace, relativePath);
    const root = path.resolve(workspace) + path.sep;
    if (!resolved.startsWith(root)) {
      throw new DabookError('bad_output', `Dataset path escapes the DABOOK workspace: ${relativePath}`);
    }
    return resolved;
  }

  /** Read and validate `rag.jsonl`. Any invalid line fails the whole read (no partial data). */
  async readRagRecords(result: Pick<DabookIngestResult, 'book' | 'workspace'>): Promise<DabookRagRecord[]> {
    const relative = result.book.datasets.rag;
    if (!relative) throw new DabookError('bad_output', 'Book has no rag dataset');
    const text = await fs.promises.readFile(this.resolveDatasetPath(relative, result.workspace), 'utf8');
    const records: DabookRagRecord[] = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      let json: unknown;
      try {
        json = JSON.parse(lines[i]);
      } catch {
        throw new DabookError('bad_output', `rag.jsonl line ${i + 1} is not valid JSON`);
      }
      const parsed = dabookRagRecordSchema.safeParse(json);
      if (!parsed.success) {
        throw new DabookError('bad_output', `rag.jsonl line ${i + 1} is invalid: ${parsed.error.issues[0]?.message}`);
      }
      records.push(parsed.data);
    }
    return records;
  }

  private childEnv(): NodeJS.ProcessEnv {
    return { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
  }
}
