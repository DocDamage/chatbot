import fs from 'node:fs';
import path from 'node:path';
import { ModelUpdater, ModelVersion, TrainingCandidateEvidence } from '../../learning/ModelUpdater';
import { artifactHash, verifyPreparedTrainingPlan } from './TrainingPlan';

export interface TrainingDatasetEvidence {
  split: 'train' | 'validation' | 'test';
  relativePath: string;
  sha256: string;
  records: number;
}

export interface TrainingResultManifest {
  schema: 'dabook.training-result.v1';
  status: 'completed';
  createdAt: string;
  engine: 'cpu-smoke' | 'axolotl';
  purpose: string;
  baseModel: {
    name: string;
    kind: 'randomly-initialized-untrained' | 'pretrained';
  };
  plan: { sourceManifestSha256: string; configSha256: string };
  datasets: {
    optimizer: TrainingDatasetEvidence[];
    validation?: TrainingDatasetEvidence;
    heldOutTest: TrainingDatasetEvidence;
  };
  metrics: {
    initialHeldOutLoss: number;
    finalTrainingLoss: number;
    heldOutLoss: number;
    heldOutPerplexity: number;
    trainingSteps: number;
  };
  artifacts: Array<{ relativePath: string; sha256: string }>;
}

export interface ImportedTrainingResult {
  manifest: TrainingResultManifest;
  manifestPath: string;
  primaryArtifact: { path: string; sha256: string };
}

const SHA256 = /^[0-9a-f]{64}$/i;

function readBoundedJson(file: string): unknown {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 4 * 1024 * 1024)
    throw new Error('Training result manifest must be a file no larger than 4 MiB.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function safeFile(root: string, relative: string, label: string): string {
  if (!relative || path.isAbsolute(relative)) throw new Error(`Unsafe ${label} path.`);
  const resolvedRoot = fs.realpathSync(root);
  const candidate = path.resolve(resolvedRoot, relative);
  if (!candidate.startsWith(resolvedRoot + path.sep)) throw new Error(`Unsafe ${label} path.`);
  const actual = fs.realpathSync(candidate);
  if (!actual.startsWith(resolvedRoot + path.sep) || fs.lstatSync(candidate).isSymbolicLink())
    throw new Error(`Unsafe ${label} path.`);
  return actual;
}

function verifyHash(file: string, expected: string, label: string): void {
  if (!SHA256.test(expected) || artifactHash(file) !== expected)
    throw new Error(`${label} integrity check failed.`);
}

function inspectRecords(file: string): Set<string> {
  if (fs.statSync(file).size > 32 * 1024 * 1024)
    throw new Error('Training result dataset exceeds 32 MiB.');
  const lines = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (!lines.length) throw new Error('Training result dataset is empty.');
  if (lines.length > 50000) throw new Error('Training result dataset exceeds 50,000 records.');
  const fingerprints = new Set<string>();
  for (const line of lines) {
    const record = JSON.parse(line) as { messages?: Array<{ role?: unknown; content?: unknown }> };
    if (
      !Array.isArray(record.messages) ||
      !record.messages.length ||
      record.messages.some(
        (message) =>
          !['system', 'user', 'assistant'].includes(String(message.role)) ||
          typeof message.content !== 'string' ||
          !message.content.trim()
      )
    )
      throw new Error('Training result dataset contains a malformed conversation.');
    const normalized = record.messages.map((message) => ({
      role: message.role,
      content: (message.content as string).trim().replace(/\s+/g, ' '),
    }));
    fingerprints.add(JSON.stringify(normalized));
  }
  return fingerprints;
}

function assertDataset(
  bundleRoot: string,
  evidence: TrainingDatasetEvidence,
  expectedSplit: TrainingDatasetEvidence['split']
): { file: string; fingerprints: Set<string> } {
  if (
    evidence.split !== expectedSplit ||
    !Number.isSafeInteger(evidence.records) ||
    evidence.records <= 0
  ) {
    throw new Error(`Invalid ${expectedSplit} dataset evidence.`);
  }
  const file = safeFile(bundleRoot, evidence.relativePath, 'dataset');
  verifyHash(file, evidence.sha256, `${expectedSplit} dataset`);
  const fingerprints = inspectRecords(file);
  if (fingerprints.size !== evidence.records)
    throw new Error(`${expectedSplit} dataset record count does not match the artifact.`);
  return { file, fingerprints };
}

function assertManifestShape(value: unknown): asserts value is TrainingResultManifest {
  const result = value as Partial<TrainingResultManifest>;
  if (
    !result ||
    result.schema !== 'dabook.training-result.v1' ||
    result.status !== 'completed' ||
    !['cpu-smoke', 'axolotl'].includes(result.engine ?? '') ||
    !result.purpose?.trim() ||
    !result.baseModel?.name?.trim() ||
    !['randomly-initialized-untrained', 'pretrained'].includes(result.baseModel.kind) ||
    !result.plan ||
    result.datasets?.optimizer?.length !== 1 ||
    !result.datasets.heldOutTest ||
    !result.metrics ||
    !result.artifacts?.length
  ) {
    throw new Error('Malformed training result manifest.');
  }
  if (
    result.engine === 'cpu-smoke' &&
    (result.baseModel.kind !== 'randomly-initialized-untrained' ||
      result.purpose !== 'lifecycle-smoke-not-domain-model')
  ) {
    throw new Error('CPU smoke results must identify their untrained base and smoke-only purpose.');
  }
  if (result.engine === 'axolotl' && result.baseModel.kind !== 'pretrained')
    throw new Error('Axolotl results must identify a pretrained base model.');
}

export function importTrainingResult(
  bundleDirectory: string,
  resultManifestPath: string
): ImportedTrainingResult {
  const bundleRoot = fs.realpathSync(bundleDirectory);
  const manifestPath = fs.realpathSync(resultManifestPath);
  const runRoot = path.dirname(manifestPath);
  const value = readBoundedJson(manifestPath);
  assertManifestShape(value);
  const verifiedPlan = verifyPreparedTrainingPlan(bundleRoot, {
    allowIntegrationFixture: value.engine === 'cpu-smoke',
  });
  if (
    value.baseModel.name !== verifiedPlan.config.base_model ||
    (value.engine === 'cpu-smoke' && value.baseModel.name !== 'cpu-smoke/random-init') ||
    (value.engine === 'axolotl' &&
      (value.baseModel.kind !== 'pretrained' || value.baseModel.name === 'cpu-smoke/random-init'))
  )
    throw new Error('Training result base model does not match its prepared plan and engine.');
  if (verifiedPlan.origin === 'integration-fixture' && value.engine !== 'cpu-smoke')
    throw new Error('Integration fixture results are CPU lifecycle smoke evidence only.');

  verifyHash(
    safeFile(bundleRoot, 'manifest.json', 'plan source manifest'),
    value.plan.sourceManifestSha256,
    'Plan source manifest'
  );

  const declaredValidation = value.datasets.validation;
  if (
    value.datasets.optimizer[0].relativePath.replace(/\\/g, '/') !==
      verifiedPlan.prepared.train.relativePath ||
    value.datasets.optimizer[0].sha256 !== verifiedPlan.prepared.train.sha256 ||
    value.datasets.heldOutTest.relativePath.replace(/\\/g, '/') !==
      verifiedPlan.prepared.test.relativePath ||
    value.datasets.heldOutTest.sha256 !== verifiedPlan.prepared.test.sha256 ||
    Boolean(declaredValidation) !== Boolean(verifiedPlan.prepared.val) ||
    (declaredValidation &&
      (declaredValidation.relativePath.replace(/\\/g, '/') !==
        verifiedPlan.prepared.val?.relativePath ||
        declaredValidation.sha256 !== verifiedPlan.prepared.val?.sha256))
  )
    throw new Error('Training result datasets do not match the verified prepared plan.');
  verifyHash(
    safeFile(bundleRoot, 'training-plan/axolotl.json', 'training config'),
    value.plan.configSha256,
    'Training config'
  );

  const optimizerInputs = value.datasets.optimizer.map((item) =>
    assertDataset(bundleRoot, item, 'train')
  );
  const heldOut = assertDataset(bundleRoot, value.datasets.heldOutTest, 'test');
  const optimizerFingerprints = new Set(
    optimizerInputs.flatMap((input) => [...input.fingerprints])
  );
  if (
    optimizerInputs.some((input) => input.file === heldOut.file) ||
    value.datasets.optimizer.some((item) => item.sha256 === value.datasets.heldOutTest.sha256) ||
    [...heldOut.fingerprints].some((fingerprint) => optimizerFingerprints.has(fingerprint))
  )
    throw new Error('The held-out test dataset appears in optimizer inputs.');
  if (value.datasets.validation) {
    const validation = assertDataset(bundleRoot, value.datasets.validation, 'validation');
    if (
      validation.file === heldOut.file ||
      value.datasets.validation.sha256 === value.datasets.heldOutTest.sha256 ||
      [...heldOut.fingerprints].some((fingerprint) => validation.fingerprints.has(fingerprint))
    )
      throw new Error('The held-out test dataset appears in validation inputs.');
  }

  const metrics = value.metrics;
  if (
    ![
      metrics.initialHeldOutLoss,
      metrics.finalTrainingLoss,
      metrics.heldOutLoss,
      metrics.heldOutPerplexity,
    ].every((metric) => Number.isFinite(metric) && metric >= 0) ||
    !Number.isSafeInteger(metrics.trainingSteps) ||
    metrics.trainingSteps <= 0 ||
    Math.abs(Math.log(metrics.heldOutPerplexity) - metrics.heldOutLoss) > 1e-6
  ) {
    throw new Error('Training metrics must be finite, non-negative values from a completed run.');
  }

  const artifacts = value.artifacts.map((item) => {
    const file = safeFile(runRoot, item.relativePath, 'artifact');
    verifyHash(file, item.sha256, 'Training artifact');
    return { path: file, sha256: item.sha256 };
  });
  return { manifest: value, manifestPath, primaryArtifact: artifacts[0] };
}

export function registerInactiveCandidate(
  result: ImportedTrainingResult,
  updater: ModelUpdater
): ModelVersion {
  const evidence: TrainingCandidateEvidence = {
    engine: result.manifest.engine,
    purpose: result.manifest.purpose,
    resultManifest: result.manifestPath,
    artifactSha256: result.primaryArtifact.sha256,
    planSourceSha256: result.manifest.plan.sourceManifestSha256,
    planConfigSha256: result.manifest.plan.configSha256,
    trainSha256: result.manifest.datasets.optimizer[0].sha256,
    heldOutTestSha256: result.manifest.datasets.heldOutTest.sha256,
    heldOutLoss: result.manifest.metrics.heldOutLoss,
    heldOutPerplexity: result.manifest.metrics.heldOutPerplexity,
    heldOutExamples: result.manifest.datasets.heldOutTest.records,
    trainingSteps: result.manifest.metrics.trainingSteps,
  };
  return updater.createTrainingCandidate(evidence);
}
