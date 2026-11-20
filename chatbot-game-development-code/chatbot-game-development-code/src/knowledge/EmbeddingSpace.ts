import { createHash } from 'node:crypto';
import { isWellFormedUnicode } from '../common/Unicode';

export interface EmbeddingSpaceSpec {
  readonly provider: string;
  readonly model: string;
  /** An immutable model/deployment revision resolved by the provider adapter. */
  readonly revision: string;
  readonly dimensions: number;
  /** Version the complete paired document/query preprocessing policy, including prefixes. */
  readonly preprocessingVersion: string;
  readonly pooling: 'mean' | 'cls' | 'provider';
  readonly normalization: 'none' | 'l2';
  readonly distance: 'cosine';
}

export interface EmbeddingRecord {
  readonly origin: 'semantic-model' | 'hash-fallback';
  /** Actual provider identity, not the originally requested provider after a fallback. */
  readonly space: EmbeddingSpaceSpec;
  readonly values: readonly number[];
}

export interface ValidatedEmbedding {
  readonly spaceId: string;
  readonly space: Readonly<EmbeddingSpaceSpec>;
  readonly values: readonly number[];
  readonly norm: number;
}

export const MIN_EMBEDDING_NORM = 1e-12;
export const UNIT_NORM_TOLERANCE = 1e-4;
const MAX_DIMENSIONS = 65536;

function requiredIdentityString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !isWellFormedUnicode(value) || !value || value !== value.trim() || value.length > 2048
      || /[\u0000-\u001f\u007f]/.test(value)
      || /^(?:unknown|unspecified|latest|default|fallback|hash|none)$/i.test(value)) {
    throw new TypeError(`${field} must identify an explicit versioned embedding pipeline`);
  }
}

function checkedSpace(value: unknown): Readonly<EmbeddingSpaceSpec> {
  if (!value || typeof value !== 'object') throw new TypeError('Missing embedding space');
  const space = value as Partial<EmbeddingSpaceSpec>;
  requiredIdentityString(space.provider, 'provider');
  requiredIdentityString(space.model, 'model');
  requiredIdentityString(space.revision, 'revision');
  requiredIdentityString(space.preprocessingVersion, 'preprocessingVersion');
  if (!Number.isSafeInteger(space.dimensions) || (space.dimensions ?? 0) < 1
      || (space.dimensions ?? Infinity) > MAX_DIMENSIONS) throw new RangeError('Invalid embedding dimensions');
  if (!['mean', 'cls', 'provider'].includes(space.pooling ?? '')
      || !['none', 'l2'].includes(space.normalization ?? '') || space.distance !== 'cosine') {
    throw new TypeError('Unsupported embedding pooling, normalization, or distance');
  }
  return Object.freeze({
    provider: space.provider, model: space.model, revision: space.revision,
    dimensions: space.dimensions as number, preprocessingVersion: space.preprocessingVersion,
    pooling: space.pooling as EmbeddingSpaceSpec['pooling'],
    normalization: space.normalization as EmbeddingSpaceSpec['normalization'], distance: 'cosine',
  });
}

export function embeddingSpaceId(input: EmbeddingSpaceSpec): string {
  const space = checkedSpace(input);
  return `embedding-space:${createHash('sha256').update(JSON.stringify([
    'embedding-space/v1', space.provider, space.model, space.revision,
    space.dimensions, space.preprocessingVersion, space.pooling, space.normalization, space.distance,
  ]), 'utf8').digest('hex')}`;
}

/** Reject fallback, malformed, near-zero, nonfinite, or mismatched-space vectors. */
export function validateEmbedding(record: unknown, expected: EmbeddingSpaceSpec): ValidatedEmbedding {
  const expectedId = embeddingSpaceId(expected);
  if (!record || typeof record !== 'object') throw new TypeError('Missing embedding record');
  const candidate = record as Partial<EmbeddingRecord>;
  if (candidate.origin !== 'semantic-model') throw new TypeError('Only actual semantic-model output is eligible');
  const space = checkedSpace(candidate.space);
  const actualId = embeddingSpaceId(space);
  if (actualId !== expectedId) throw new TypeError('Embedding space mismatch');
  if (!Array.isArray(candidate.values) || candidate.values.length !== space.dimensions) {
    throw new RangeError('Embedding vector length does not match its declared dimensions');
  }
  // Scaled sum of squares avoids overflow/underflow in the intermediate squares.
  let scale = 0;
  let sumSquares = 1;
  const values: number[] = [];
  for (let i = 0; i < candidate.values.length; i += 1) {
    const component: unknown = candidate.values[i];
    if (typeof component !== 'number' || !Number.isFinite(component)) {
      throw new TypeError(`Embedding component ${i} must be a finite number`);
    }
    values.push(component);
    const magnitude = Math.abs(component);
    if (magnitude === 0) continue;
    if (scale < magnitude) {
      sumSquares = 1 + sumSquares * (scale / magnitude) ** 2;
      scale = magnitude;
    } else {
      sumSquares += (magnitude / scale) ** 2;
    }
  }
  const norm = scale === 0 ? 0 : scale * Math.sqrt(sumSquares);
  if (!Number.isFinite(norm) || norm <= MIN_EMBEDDING_NORM) throw new RangeError('Embedding norm is zero, too small, or nonfinite');
  if (space.normalization === 'l2' && Math.abs(norm - 1) > UNIT_NORM_TOLERANCE) {
    throw new RangeError('Embedding claims L2 normalization but is not unit length');
  }
  return Object.freeze({ spaceId: actualId, space, values: Object.freeze(values), norm });
}
