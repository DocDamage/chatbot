/**
 * Live end-to-end test of the training lane against a real DABOOK install.
 * Runs only with DABOOK_LIVE_TEST=1 and `npm run setup:dabook` done. It uses DABOOK's test-only
 * `fake:grounded` provider, so no model or network is involved.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DabookBridge, DabookError } from '../DabookBridge';
import { managedVenvPython, resolveDabookConfig } from '../DabookConfig';
import { loadEvaluationCorpus } from '../training/EvaluationCorpus';
import { TrainingExportError, TrainingExporter } from '../training/TrainingExporter';
import { sampleHandbookPdf } from './pdfFixture';

const python = managedVenvPython();
const live = process.env.DABOOK_LIVE_TEST === '1' && fs.existsSync(python);
const liveDescribe = live ? describe : describe.skip;

liveDescribe('governed training export, end to end (DABOOK_LIVE_TEST=1)', () => {
  jest.setTimeout(300_000);
  let dir: string;
  let workspace: string;
  let bridge: DabookBridge;

  const writeEvals = (name: string, cases: unknown[]) => {
    const evals = path.join(dir, name);
    fs.mkdirSync(evals, { recursive: true });
    fs.writeFileSync(path.join(evals, 'cases.json'), JSON.stringify(cases));
    return evals;
  };

  const exporter = (evalsDir: string) => new TrainingExporter({
    bridge,
    evalsDir,
    exportRoot: path.join(dir, 'bundles'),
    loadEvaluation: loadEvaluationCorpus
  });

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dabook-train-live-'));
    workspace = path.join(dir, 'ws');
    const pdf = path.join(dir, 'handbook.pdf');
    fs.writeFileSync(pdf, sampleHandbookPdf());
    const run = spawnSync(python, [
      '-m', 'dabook', 'ingest', pdf, '-w', workspace, '--json', '--assist', 'fake:grounded', '--modes', 'rag,sft,pretrain,code'
    ], { encoding: 'utf8', env: { ...process.env, DABOOK_ENABLE_FAKE_PROVIDER: '1', DABOOK_ASSIST_BACKOFF_S: '0', PYTHONUTF8: '1' } });
    if (run.status !== 0) throw new Error(`setup ingest failed (${run.status}): ${run.stderr.slice(-1500)}`);

    process.env.DABOOK_WORKSPACE = workspace;
    bridge = new DabookBridge({ config: () => ({ ...resolveDabookConfig(process.env), workspace }) });
  });

  afterAll(() => {
    delete process.env.DABOOK_WORKSPACE;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('refuses unlicensed and copyrighted books at both gates, then exports a licensed one with its audit', async () => {
    const clean = writeEvals('evals-clean', [{ id: 'x1', query: 'Which provider should serve the nightly batch summarisation job?' }]);

    // 1. unknown license: the Chatbot gate refuses
    const unknown = await exporter(clean).export({ books: ['1'], modes: ['sft'], formats: ['jsonl'] }).catch(e => e);
    expect(unknown).toBeInstanceOf(TrainingExportError);
    expect(unknown.code).toBe('blocked');

    // 2. copyrighted: both gates refuse, including DABOOK itself when the Chatbot gate is bypassed
    await bridge.setLicense('1', 'copyrighted');
    const copyrighted = await exporter(clean).export({ books: ['1'], modes: ['sft'], formats: ['jsonl'] }).catch(e => e);
    expect(copyrighted.code).toBe('blocked');
    const direct = await bridge.exportBundle({ outDir: path.join(dir, 'direct'), books: ['1'], modes: ['sft'], formats: ['jsonl'] }).catch(e => e);
    expect(direct).toBeInstanceOf(DabookError);
    expect(direct.reason).toBe('export_blocked');
    expect(JSON.stringify(direct.details.blocked)).toContain('copyrighted');
    expect(fs.existsSync(path.join(dir, 'direct', 'manifest.json'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'bundles'))).toBe(false);

    // 3. licensed: an evaluation question embedded in a generated pair blocks the export
    await bridge.setLicense('1', 'owned');
    const sample = await bridge.reviewSample('1', { count: 1 });
    expect(sample.total_pairs).toBeGreaterThan(0);
    const leaked = writeEvals('evals-leaky', [{ id: 'leak', query: sample.sample[0].question }]);
    const contaminated = await exporter(leaked).export({ books: ['1'], modes: ['sft'], formats: ['jsonl'] }).catch(e => e);
    expect(contaminated.code).toBe('contaminated');
    expect(contaminated.details.governance.embeddedEvaluationScan.matches).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(dir, 'bundles'))).toBe(false); // blocked before anything was written

    // 4. clean audit: the bundle is built and the audit is recorded in its manifest
    const result = await exporter(clean).export({ books: ['1'], modes: ['sft', 'code'], formats: ['jsonl', 'parquet'] });
    expect(result.manifest.governance).toMatchObject({ contaminated: false, embeddedEvaluationScan: { matches: 0 } });
    expect(result.manifest.books[0]).toMatchObject({ license_status: 'owned', sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(result.manifest.excluded_heuristic_records).toBe(0);
    const trainFile = path.join(result.bundleDir, 'sft', 'train.jsonl');
    const rows = fs.readFileSync(trainFile, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toMatchObject({ license_status: 'owned', split: 'train' });
      expect(row.generator).toMatch(/^assist:/);
      expect(row.pages[0]).toBeGreaterThanOrEqual(1);
    }
    expect(result.manifest.files).toEqual(expect.arrayContaining(['sft/train.jsonl']));
    expect(result.manifest.files.some((f: string) => f.endsWith('.parquet'))).toBe(true);
  });

  it('applies a review rejection through DABOOK and the next export reflects it', async () => {
    const before = await bridge.listBooks();
    const sftBefore = before.books[0].counts.sft ?? 0;
    expect(sftBefore).toBeGreaterThan(1);

    const sample = await bridge.reviewSample('1', { count: 1 });
    await bridge.reviewDecision('1', sample.sample[0].pair_id, 'reject', 'live test');
    const recompiled = await bridge.recompile('1');
    expect(recompiled.replanned.pending).toBe(1); // only the compile stage re-ran
    expect(recompiled.book.counts.sft).toBe(sftBefore - 1);

    await bridge.reviewBook('1', 'approved');
    const after = (await bridge.listBooks()).books[0];
    expect(after.review_status).toBe('approved');
  });
});
