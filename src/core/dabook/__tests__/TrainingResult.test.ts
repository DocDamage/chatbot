import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FeedbackCollector } from '../../learning/FeedbackCollector';
import { ModelUpdater } from '../../learning/ModelUpdater';
import { artifactHash, prepareTrainingPlan } from '../training/TrainingPlan';
import {
  importTrainingResult,
  registerInactiveCandidate,
  TrainingResultManifest,
} from '../training/TrainingResult';

describe('governed training result lifecycle', () => {
  let bundle: string;
  let run: string;

  beforeEach(() => {
    bundle = fs.mkdtempSync(path.join(os.tmpdir(), 'training-result-bundle-'));
    run = fs.mkdtempSync(path.join(os.tmpdir(), 'training-result-run-'));
    fs.mkdirSync(path.join(bundle, 'sft'));
    fs.writeFileSync(
      path.join(bundle, 'sft', 'train.jsonl'),
      '{"generator":"assist:test","messages":[{"role":"user","content":"train question"},{"role":"assistant","content":"train answer"}]}\n'
    );
    fs.writeFileSync(
      path.join(bundle, 'sft', 'test.jsonl'),
      '{"generator":"assist:test","messages":[{"role":"user","content":"test question"},{"role":"assistant","content":"test answer"}]}\n'
    );
    fs.writeFileSync(
      path.join(bundle, 'manifest.json'),
      JSON.stringify({
        books: [{ license_status: 'owned' }],
        artifactHashes: {
          'sft/train.jsonl': artifactHash(path.join(bundle, 'sft', 'train.jsonl')),
          'sft/test.jsonl': artifactHash(path.join(bundle, 'sft', 'test.jsonl')),
        },
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
    prepareTrainingPlan(bundle, 'cpu-smoke/random-init');
    fs.writeFileSync(path.join(run, 'model.pt'), 'bounded model artifact');
    fs.writeFileSync(path.join(run, 'model-config.json'), '{"kind":"tiny"}\n');
    writeResult();
  });

  afterEach(() => {
    fs.rmSync(bundle, { recursive: true, force: true });
    fs.rmSync(run, { recursive: true, force: true });
  });

  const bundleHash = (relative: string) => artifactHash(path.join(bundle, relative));
  const runHash = (relative: string) => artifactHash(path.join(run, relative));

  function manifest(): TrainingResultManifest {
    return {
      schema: 'dabook.training-result.v1',
      status: 'completed',
      createdAt: '2026-11-01T12:00:00.000Z',
      engine: 'cpu-smoke',
      purpose: 'lifecycle-smoke-not-domain-model',
      baseModel: { name: 'cpu-smoke/random-init', kind: 'randomly-initialized-untrained' },
      plan: {
        sourceManifestSha256: bundleHash('manifest.json'),
        configSha256: bundleHash('training-plan/axolotl.json'),
      },
      datasets: {
        optimizer: [
          {
            split: 'train',
            relativePath: 'training-plan/train.jsonl',
            sha256: bundleHash('training-plan/train.jsonl'),
            records: 1,
          },
        ],
        heldOutTest: {
          split: 'test',
          relativePath: 'training-plan/test.jsonl',
          sha256: bundleHash('training-plan/test.jsonl'),
          records: 1,
        },
      },
      metrics: {
        initialHeldOutLoss: 5.5,
        finalTrainingLoss: 4.5,
        heldOutLoss: 5.1,
        heldOutPerplexity: Math.exp(5.1),
        trainingSteps: 2,
      },
      artifacts: [
        { relativePath: 'model.pt', sha256: runHash('model.pt') },
        { relativePath: 'model-config.json', sha256: runHash('model-config.json') },
      ],
    };
  }

  function writeResult(change?: (value: TrainingResultManifest) => void): void {
    const value = manifest();
    change?.(value);
    fs.writeFileSync(path.join(run, 'result-manifest.json'), JSON.stringify(value, null, 2));
  }

  it('rejects a base-model claim that contradicts the prepared plan', () => {
    writeResult((value) => {
      value.baseModel.name = 'another/base';
    });
    expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow(
      /base model/i
    );
  });

  it('rejects an Axolotl claim for a randomly initialized CPU artifact', () => {
    writeResult((value) => {
      value.engine = 'axolotl';
    });
    expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow(
      /base model/i
    );
  });

  it('rejects relabeling the reserved CPU base as pretrained Axolotl output', () => {
    writeResult((value) => {
      value.engine = 'axolotl';
      value.purpose = 'domain-model';
      value.baseModel.kind = 'pretrained';
    });
    expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow(
      /base model/i
    );
  });

  it('imports integrity-bound metrics and registers an inactive candidate without fake accuracy', () => {
    const result = importTrainingResult(bundle, path.join(run, 'result-manifest.json'));
    const updater = new ModelUpdater(new FeedbackCollector());
    const candidate = registerInactiveCandidate(result, updater);

    expect(result.manifest.metrics.heldOutLoss).toBe(5.1);
    expect(candidate.active).toBe(false);
    expect(candidate.performance).toBeUndefined();
    expect(candidate.trainingEvaluation).toMatchObject({
      engine: 'cpu-smoke',
      heldOutLoss: 5.1,
      heldOutPerplexity: Math.exp(5.1),
    });
    expect(updater.getCurrentVersion()).toBeNull();
  });

  it('rejects held-out leakage into optimizer inputs', () => {
    writeResult((value) => {
      value.datasets.optimizer[0] = { ...value.datasets.heldOutTest, split: 'train' };
    });
    expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow(
      /verified prepared plan/i
    );
  });

  it('rejects a false dataset record count', () => {
    writeResult((value) => {
      value.datasets.heldOutTest.records = 2;
    });
    expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow(
      /record count/i
    );
  });

  it('rejects an empty held-out test split even when its hash is declared', () => {
    fs.writeFileSync(path.join(bundle, 'sft', 'test.jsonl'), '');
    fs.writeFileSync(path.join(bundle, 'training-plan', 'test.jsonl'), '');
    writeResult((value) => {
      const sourceHash = bundleHash('sft/test.jsonl');
      const sourceManifest = JSON.parse(
        fs.readFileSync(path.join(bundle, 'manifest.json'), 'utf8')
      );
      sourceManifest.artifactHashes['sft/test.jsonl'] = sourceHash;
      fs.writeFileSync(path.join(bundle, 'manifest.json'), JSON.stringify(sourceManifest));
      value.plan.sourceManifestSha256 = bundleHash('manifest.json');
      value.datasets.heldOutTest.sha256 = bundleHash('training-plan/test.jsonl');
    });
    expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow(
      /held-out test/i
    );
  });

  it('rejects a missing held-out test split', () => {
    fs.unlinkSync(path.join(bundle, 'training-plan', 'test.jsonl'));
    expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow();
  });

  it('rejects normalized conversation overlap across optimizer and held-out splits', () => {
    const overlapping =
      '{"generator":"assist:test","messages":[{"role":"user","content":" train   question "},{"role":"assistant","content":"train answer"}]}\n';
    fs.writeFileSync(path.join(bundle, 'sft', 'test.jsonl'), overlapping);
    fs.writeFileSync(path.join(bundle, 'training-plan', 'test.jsonl'), overlapping);
    writeResult((value) => {
      const sourceManifest = JSON.parse(
        fs.readFileSync(path.join(bundle, 'manifest.json'), 'utf8')
      );
      sourceManifest.artifactHashes['sft/test.jsonl'] = bundleHash('sft/test.jsonl');
      fs.writeFileSync(path.join(bundle, 'manifest.json'), JSON.stringify(sourceManifest));
      value.plan.sourceManifestSha256 = bundleHash('manifest.json');
      value.datasets.heldOutTest.sha256 = bundleHash('training-plan/test.jsonl');
    });
    expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow(
      /held-out test.*optimizer/i
    );
  });

  it.each([
    [
      'mutated source',
      () => fs.appendFileSync(path.join(bundle, 'training-plan', 'test.jsonl'), '{}\n'),
    ],
    ['mutated artifact', () => fs.appendFileSync(path.join(run, 'model.pt'), 'tamper')],
    [
      'non-finite metric',
      () =>
        writeResult((value) => {
          value.metrics.heldOutLoss = Number.NaN;
        }),
    ],
  ])('rejects %s', (_name, mutate) => {
    mutate();
    expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow();
  });

  it('rejects an artifact path that escapes the run directory', () => {
    writeResult((value) => {
      value.artifacts[0].relativePath = '../model.pt';
    });
    expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow(
      /unsafe artifact path/i
    );
  });

  it('does not permit a random-init smoke base to be relabeled as an Axolotl result', () => {
    writeResult((value) => {
      value.engine = 'axolotl';
      value.purpose = 'domain-model';
    });
    expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow(
      /pretrained base/i
    );
  });

  it.each([
    ['contaminated governance', (value: any) => (value.governance.contaminated = true)],
    ['copyrighted source', (value: any) => (value.books[0].license_status = 'copyrighted')],
  ])(
    'independently rejects %s even when the result declares the new manifest hash',
    (_name, mutate) => {
      const sourcePath = path.join(bundle, 'manifest.json');
      const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
      mutate(source);
      fs.writeFileSync(sourcePath, JSON.stringify(source));
      writeResult((value) => {
        value.plan.sourceManifestSha256 = bundleHash('manifest.json');
      });
      expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow();
    }
  );

  it('rejects a result whose declared split no longer matches the prepared plan', () => {
    writeResult((value) => {
      value.datasets.optimizer[0].relativePath = 'training-plan/test.jsonl';
      value.datasets.optimizer[0].sha256 = value.datasets.heldOutTest.sha256;
    });
    expect(() => importTrainingResult(bundle, path.join(run, 'result-manifest.json'))).toThrow(
      /verified prepared plan/i
    );
  });
});
