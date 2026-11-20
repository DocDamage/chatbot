import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { embeddingSpaceId, validateEmbedding } from '../../src/knowledge/EmbeddingSpace';
import type { EmbeddingSpaceSpec } from '../../src/knowledge/EmbeddingSpace';

const space: EmbeddingSpaceSpec = {
  provider: 'local-transformers', model: 'example-semantic-encoder', revision: 'sha256:weights-2026-01',
  dimensions: 2, preprocessingVersion: 'paired-prefixes-v1', pooling: 'mean', normalization: 'l2', distance: 'cosine',
};
const record = { origin: 'semantic-model', space, values: [0.6, 0.8] };

test('valid model output returns immutable copied vectors with model-space identity', () => {
  const input = { ...record, values: [0.6, 0.8] };
  const result = validateEmbedding(input, space);
  assert.equal(result.norm, 1);
  assert.equal(result.spaceId, embeddingSpaceId(space));
  input.values[0] = 999;
  assert.equal(result.values[0], 0.6);
  assert.ok(Object.isFrozen(result.values));
  assert.ok(Object.isFrozen(result.space));
});

test('same dimensions never imply compatible embedding spaces', () => {
  const variants: EmbeddingSpaceSpec[] = [
    { ...space, provider: 'remote-provider' }, { ...space, model: 'another-encoder' },
    { ...space, revision: 'sha256:weights-2026-02' }, { ...space, preprocessingVersion: 'paired-prefixes-v2' },
    { ...space, pooling: 'cls' }, { ...space, normalization: 'none' }, { ...space, dimensions: 3 },
  ];
  for (const variant of variants) {
    assert.notEqual(embeddingSpaceId(variant), embeddingSpaceId(space));
    assert.throws(() => validateEmbedding({ ...record, space: variant }, space), /space mismatch/);
  }
});

test('fallback and unknown provenance cannot masquerade as semantic output', () => {
  for (const origin of ['hash-fallback', 'local-fallback', undefined, '']) {
    assert.throws(() => validateEmbedding({ ...record, origin }, space), /semantic-model/);
  }
  assert.throws(() => validateEmbedding({ ...record, space: { ...space, revision: '' } }, space));
  assert.throws(() => embeddingSpaceId({ ...space, revision: 'latest' }));
});

test('finite numeric components and exactly declared dimensionality are mandatory', () => {
  const sparse = new Array<number>(2);
  sparse[0] = 1;
  for (const values of [[1], [1, 0, 0], [], [NaN, 1], [Infinity, 0], [-Infinity, 0], ['0.6', 0.8], sparse]) {
    assert.throws(() => validateEmbedding({ ...record, values }, space));
  }
  assert.throws(() => embeddingSpaceId({ ...space, dimensions: 2.5 }));
  assert.throws(() => embeddingSpaceId({ ...space, dimensions: 0 }));
});

test('zero, tiny, overflowed, and falsely normalized vectors fail', () => {
  for (const values of [[0, 0], [-0, 0], [1e-300, 1e-300], [2, 0]]) {
    assert.throws(() => validateEmbedding({ ...record, values }, space));
  }
  const unnormalized = { ...space, normalization: 'none' as const };
  assert.throws(() => validateEmbedding({ ...record, space: unnormalized, values: [1.5e308, 1.5e308] }, unnormalized));
});

test('norm calculation avoids overflow in intermediate squares', () => {
  const unnormalized = { ...space, normalization: 'none' as const };
  const result = validateEmbedding({ ...record, space: unnormalized, values: [3e200, 4e200] }, unnormalized);
  assert.ok(Number.isFinite(result.norm));
  assert.ok(Math.abs(result.norm / 5e200 - 1) < 1e-12);
});
