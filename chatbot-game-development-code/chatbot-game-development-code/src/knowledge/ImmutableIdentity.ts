import { createHash } from 'node:crypto';
import { isWellFormedUnicode } from '../common/Unicode';

/** A revision must identify immutable bytes, never a branch, tag, or "latest" URL. */
export type ImmutableRevision = Readonly<{
  kind: 'git-commit' | 'artifact-sha256';
  value: string;
}>;

export interface SnapshotInput {
  readonly corpusId: string;
  readonly sourceKey: string;
  readonly revision: ImmutableRevision;
  readonly manifestSha256: string;
  readonly extractorVersion: string;
  readonly chunkerVersion: string;
}

export interface SnapshotIdentity extends SnapshotInput {
  readonly snapshotId: string;
}

export type ChunkLocator =
  | Readonly<{ kind: 'lines'; startLine: number; endLine: number; part: number }>
  | Readonly<{ kind: 'section'; anchor: string; part: number }>;

export interface ChunkIdentityInput {
  readonly snapshotId: string;
  readonly sourcePath: string;
  readonly locator: ChunkLocator;
  /** Exact extractor output. Newline/Unicode normalization belongs to the versioned extractor. */
  readonly content: string;
}

export interface ChunkIdentity {
  readonly chunkId: string;
  /** Reusable content identity; NOT an authorization or snapshot membership identifier. */
  readonly contentSha256: string;
  readonly snapshotId: string;
  readonly sourcePath: string;
  readonly locator: ChunkLocator;
  readonly utf8Bytes: number;
}

export const MAX_CHUNK_UTF8_BYTES = 64 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;

function exactString(value: unknown, label: string, maxBytes = 1024): asserts value is string {
  if (typeof value !== 'string' || !isWellFormedUnicode(value) || !value.trim() || value !== value.trim()
      || /[\u0000-\u001f\u007f]/.test(value) || Buffer.byteLength(value, 'utf8') > maxBytes) {
    throw new TypeError(`${label} must be a bounded, nonempty, canonical string`);
  }
}

function hashTuple(parts: readonly unknown[]): string {
  // Arrays with an explicit schema version avoid delimiter and object-key-order collisions.
  return createHash('sha256').update(JSON.stringify(parts), 'utf8').digest('hex');
}

export function sha256Utf8(content: string): string {
  if (typeof content !== 'string' || !isWellFormedUnicode(content)) throw new TypeError('Hash input must be well-formed Unicode');
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function createSnapshotIdentity(input: SnapshotInput): SnapshotIdentity {
  exactString(input.corpusId, 'corpusId');
  exactString(input.sourceKey, 'sourceKey');
  exactString(input.extractorVersion, 'extractorVersion');
  exactString(input.chunkerVersion, 'chunkerVersion');
  if (!SHA256.test(input.manifestSha256)) throw new TypeError('manifestSha256 must be lowercase SHA-256');
  const revision = input.revision;
  if (!revision || (revision.kind !== 'git-commit' && revision.kind !== 'artifact-sha256')) {
    throw new TypeError('Unsupported immutable revision kind');
  }
  const revisionPattern = revision.kind === 'git-commit' ? /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/ : SHA256;
  if (!revisionPattern.test(revision.value)) throw new TypeError('Revision must be a full lowercase content digest');
  const frozenRevision = Object.freeze({ kind: revision.kind, value: revision.value });
  const snapshotId = `snapshot:${hashTuple([
    'knowledge-snapshot/v1', input.corpusId, input.sourceKey,
    frozenRevision.kind, frozenRevision.value, input.manifestSha256,
    input.extractorVersion, input.chunkerVersion,
  ])}`;
  return Object.freeze({
    corpusId: input.corpusId, sourceKey: input.sourceKey, revision: frozenRevision,
    manifestSha256: input.manifestSha256, extractorVersion: input.extractorVersion,
    chunkerVersion: input.chunkerVersion, snapshotId,
  });
}

export function validateSourcePath(sourcePath: string): void {
  exactString(sourcePath, 'sourcePath', 4096);
  const segments = sourcePath.split('/');
  if (sourcePath.includes('\\') || /^[A-Za-z]:/.test(sourcePath)
      || segments.some(segment => segment === '' || segment === '.' || segment === '..')) {
    throw new TypeError('sourcePath must already be a relative, canonical, slash-separated path');
  }
}

export function createChunkIdentity(input: ChunkIdentityInput): ChunkIdentity {
  if (!/^snapshot:[a-f0-9]{64}$/.test(input.snapshotId)) throw new TypeError('Invalid snapshotId');
  validateSourcePath(input.sourcePath);
  if (typeof input.content !== 'string' || !input.content.trim()) throw new TypeError('Chunk content is empty');
  // UTF-8 would replace lone UTF-16 surrogates, hiding differences in the original string.
  if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(input.content)) {
    throw new TypeError('Chunk content contains an unpaired UTF-16 surrogate');
  }
  const utf8Bytes = Buffer.byteLength(input.content, 'utf8');
  if (utf8Bytes > MAX_CHUNK_UTF8_BYTES) throw new RangeError('Chunk exceeds the UTF-8 byte limit');
  const locator = input.locator;
  if (!locator || !Number.isSafeInteger(locator.part) || locator.part < 0) {
    throw new TypeError('Chunk part must be a nonnegative safe integer');
  }
  let locatorTuple: readonly unknown[];
  let frozenLocator: ChunkLocator;
  if (locator.kind === 'lines') {
    if (!Number.isSafeInteger(locator.startLine) || !Number.isSafeInteger(locator.endLine)
        || locator.startLine < 1 || locator.endLine < locator.startLine) {
      throw new TypeError('Invalid one-based inclusive line range');
    }
    frozenLocator = Object.freeze({ kind: 'lines', startLine: locator.startLine, endLine: locator.endLine, part: locator.part });
    locatorTuple = ['lines', locator.startLine, locator.endLine, locator.part];
  } else if (locator.kind === 'section') {
    exactString(locator.anchor, 'anchor', 2048);
    frozenLocator = Object.freeze({ kind: 'section', anchor: locator.anchor, part: locator.part });
    locatorTuple = ['section', locator.anchor, locator.part];
  } else {
    throw new TypeError('Unsupported chunk locator');
  }
  const contentSha256 = sha256Utf8(input.content);
  const chunkId = `chunk:${hashTuple([
    'knowledge-chunk/v1', input.snapshotId, input.sourcePath, locatorTuple, contentSha256,
  ])}`;
  return Object.freeze({
    chunkId, contentSha256, snapshotId: input.snapshotId, sourcePath: input.sourcePath,
    locator: frozenLocator, utf8Bytes,
  });
}
