import fs from 'node:fs';
import path from 'node:path';
import { artifactHash, prepareTrainingPlan } from '../../src/core/dabook/training/TrainingPlan';

const [output] = process.argv.slice(2);
if (!output || process.argv.length !== 3)
  throw new Error('Usage: tsx scripts/dabook/create-training-smoke-fixture.ts <empty-output-directory>');

const root = path.resolve(output);
if (fs.existsSync(root) && fs.readdirSync(root).length > 0)
  throw new Error('Fixture output directory must not exist or must be empty.');
fs.mkdirSync(path.join(root, 'sft'), { recursive: true });

const records = (split: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `explicit-codex-integration-fixture:${split}:${index}`,
    generator: 'assist:codex',
    license_status: 'owned',
    book_sha256: 'a'.repeat(64),
    messages: [
      { role: 'system', content: 'Answer the bounded integration fixture question.' },
      { role: 'user', content: `What is fixture concept ${split}-${index}?` },
      {
        role: 'assistant',
        content: `Fixture concept ${split}-${index} is synthetic assistant-authored lifecycle test data.`,
      },
    ],
  }));

for (const [split, count] of [
  ['train', 4],
  ['val', 2],
  ['test', 2],
] as const) {
  fs.writeFileSync(
    path.join(root, 'sft', `${split}.jsonl`),
    records(split, count)
      .map(record => JSON.stringify(record))
      .join('\n') + '\n'
  );
}

const artifactHashes = Object.fromEntries(
  ['train', 'val', 'test'].map(split => {
    const relative = `sft/${split}.jsonl`;
    return [relative, artifactHash(path.join(root, relative))];
  })
);
fs.writeFileSync(
  path.join(root, 'manifest.json'),
  JSON.stringify(
    {
      schema: 'dabook.explicit-integration-fixture.v1',
      fixture: true,
      authority: 'assistant-authored-test-data-only',
      books: [{ license_status: 'owned', sha256: 'a'.repeat(64) }],
      artifactHashes,
      governance: {
        generatedBy: 'chatbot-training-integration-fixture',
        contaminated: false,
        audit: {
          evaluationOverlapsWithTraining: 0,
          evaluationOverlapsWithRag: 0,
          registrationConflicts: 0,
        },
        embeddedEvaluationScan: { matches: 0 },
        evaluation: { items: 2, fixture: true },
      },
    },
    null,
    2
  ) + '\n'
);

console.log(
  JSON.stringify(
    {
      fixture: true,
      ...prepareTrainingPlan(root, 'cpu-smoke/random-init', { allowIntegrationFixture: true }),
    },
    null,
    2
  )
);
