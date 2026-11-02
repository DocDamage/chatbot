import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface TrainingPlanOptions {
  allowIntegrationFixture?: boolean;
}

export interface VerifiedTrainingSplit {
  split: 'train' | 'val' | 'test';
  sourceRelative: string;
  preparedRelative: string;
  content: string;
  records: number;
}

export interface VerifiedTrainingBundle {
  root: string;
  manifest: Record<string, any>;
  origin: 'exporter' | 'integration-fixture';
  splits: Partial<Record<'train' | 'val' | 'test', VerifiedTrainingSplit>>;
}

export interface VerifiedPreparedPlan extends VerifiedTrainingBundle {
  configPath: string;
  config: Record<string, any>;
  prepared: Record<'train' | 'test', PreparedSplit> & Partial<Record<'val', PreparedSplit>>;
}

interface PreparedSplit {
  path: string;
  relativePath: string;
  sha256: string;
  records: number;
}

export function artifactHash(file: string): string {
  const hash = crypto.createHash('sha256'),
    buffer = Buffer.alloc(64 * 1024),
    descriptor = fs.openSync(file, 'r');
  try {
    let bytes: number;
    while ((bytes = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0)
      hash.update(buffer.subarray(0, bytes));
    return hash.digest('hex');
  } finally {
    fs.closeSync(descriptor);
  }
}

function boundedJson(file: string, limit: number, message: string): any {
  if (fs.statSync(file).size > limit) throw new Error(message);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function safeExistingFile(root: string, relative: string, message: string): string {
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) throw new Error(message);
  const actual = fs.realpathSync(file);
  if (!actual.startsWith(root + path.sep) || fs.lstatSync(file).isSymbolicLink())
    throw new Error(message);
  return actual;
}

function normalizeRecords(file: string): { content: string; records: number } {
  const records = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line));
  if (records.length > 50000) throw new Error('Training split exceeds 50,000 records.');
  const normalized = records.map(record => {
    if (record.generator === 'heuristic' || !record.generator?.startsWith('assist:'))
      throw new Error('Only assisted SFT records may enter this training plan.');
    const messages = record.messages || [
      ...(record.system ? [{ role: 'system', content: record.system }] : []),
      {
        role: 'user',
        content: `${record.instruction || ''}${record.input ? `\n${record.input}` : ''}`,
      },
      { role: 'assistant', content: record.output },
    ];
    if (
      !Array.isArray(messages) ||
      !messages.length ||
      messages.some(
        (message: any) =>
          !['system', 'user', 'assistant'].includes(message.role) ||
          typeof message.content !== 'string' ||
          !message.content.trim()
      ) ||
      !messages.some((message: any) => message.role === 'assistant')
    )
      throw new Error('Malformed SFT conversation.');
    return { ...record, messages };
  });
  return {
    content: normalized.length ? normalized.map(record => JSON.stringify(record)).join('\n') + '\n' : '',
    records: normalized.length,
  };
}

export function verifyTrainingBundle(
  bundleDirectory: string,
  options: TrainingPlanOptions = {}
): VerifiedTrainingBundle {
  const root = fs.realpathSync(bundleDirectory);
  const manifestFile = safeExistingFile(root, 'manifest.json', 'Training manifest is missing.');
  const manifest = boundedJson(manifestFile, 4 * 1024 * 1024, 'Training manifest exceeds 4 MiB.');
  const governance = manifest.governance;
  const exporter = governance?.generatedBy === 'chatbot-training-exporter';
  const fixture =
    options.allowIntegrationFixture === true &&
    governance?.generatedBy === 'chatbot-training-integration-fixture' &&
    manifest.schema === 'dabook.explicit-integration-fixture.v1' &&
    manifest.fixture === true &&
    manifest.authority === 'assistant-authored-test-data-only';
  if (
    (!exporter && !fixture) ||
    governance.contaminated !== false ||
    governance.audit?.evaluationOverlapsWithTraining !== 0 ||
    governance.audit?.evaluationOverlapsWithRag !== 0 ||
    governance.audit?.registrationConflicts !== 0 ||
    governance.embeddedEvaluationScan?.matches !== 0 ||
    !Number.isSafeInteger(governance.evaluation?.items) ||
    governance.evaluation.items <= 0
  )
    throw new Error('Training requires a governed, uncontaminated export with held-out evaluation evidence.');
  if (
    !manifest.books?.length ||
    manifest.books.some(
      (book: any) => !['owned', 'permissive', 'public_domain'].includes(book.license_status)
    )
  )
    throw new Error('Training bundle has an ineligible license.');

  const splits: VerifiedTrainingBundle['splits'] = {};
  for (const split of ['train', 'val', 'test'] as const) {
    const sourceRelative = `sft/${split}.jsonl`;
    if (!fs.existsSync(path.join(root, sourceRelative))) continue;
    const file = safeExistingFile(root, sourceRelative, `Training artifact integrity failed: ${sourceRelative}`);
    if (fs.statSync(file).size > 32 * 1024 * 1024)
      throw new Error('Training split exceeds 32 MiB.');
    if (artifactHash(file) !== manifest.artifactHashes?.[sourceRelative])
      throw new Error(`Training artifact integrity failed: ${sourceRelative}`);
    const normalized = normalizeRecords(file);
    if (!normalized.records) continue;
    splits[split] = {
      split,
      sourceRelative,
      preparedRelative: `training-plan/${split}.jsonl`,
      ...normalized,
    };
  }
  if (!splits.train) throw new Error('No assisted SFT training split was exported.');
  return { root, manifest, origin: fixture ? 'integration-fixture' : 'exporter', splits };
}

export function verifyPreparedTrainingPlan(
  bundleDirectory: string,
  options: TrainingPlanOptions = {}
): VerifiedPreparedPlan {
  const verified = verifyTrainingBundle(bundleDirectory, options);
  if (!verified.splits.test) throw new Error('Prepared training requires a held-out test split.');
  const prepared: Partial<Record<'train' | 'val' | 'test', PreparedSplit>> = {};
  for (const split of ['train', 'val', 'test'] as const) {
    const expected = verified.splits[split];
    if (!expected) continue;
    const file = safeExistingFile(verified.root, expected.preparedRelative, 'Prepared training split is missing or unsafe.');
    if (fs.statSync(file).size > 32 * 1024 * 1024 || fs.readFileSync(file, 'utf8') !== expected.content)
      throw new Error(`Prepared ${split} split no longer matches its governed source.`);
    prepared[split] = {
      path: file,
      relativePath: expected.preparedRelative,
      sha256: artifactHash(file),
      records: expected.records,
    };
  }
  const configPath = safeExistingFile(
    verified.root,
    'training-plan/axolotl.json',
    'Prepared training config is missing or unsafe.'
  );
  const config = boundedJson(configPath, 4 * 1024 * 1024, 'Training config exceeds 4 MiB.');
  const normalizedPath = (value: unknown) => path.resolve(String(value)).replace(/\\/g, '/');
  if (
    config.datasets?.length !== 1 ||
    normalizedPath(config.datasets[0]?.path) !== prepared.train?.path.replace(/\\/g, '/') ||
    (prepared.val
      ? config.test_datasets?.length !== 1 ||
        normalizedPath(config.test_datasets[0]?.path) !== prepared.val.path.replace(/\\/g, '/')
      : config.test_datasets !== undefined) ||
    JSON.stringify(config).includes(prepared.test?.path.replace(/\\/g, '/') ?? 'missing-test')
  )
    throw new Error('Prepared training config has invalid split wiring.');
  return {
    ...verified,
    configPath,
    config,
    prepared: prepared as VerifiedPreparedPlan['prepared'],
  };
}
