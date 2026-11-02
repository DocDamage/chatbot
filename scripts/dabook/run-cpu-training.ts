import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FeedbackCollector } from '../../src/core/learning/FeedbackCollector';
import { ModelUpdater } from '../../src/core/learning/ModelUpdater';
import {
  importTrainingResult,
  registerInactiveCandidate,
} from '../../src/core/dabook/training/TrainingResult';
import {
  artifactHash,
  verifyPreparedTrainingPlan,
} from '../../src/core/dabook/training/TrainingPlan';

const [bundleArg, pythonArg, outputArg] = process.argv.slice(2);
if (!bundleArg || !pythonArg || !outputArg || process.argv.length !== 5)
  throw new Error(
    'Usage: tsx scripts/dabook/run-cpu-training.ts <governed-bundle> <python-executable> <empty-output-directory>'
  );

const bundle = path.resolve(bundleArg);
const python = path.resolve(pythonArg);
const output = path.resolve(outputArg);
if (!fs.statSync(python).isFile()) throw new Error('Python executable does not exist.');
const verified = verifyPreparedTrainingPlan(bundle, { allowIntegrationFixture: true });
if (verified.config.base_model !== 'cpu-smoke/random-init')
  throw new Error('CPU smoke training requires the cpu-smoke/random-init base.');
if (fs.existsSync(output) && fs.readdirSync(output).length > 0)
  throw new Error('Training output directory must not exist or must be empty.');
fs.mkdirSync(output, { recursive: true });
const attestationPath = path.join(output, 'launch-attestation.json');
const attestation = {
  schema: 'dabook.cpu-smoke-launch.v1',
  purpose: 'lifecycle-smoke-not-domain-model',
  fixtureOptIn: verified.origin === 'integration-fixture',
  sourceManifestSha256: artifactHash(path.join(verified.root, 'manifest.json')),
  configSha256: artifactHash(verified.configPath),
  trainSha256: verified.prepared.train.sha256,
  heldOutTestSha256: verified.prepared.test.sha256,
};
fs.writeFileSync(`${attestationPath}.tmp`, JSON.stringify(attestation, null, 2) + '\n');
fs.renameSync(`${attestationPath}.tmp`, attestationPath);

const trainer = path.resolve(__dirname, 'cpu_train_smoke.py');
const training = spawnSync(
  python,
  [trainer, bundle, output, '--launch-attestation', attestationPath],
  {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5 * 60 * 1000,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, PYTHONUTF8: '1' },
  }
);
if (training.error) throw training.error;
if (training.status !== 0)
  throw new Error(
    `CPU smoke training failed (${training.status}): ${training.stderr.slice(-4000)}`
  );

const imported = importTrainingResult(bundle, path.join(output, 'result-manifest.json'));
const updater = new ModelUpdater(new FeedbackCollector());
const candidate = registerInactiveCandidate(imported, updater);
const registration = {
  schema: 'dabook.inactive-candidate-registration.v1',
  registeredAt: candidate.createdAt.toISOString(),
  candidate: {
    id: candidate.id,
    version: candidate.version,
    active: candidate.active,
    trainingEvaluation: candidate.trainingEvaluation,
  },
  activationAttempted: false,
  registryDurability: 'evidence-file-plus-process-local-model-updater',
};
const registrationPath = path.join(output, 'candidate-registration.json');
const temporary = `${registrationPath}.tmp`;
fs.writeFileSync(temporary, JSON.stringify(registration, null, 2) + '\n');
fs.renameSync(temporary, registrationPath);
console.log(
  JSON.stringify(
    {
      resultManifest: imported.manifestPath,
      metrics: imported.manifest.metrics,
      candidate: registration.candidate,
      registrationPath,
    },
    null,
    2
  )
);
