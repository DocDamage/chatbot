import fs from 'fs';
import os from 'os';
import path from 'path';
import { artifactHash, prepareTrainingPlan } from '../training/TrainingPlan';

describe('governed trainer handoff', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-plan-'));
    fs.mkdirSync(path.join(root, 'sft'));
    const row = {
      instruction: 'Explain orbit',
      output: 'An orbit is a trajectory.',
      generator: 'assist:local',
      book_sha256: 'a'.repeat(64),
    };
    for (const split of ['train', 'val', 'test'])
      fs.writeFileSync(path.join(root, 'sft', `${split}.jsonl`), JSON.stringify(row) + '\n');
    fs.writeFileSync(
      path.join(root, 'manifest.json'),
      JSON.stringify({
        books: [{ license_status: 'owned' }],
        artifactHashes: Object.fromEntries(
          ['train', 'val', 'test'].map((split) => [
            `sft/${split}.jsonl`,
            artifactHash(path.join(root, 'sft', `${split}.jsonl`)),
          ])
        ),
        governance: {
          generatedBy: 'chatbot-training-exporter',
          contaminated: false,
          audit: {
            evaluationOverlapsWithTraining: 0,
            evaluationOverlapsWithRag: 0,
            registrationConflicts: 0,
          },
          embeddedEvaluationScan: { matches: 0 },
          evaluation: { items: 1 },
        },
      })
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  it('prepares an Axolotl config and keeps the test split held out', () => {
    const result = prepareTrainingPlan(root, 'local/base');
    const config = JSON.parse(fs.readFileSync(result.configPath, 'utf8'));
    expect(result.trainingStarted).toBe(false);
    expect(result.heldOutTest).toContain('test.jsonl');
    expect(config.datasets).toHaveLength(1);
    expect(config.datasets[0].path).toContain('train.jsonl');
    expect(config.test_datasets[0].path).toContain('val.jsonl');
    expect(JSON.stringify(config)).not.toContain('test.jsonl');
  });
  it('accepts only an explicitly labeled assistant-authored integration fixture origin', () => {
    rewriteManifest(manifest => {
      manifest.schema = 'dabook.explicit-integration-fixture.v1';
      manifest.fixture = true;
      manifest.authority = 'assistant-authored-test-data-only';
      manifest.governance.generatedBy = 'chatbot-training-integration-fixture';
    });
    expect(() => prepareTrainingPlan(root, 'cpu-smoke/random-init')).toThrow(/held-out evaluation/);
    expect(
      prepareTrainingPlan(root, 'cpu-smoke/random-init', { allowIntegrationFixture: true }).status
    ).toBe('prepared');
  });
  it('refuses mutated artifacts before writing a plan', () => {
    fs.appendFileSync(path.join(root, 'sft/train.jsonl'), '{}\n');
    expect(() => prepareTrainingPlan(root, 'local/base')).toThrow(/integrity/);
    expect(fs.existsSync(path.join(root, 'training-plan'))).toBe(false);
  });

  function rewriteManifest(change: (manifest: any) => void) {
    const file = path.join(root, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    change(manifest);
    fs.writeFileSync(file, JSON.stringify(manifest));
  }

  function rewriteRows(rows: unknown[]) {
    const file = path.join(root, 'sft/train.jsonl');
    fs.writeFileSync(file, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
    rewriteManifest((manifest) => {
      manifest.artifactHashes['sft/train.jsonl'] = artifactHash(file);
    });
  }

  it.each(['', ' '.repeat(3), 'a'.repeat(301)])(
    'rejects an invalid base model before staging: %j',
    (model) => {
      expect(() => prepareTrainingPlan(root, model)).toThrow(/base model/);
    }
  );

  it.each([
    (m: any) => {
      delete m.governance;
    },
    (m: any) => {
      m.governance.generatedBy = 'unknown';
    },
    (m: any) => {
      m.governance.contaminated = true;
    },
    (m: any) => {
      m.governance.audit.evaluationOverlapsWithTraining = 1;
    },
    (m: any) => {
      m.governance.audit.evaluationOverlapsWithRag = 1;
    },
    (m: any) => {
      m.governance.audit.registrationConflicts = 1;
    },
    (m: any) => {
      m.governance.embeddedEvaluationScan.matches = 1;
    },
    (m: any) => {
      m.governance.evaluation.items = 0;
    },
    (m: any) => {
      m.governance.evaluation.items = 1.5;
    },
  ])('refuses absent or contaminated evaluation evidence %#', (change) => {
    rewriteManifest(change);
    expect(() => prepareTrainingPlan(root, 'local/base')).toThrow(/held-out evaluation/);
    expect(fs.existsSync(path.join(root, 'training-plan'))).toBe(false);
  });

  it.each(
    [
      [],
      [{ license_status: 'unknown' }],
      [{ license_status: 'owned' }, { license_status: 'restricted' }],
    ].map((books) => ({ books }))
  )('rejects ineligible book licenses %j', ({ books }) => {
    rewriteManifest((manifest) => {
      manifest.books = books;
    });
    expect(() => prepareTrainingPlan(root, 'local/base')).toThrow(/license/);
  });

  it.each([
    { generator: 'heuristic', instruction: 'Explain', output: 'Answer' },
    { instruction: 'Explain', output: 'Answer' },
    { generator: 'assist:local', messages: [] },
    { generator: 'assist:local', messages: [{ role: 'tool', content: 'answer' }] },
    { generator: 'assist:local', messages: [{ role: 'assistant', content: '  ' }] },
    { generator: 'assist:local', messages: [{ role: 'assistant', content: 12 }] },
    { generator: 'assist:local', messages: [{ role: 'user', content: 'question' }] },
  ])('rejects unsuitable or malformed SFT rows %#', (row) => {
    rewriteRows([row]);
    expect(() => prepareTrainingPlan(root, 'local/base')).toThrow(/assisted SFT|Malformed SFT/);
  });

  it('normalizes system and input fields and supports a train-only export', () => {
    rewriteRows([
      {
        generator: 'assist:local',
        system: 'Be precise.',
        instruction: 'Explain',
        input: 'orbit',
        output: 'A trajectory.',
      },
    ]);
    fs.unlinkSync(path.join(root, 'sft/val.jsonl'));
    fs.writeFileSync(path.join(root, 'sft/test.jsonl'), '');
    rewriteManifest((manifest) => {
      manifest.artifactHashes['sft/test.jsonl'] = artifactHash(path.join(root, 'sft/test.jsonl'));
    });
    const result = prepareTrainingPlan(root, 'local/base');
    const config = JSON.parse(fs.readFileSync(result.configPath, 'utf8'));
    const record = JSON.parse(
      fs.readFileSync(path.join(root, 'training-plan/train.jsonl'), 'utf8')
    );
    expect(record.messages).toEqual([
      { role: 'system', content: 'Be precise.' },
      { role: 'user', content: 'Explain\norbit' },
      { role: 'assistant', content: 'A trajectory.' },
    ]);
    expect(config.test_datasets).toBeUndefined();
    expect(result.heldOutTest).toBeUndefined();
    expect(() => prepareTrainingPlan(root, 'local/base')).toThrow(/already exists/);
  });

  it('requires a nonempty train split even when validation data exists', () => {
    fs.unlinkSync(path.join(root, 'sft/train.jsonl'));
    expect(() => prepareTrainingPlan(root, 'local/base')).toThrow(/No assisted SFT/);
  });

  it('removes staging files when the atomic publication fails', () => {
    const rename = jest.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw new Error('publication denied');
    });
    try {
      expect(() => prepareTrainingPlan(root, 'local/base')).toThrow('publication denied');
    } finally {
      rename.mockRestore();
    }
    expect(fs.readdirSync(root).filter((name) => name.startsWith('.training-plan-'))).toEqual([]);
  });

  it.each([
    ['manifest.json', 4 * 1024 * 1024 + 1, /manifest exceeds/],
    ['sft/train.jsonl', 32 * 1024 * 1024 + 1, /split exceeds/],
  ] as const)('bounds input allocation before reading %s', (relative, size, message) => {
    fs.truncateSync(path.join(root, relative), size);
    expect(() => prepareTrainingPlan(root, 'local/base')).toThrow(message);
    expect(fs.existsSync(path.join(root, 'training-plan'))).toBe(false);
  });

  it('requires export hashes even for an otherwise valid conversation', () => {
    rewriteManifest((manifest) => {
      delete manifest.artifactHashes;
    });
    expect(() => prepareTrainingPlan(root, 'local/base')).toThrow(/integrity/);
  });
});
