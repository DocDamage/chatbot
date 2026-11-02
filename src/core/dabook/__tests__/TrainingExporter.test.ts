import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DabookBookReport } from '../DabookContract';
import { TrainingExportError, TrainingExporter, resolveBook } from '../training/TrainingExporter';

const sha = (c: string) => c.repeat(64);

const book = (n: number, over: Partial<DabookBookReport> = {}): DabookBookReport => ({
  book_id: n, sha256: sha(String(n)), source_path: `C:/books/b${n}.pdf`, title: `Book ${n}`, pages: 8, doc_type: 'native',
  state: 'done', quality_score: 0.97, license_status: 'owned', review_status: 'unreviewed', warnings: [],
  datasets: { rag: `books/b${n}/rag.jsonl`, sft: `books/b${n}/sft.jsonl`, pretrain: `books/b${n}/pretrain.jsonl` },
  counts: {}, splits: {},
  ...over
}) as DabookBookReport;

describe('TrainingExporter', () => {
  let root: string;
  let files: Record<string, unknown[]>;
  let books: DabookBookReport[];
  let evalItems: Array<{ id: string; text: string }>;
  let exportBundle: jest.Mock;
  let bridge: any;

  const policy = { training_licenses: ['owned', 'permissive', 'public_domain'], quality_verified: 0.95, review_statuses: ['unreviewed', 'approved', 'rejected'] };
  const ragRow = (book: DabookBookReport, n: number, content: string) => ({
    chunk_id: `c${n}`, book_sha256: book.sha256, page_start: 1, page_end: 1, breadcrumbs: [], node_ids: [], node_types: [],
    has_code: false, token_count: 5, content
  });

  const makeExporter = () => new TrainingExporter({
    bridge,
    exportRoot: path.join(root, 'bundles'),
    evalsDir: path.join(root, 'evals'),
    now: () => new Date('2026-10-05T12:00:00.000Z'),
    loadEvaluation: directory => ({ items: evalItems, files: 1, directory })
  });

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'training-export-'));
    books = [book(1), book(2)];
    evalItems = [{ id: 'eval:cases.json#q1:query', text: 'Which provider should serve the nightly batch summarisation job?' }];
    files = {};
    for (const b of books) {
      files[b.datasets.rag!] = [ragRow(b, 0, `retrieval chunk for book ${b.book_id}`)];
      files[b.datasets.sft!] = [{ id: `sft_${b.book_id}`, instruction: `Explain topic number ${b.book_id} in detail?`, output: `Topic ${b.book_id} is explained here at length.`, generator: 'assist:m' }];
      files[b.datasets.pretrain!] = [{ doc_id: `doc_${b.book_id}`, text: `Chapter text of book ${b.book_id} goes here.` }];
    }
    exportBundle = jest.fn(async (options: any) => {
      fs.mkdirSync(options.outDir, { recursive: true });
      const manifest = {
        schema: 'dabook.export.v1', dabook_version: '1.1.0', modes: options.modes, formats: options.formats,
        books: options.books.map((id: string) => ({ book_id: Number(id), sha256: sha(id) })),
        skipped_books: {}, counts: { sft: { train: 2, val: 0, test: 0 } }, generators: { 'assist:m': 2 },
        excluded_heuristic_records: 0, files: ['sft/train.jsonl']
      };
      fs.writeFileSync(path.join(options.outDir, 'manifest.json'), JSON.stringify(manifest));
      return manifest;
    });
    bridge = {
      listBooks: jest.fn(async () => ({ schema: 'dabook.books.v1', dabook_version: '1.1.0', workspace: 'W', policy, books })),
      readJsonl: jest.fn(async (rel: string, validate?: (v: unknown, n: number) => unknown) =>
        (files[rel] ?? []).map((row, i) => (validate ? validate(row, i + 1) : row))),
      exportBundle
    };
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('exports every eligible book after a clean audit and records the audit in the manifest', async () => {
    const result = await makeExporter().export({ modes: ['sft', 'pretrain'], formats: ['jsonl', 'parquet'] });

    expect(exportBundle).toHaveBeenCalledWith(expect.objectContaining({
      books: ['1', '2'], modes: ['sft', 'pretrain'], formats: ['jsonl', 'parquet'], allowHeuristic: undefined
    }));
    expect(result.bundleDir).toMatch(/bundles[\\/]20261005T120000Z-[0-9a-f]{4}$/);
    const onDisk = JSON.parse(fs.readFileSync(path.join(result.bundleDir, 'manifest.json'), 'utf8'));
    expect(onDisk).toEqual(result.manifest);
    expect(onDisk.schema).toBe('dabook.export.v1'); // the DABOOK manifest is preserved
    expect(onDisk.governance).toMatchObject({
      generatedBy: 'chatbot-training-exporter',
      contaminated: false,
      audit: { evaluationOverlapsWithTraining: 0, evaluationOverlapsWithRag: 0, registrationConflicts: 0 },
      embeddedEvaluationScan: { scannedRecords: 4, scannedEvaluationItems: 1, matches: 0 },
      evaluation: { items: 1, registered: 1 },
      trainingRecordsAudited: 4
    });
    expect(fs.existsSync(`${path.join(result.bundleDir, 'manifest.json')}.tmp`)).toBe(false);
  });

  describe('license and review gates', () => {
    it.each(['unknown', 'copyrighted'] as const)('refuses an explicitly requested %s book and writes nothing', async license => {
      books[0] = book(1, { license_status: license });
      const error = await makeExporter().export({ books: ['1'], modes: ['sft'], formats: ['jsonl'] }).catch(e => e);
      expect(error).toBeInstanceOf(TrainingExportError);
      expect(error.code).toBe('blocked');
      expect(error.message).toContain(license);
      expect(error.details.blocked['Book 1'][0]).toContain('RAG');
      expect(exportBundle).not.toHaveBeenCalled();
      expect(bridge.readJsonl).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(root, 'bundles'))).toBe(false);
    });

    it('exporting everything skips ineligible books but never exports them', async () => {
      books = [book(1), book(2, { license_status: 'copyrighted' }), book(3, { review_status: 'rejected' }), book(4, { state: 'failed' })];
      for (const b of books) files[b.datasets.sft!] = [{ id: 's', instruction: `Explain topic ${b.book_id}?`, output: 'x '.repeat(10) }];
      await makeExporter().export({ modes: ['sft'], formats: ['jsonl'] });
      expect(exportBundle.mock.calls[0][0].books).toEqual(['1']);
    });

    it('fails with no_books (and lists why) when nothing is eligible', async () => {
      books = [book(1, { license_status: 'unknown' }), book(2, { quality_score: 0.5 })];
      const error = await makeExporter().export({ modes: ['sft'], formats: ['jsonl'] }).catch(e => e);
      expect(error.code).toBe('no_books');
      expect(Object.keys(error.details.blocked)).toEqual(['Book 1', 'Book 2']);
    });

    it('requires review or verified quality', async () => {
      books[0] = book(1, { quality_score: 0.8 });
      const blocked = await makeExporter().export({ books: ['1'], modes: ['sft'], formats: ['jsonl'] }).catch(e => e);
      expect(blocked.code).toBe('blocked');
      books[0] = book(1, { quality_score: 0.8, review_status: 'approved' });
      await expect(makeExporter().export({ books: ['1'], modes: ['sft'], formats: ['jsonl'] })).resolves.toBeDefined();
    });

    it('takes the thresholds and licenses from DABOOK, not from a local copy', async () => {
      policy.quality_verified = 0.99;
      policy.training_licenses = ['public_domain'];
      books = [book(1, { license_status: 'public_domain', quality_score: 0.98 }), book(2)];
      const error = await makeExporter().export({ modes: ['sft'], formats: ['jsonl'] }).catch(e => e);
      expect(error.code).toBe('no_books'); // 0.98 < 0.99 and 'owned' is not allowed any more
      policy.quality_verified = 0.95;
      policy.training_licenses = ['owned', 'permissive', 'public_domain'];
    });
  });

  describe('contamination audit', () => {
    it('blocks, before writing anything, when a training record embeds an evaluation question', async () => {
      files[books[0].datasets.sft!] = [{
        id: 'leak', instruction: 'Quick check: which provider should serve the nightly batch summarisation job?', output: 'Use the local model for that job.', generator: 'assist:m'
      }];
      const error = await makeExporter().export({ modes: ['sft'], formats: ['jsonl'] }).catch(e => e);

      expect(error).toBeInstanceOf(TrainingExportError);
      expect(error.code).toBe('contaminated');
      expect(error.details.governance.embeddedEvaluationScan.matches).toBe(1);
      expect(error.details.governance.matchSamples[0]).toMatchObject({ evaluationId: 'eval:cases.json#q1:query', kind: 'record-contains-evaluation' });
      expect(exportBundle).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(root, 'bundles'))).toBe(false);
    });

    it('blocks an exact evaluation duplicate in the training corpus or in RAG', async () => {
      files[books[0].datasets.pretrain!] = [{ doc_id: 'dup', text: evalItems[0].text }];
      const training = await makeExporter().export({ modes: ['pretrain'], formats: ['jsonl'] }).catch(e => e);
      expect(training.code).toBe('contaminated');
      expect(training.details.governance.audit.registrationConflicts).toBe(1);

      files[books[0].datasets.pretrain!] = [{ doc_id: 'fine', text: 'Fine chapter text.' }];
      files[books[0].datasets.rag!] = [ragRow(books[0], 0, evalItems[0].text)];
      const rag = await makeExporter().export({ modes: ['pretrain'], formats: ['jsonl'] }).catch(e => e);
      expect(rag.code).toBe('contaminated');
      expect(exportBundle).not.toHaveBeenCalled();
    });

    it('does not block on training/RAG overlap (book-derived data is expected to repeat its retrieval text)', async () => {
      files[books[0].datasets.pretrain!] = [{ doc_id: 'same', text: 'A short chapter that is also exactly one retrieval chunk.' }];
      files[books[0].datasets.rag!] = [ragRow(books[0], 0, 'A short chapter that is also exactly one retrieval chunk.')];
      const result = await makeExporter().export({ books: ['1'], modes: ['pretrain'], formats: ['jsonl'] });
      expect(result.manifest.governance.audit.trainingOverlapsWithRag).toBe(1);
      expect(exportBundle).toHaveBeenCalledTimes(1);
    });

    it('excludes template pairs from the audit and the export unless asked', async () => {
      files[books[0].datasets.sft!] = [
        { id: 'a', instruction: 'Explain topic one in detail?', output: 'Detailed answer text here.', generator: 'assist:m' },
        { id: 'h', instruction: 'Template question about something?', output: 'Template answer text here.', generator: 'heuristic' }
      ];
      const plain = await makeExporter().export({ books: ['1'], modes: ['sft'], formats: ['jsonl'] });
      expect(plain.manifest.governance.trainingRecordsAudited).toBe(1);
      const forced = await makeExporter().export({ books: ['1'], modes: ['sft'], formats: ['jsonl'], includeHeuristic: true });
      expect(forced.manifest.governance.trainingRecordsAudited).toBe(2);
      expect(exportBundle).toHaveBeenLastCalledWith(expect.objectContaining({ allowHeuristic: true }));
    });
  });

  describe('book resolution', () => {
    it('resolves ids, sha prefixes and source paths', () => {
      expect(resolveBook(books, '2').book_id).toBe(2);
      expect(resolveBook(books, sha('1').slice(0, 8)).book_id).toBe(1);
      expect(resolveBook(books, 'C:/books/b2.pdf').book_id).toBe(2);
    });

    it('rejects unknown and ambiguous references', () => {
      for (const ref of ['99', 'deadbeef', 'nope.pdf', '']) {
        expect(() => resolveBook(books, ref)).toThrow(TrainingExportError);
      }
      const twins = [book(1), { ...book(2), sha256: sha('1').slice(0, 10) + sha('2').slice(10) }];
      expect(() => resolveBook(twins as any, sha('1').slice(0, 8))).toThrow(/ambiguous/);
    });

    it('reports an unknown book as unknown_book through export()', async () => {
      const error = await makeExporter().export({ books: ['777'], modes: ['sft'], formats: ['jsonl'] }).catch(e => e);
      expect(error.code).toBe('unknown_book');
      expect(exportBundle).not.toHaveBeenCalled();
    });
  });

  it('propagates a failure from the bundle build without leaving a governance-only manifest', async () => {
    exportBundle.mockRejectedValueOnce(new Error('disk full'));
    await expect(makeExporter().export({ modes: ['sft'], formats: ['jsonl'] })).rejects.toThrow('disk full');
    expect(fs.existsSync(path.join(root, 'bundles'))).toBe(false);
  });

  it('defaults its directories from the environment', () => {
    const saved = { ...process.env };
    process.env.TRAINING_EXPORT_DIR = path.join(root, 'from-env');
    process.env.DABOOK_EVALS_DIR = path.join(root, 'evals-env');
    try {
      const exporter = new TrainingExporter({ bridge, loadEvaluation: d => ({ items: [], files: 0, directory: d }) });
      expect((exporter as any).exportRoot).toBe(path.join(root, 'from-env'));
      expect((exporter as any).evalsDir).toBe(path.join(root, 'evals-env'));
    } finally {
      process.env = saved;
    }
  });
});
