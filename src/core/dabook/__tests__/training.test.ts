import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DabookBookReport, dabookRagRecordSchema } from '../DabookContract';
import { loadEvaluationCorpus } from '../training/EvaluationCorpus';
import { contentHash, normalizeText, scanForContamination } from '../training/ContaminationScanner';
import { TrainingCorpusImporter, TrainingLicenseError, trainingEligibility } from '../training/TrainingCorpusImporter';

const SHA = 'c'.repeat(64);
const POLICY = { trainingLicenses: ['owned', 'permissive', 'public_domain'], qualityVerified: 0.95 };

const book = (over: Partial<DabookBookReport> = {}): DabookBookReport => ({
  book_id: 1, sha256: SHA, source_path: 'C:/b.pdf', title: 'Handbook', pages: 8, doc_type: 'native', state: 'done',
  quality_score: 0.97, license_status: 'owned', review_status: 'unreviewed', warnings: [],
  datasets: { rag: 'books/x/rag.jsonl', sft: 'books/x/sft.jsonl', pretrain: 'books/x/pretrain.jsonl', code: 'books/x/code.jsonl' },
  counts: {}, splits: {},
  ...over
}) as DabookBookReport;

describe('normalizeText / contentHash', () => {
  it('ignores case, punctuation, accents-as-compatibility forms and spacing', () => {
    expect(normalizeText('  Hello,\n\tWORLD!! ')).toBe('hello world');
    expect(normalizeText('ﬁne ｆｕｌｌｗｉｄｔｈ')).toBe('fine fullwidth');
    expect(contentHash('What IS this?')).toBe(contentHash('what is   this'));
    expect(contentHash('a')).not.toBe(contentHash('b'));
    expect(contentHash('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('scanForContamination', () => {
  const evalItems = [
    { id: 'e1', text: 'What file handles durable RAG chunk storage?' },
    { id: 'short', text: 'tiny' },
    { id: 'e2', text: 'Which provider should serve the nightly batch summarisation job?' }
  ];

  it('finds an evaluation item embedded anywhere in a training record', () => {
    const records = [
      { id: 'r1', text: 'Question: what FILE handles durable rag chunk storage? Answer: RAGDocumentStore.' },
      { id: 'r2', text: 'An unrelated passage about partition tables and boot sectors on disks.' }
    ];
    const result = scanForContamination(evalItems, records);
    expect(result.matchCount).toBe(1);
    expect(result.matches[0]).toEqual({ evaluationId: 'e1', recordId: 'r1', kind: 'record-contains-evaluation' });
    expect(result).toMatchObject({ scannedRecords: 2, scannedEvaluationItems: 2, skippedShortEvaluationItems: 1 });
  });

  it('finds a record that is a fragment of an evaluation item', () => {
    const records = [{ id: 'frag', text: 'serve the nightly batch summarisation job' }];
    expect(scanForContamination(evalItems, records).matches).toEqual([
      { evaluationId: 'e2', recordId: 'frag', kind: 'evaluation-contains-record' }
    ]);
  });

  it('reports a clean corpus, ignores empty records and caps the reported sample', () => {
    expect(scanForContamination(evalItems, [{ id: 'a', text: 'nothing in common here at all really' }, { id: 'b', text: '   ' }]).matchCount).toBe(0);
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, text: `${evalItems[0].text} variant ${i}` }));
    const capped = scanForContamination(evalItems, many, 2);
    expect(capped.matchCount).toBe(5);
    expect(capped.matches).toHaveLength(2);
  });
});

describe('loadEvaluationCorpus', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evals-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });
  const write = (rel: string, value: unknown) => {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };

  it('reads queries, expected answers, manifest prompts and single-case files; ignores everything else', () => {
    write('a/cases.json', [{ id: 'c1', query: 'Question one?', expected_answer: 'Answer one.' }, { id: 'c2', query: '  ' }, { id: 'c3', other: 1 }]);
    write('b/manifest.json', { cases: [{ id: 'm1', prompt: 'Add validation for an empty user name.' }] });
    write('c/single.json', { id: 's1', query: 'Block the dangerous command.' });
    write('d/fixtures/ignored.json', [{ id: 'x', query: 'must be skipped' }]);
    write('e/contract.json', { columns: ['a'], dialect: 'x' });
    write('f/broken.json', '{not json');

    const corpus = loadEvaluationCorpus(dir);
    expect(corpus.items.map(i => i.id).sort()).toEqual([
      'eval:a/cases.json#c1:expected_answer',
      'eval:a/cases.json#c1:query',
      'eval:b/manifest.json#m1:prompt',
      'eval:c/single.json#s1:query'
    ]);
    expect(corpus.files).toBe(3);
  });

  it('keeps repeated case ids distinct so no evaluation item hides another', () => {
    write('dup.json', [{ id: 'same', query: 'First question text here?' }, { id: 'same', query: 'Second question text here?' }]);
    const ids = loadEvaluationCorpus(dir).items.map(i => i.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toEqual(['eval:dup.json#same:query', 'eval:dup.json#same@1:query']);
  });

  it('copes with a missing directory, and loads the repository evals', () => {
    expect(loadEvaluationCorpus(path.join(dir, 'nope'))).toMatchObject({ items: [], files: 0 });
    const repo = loadEvaluationCorpus(path.resolve(__dirname, '../../../../evals'));
    expect(repo.files).toBeGreaterThan(20);
    expect(repo.items.length).toBeGreaterThan(100);
  });
});

describe('trainingEligibility', () => {
  it.each([
    ['owned', true], ['permissive', true], ['public_domain', true], ['unknown', false], ['copyrighted', false], [null, false]
  ])('license %s -> %s', (license, ok) => {
    const reasons = trainingEligibility(book({ license_status: license as any }), POLICY);
    expect(reasons.length === 0).toBe(ok);
    if (!ok) expect(reasons[0]).toMatch(/only owned, permissive, public_domain.*RAG/);
  });

  it('needs review or verified quality, and refuses unfinished or rejected books', () => {
    expect(trainingEligibility(book({ quality_score: 0.9 }), POLICY)[0]).toContain('not reviewed');
    expect(trainingEligibility(book({ quality_score: null }), POLICY)[0]).toContain('n/a');
    expect(trainingEligibility(book({ quality_score: 0.5, review_status: 'approved' }), POLICY)).toEqual([]);
    expect(trainingEligibility(book({ review_status: 'rejected' }), POLICY)).toEqual(['the book was rejected in review']);
    expect(trainingEligibility(book({ state: 'failed' }), POLICY)[0]).toContain('not done');
    expect(trainingEligibility(book({ state: 'review' }), POLICY)).toEqual([]);
  });
});

describe('TrainingCorpusImporter', () => {
  const files: Record<string, unknown[]> = {};
  const reader = {
    readJsonl: jest.fn(async (rel: string, validate?: (v: unknown, n: number) => unknown) =>
      (files[rel] ?? []).map((row, i) => (validate ? validate(row, i + 1) : row)))
  } as any;

  const rag = (n: number, content: string) => ({
    chunk_id: `c${n}`, book_sha256: SHA, page_start: 1, page_end: 1, breadcrumbs: [], node_ids: [], node_types: [],
    has_code: false, token_count: 5, content
  });

  beforeEach(() => {
    for (const key of Object.keys(files)) delete files[key];
    reader.readJsonl.mockClear();
  });

  it('refuses to import training data from an ineligible book, whatever the route', async () => {
    const importer = new TrainingCorpusImporter(reader, POLICY);
    for (const license of ['unknown', 'copyrighted']) {
      await expect(importer.importTraining(book({ license_status: license as any }), ['sft'])).rejects.toBeInstanceOf(TrainingLicenseError);
    }
    expect(reader.readJsonl).not.toHaveBeenCalled(); // nothing was even read
    expect(importer.coordinator.getEntries('training')).toHaveLength(0);
  });

  it('still lets any licensed-or-not book contribute RAG chunks', async () => {
    files['books/x/rag.jsonl'] = [rag(0, 'partition table text'), rag(1, 'boot sector text')];
    const importer = new TrainingCorpusImporter(reader, POLICY);
    const chunks = await importer.importRag(book({ license_status: 'copyrighted' }));
    expect(chunks.map(c => c.id)).toEqual([`dabook:${SHA.slice(0, 12)}:c0`, `dabook:${SHA.slice(0, 12)}:c1`]);
    expect(importer.coordinator.getEntries('rag')).toHaveLength(2);
    expect(importer.coordinator.getEntries('rag')[0]).toMatchObject({ license: 'copyrighted', domain: 'rag' });
    expect(await importer.importRag(book({ datasets: {} }))).toEqual([]);
  });

  it('rejects a malformed rag record instead of importing partial data', async () => {
    files['books/x/rag.jsonl'] = [{ chunk_id: 'only' }];
    await expect(new TrainingCorpusImporter(reader, POLICY).importRag(book())).rejects.toThrow(/line 1 is invalid/);
  });

  it('imports sft (alpaca and chatml), pretrain and code records; drops heuristic and empty ones', async () => {
    files['books/x/sft.jsonl'] = [
      { id: 'sft_a', instruction: 'Explain X?', input: '', output: 'X is a thing.', generator: 'assist:m' },
      { id: 'sft_b', messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'Q?' }, { role: 'assistant', content: 'A.' }], generator: 'assist:m' },
      { id: 'sft_h', instruction: 'Template', output: 'Template answer', generator: 'heuristic' },
      { id: 'sft_e', instruction: '  ', output: '', generator: 'assist:m' }
    ];
    files['books/x/pretrain.jsonl'] = [{ doc_id: 'doc_000', text: 'A whole chapter of text.' }];
    files['books/x/code.jsonl'] = [{ code_id: 'code_0001', code: '$ sudo testdisk' }];
    const importer = new TrainingCorpusImporter(reader, POLICY);

    const records = await importer.importTraining(book(), ['sft', 'pretrain', 'code']);
    expect(records.map(r => r.id)).toEqual([
      `dabook:${SHA.slice(0, 12)}:sft:sft_a`, `dabook:${SHA.slice(0, 12)}:sft:sft_b`,
      `dabook:${SHA.slice(0, 12)}:pretrain:doc_000`, `dabook:${SHA.slice(0, 12)}:code:code_0001`
    ]);
    expect(records[0].text).toBe('Explain X?\nX is a thing.');
    expect(records[1].text).toBe('Q?\nA.'); // the system prompt is not training text
    expect(records.every(r => r.split === 'train' && r.bookSha256 === SHA)).toBe(true);
    expect(importer.coordinator.getEntries('training')).toHaveLength(4);
    expect(importer.coordinator.getEntries('training')[0]).toMatchObject({ license: 'owned', domain: 'training' });

    const withHeuristic = await new TrainingCorpusImporter(reader, POLICY).importTraining(book(), ['sft'], { includeHeuristic: true });
    expect(withHeuristic.some(r => r.generator === 'heuristic')).toBe(true);
  });

  it('reads per-split files when the book has splits', async () => {
    files['books/x/s/train.jsonl'] = [{ id: 'a', instruction: 'Q one here?', output: 'A one.' }];
    files['books/x/s/test.jsonl'] = [{ id: 'b', instruction: 'Q two here?', output: 'A two.' }];
    const records = await new TrainingCorpusImporter(reader, POLICY).importTraining(
      book({ splits: { sft: { train: 'books/x/s/train.jsonl', test: 'books/x/s/test.jsonl' } } as any }), ['sft']
    );
    expect(records.map(r => [r.id.split(':').pop(), r.split])).toEqual([['a', 'train'], ['b', 'test']]);
  });

  it('reports evaluation conflicts as blocked entries instead of importing them', async () => {
    files['books/x/pretrain.jsonl'] = [{ doc_id: 'leak', text: 'What file handles durable RAG chunk storage?' }, { doc_id: 'ok', text: 'Safe chapter text.' }];
    const importer = new TrainingCorpusImporter(reader, POLICY);
    expect(importer.registerEvaluation([{ id: 'eval1', text: 'what FILE handles durable rag chunk storage' }, { id: 'eval1', text: 'duplicate id is ignored' }])).toBe(1);

    const records = await importer.importTraining(book(), ['pretrain']);
    expect(records.map(r => r.id.split(':').pop())).toEqual(['ok']);
    expect(importer.blocked).toHaveLength(1);
    expect(importer.blocked[0]).toMatchObject({ domain: 'training', reason: expect.stringContaining('held-out evaluation entry') });
  });
});

describe('dabookRagRecordSchema is shared with the importer', () => {
  it('accepts the fields the importer reads', () => {
    expect(dabookRagRecordSchema.safeParse({
      chunk_id: 'c', book_sha256: SHA, page_start: 1, page_end: 1, breadcrumbs: [], node_ids: [], node_types: [], has_code: false, token_count: 1, content: 'x'
    }).success).toBe(true);
  });
});
