import { assertIntegerInRange, assertSha256, DEFAULT_ROM_BYTE_LIMIT, sha256, type Sha256 } from './RomIdentity.js';

export type PatchFormat = 'bps' | 'ips';

export interface PatchCreateInput {
  readonly format: PatchFormat;
  readonly source: Buffer;
  readonly target: Buffer;
  readonly signal?: AbortSignal;
}

export interface PatchApplyInput {
  readonly format: PatchFormat;
  readonly source: Buffer;
  readonly patch: Buffer;
  readonly maxOutputBytes: number;
  readonly signal?: AbortSignal;
}

/**
 * A real, pinned codec implements this port (for example a certified Flips CLI
 * adapter). The port owns actual BPS/IPS parsing, checksum checks and process
 * termination on abort. This module does not implement either patch format.
 */
export interface PatchCodecPort {
  readonly id: string;
  readonly version: string;
  readonly executableSha256: Sha256;
  readonly supportedFormats: readonly PatchFormat[];
  create(input: PatchCreateInput): Promise<Buffer>;
  apply(input: PatchApplyInput): Promise<Buffer>;
}

export interface PatchRoundTripRequest {
  readonly format: PatchFormat;
  readonly sourceRaw: Buffer;
  readonly expectedSourceRawSha256: Sha256;
  readonly targetRaw: Buffer;
  readonly expectedTargetRawSha256: Sha256;
  readonly allowNoop?: boolean;
  readonly maxOutputBytes?: number;
  readonly maxPatchBytes?: number;
  readonly signal?: AbortSignal;
}

export interface PatchRoundTripResult {
  readonly patchBytes: Buffer;
  readonly verifiedTargetRaw: Buffer;
  readonly evidence: Readonly<{
    format: PatchFormat;
    codecId: string;
    codecVersion: string;
    codecExecutableSha256: Sha256;
    sourceRawSha256: Sha256;
    sourceBytes: number;
    targetRawSha256: Sha256;
    targetBytes: number;
    patchSha256: Sha256;
    patchBytes: number;
    deterministicCreationRuns: 2;
    freshApplicationRuns: 2;
    noOpExplicitlyAllowed: boolean;
  }>;
}

function boundedBuffer(bytes: Buffer, maximum: number, label: string): void {
  if (!Buffer.isBuffer(bytes)) throw new Error(`${label} must be a Buffer.`);
  assertIntegerInRange(bytes.length, 1, maximum, `${label}.byteLength`);
}

function abortError(): Error {
  const error = new Error('Patch validation was cancelled.');
  error.name = 'AbortError';
  return error;
}

function ensureActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

/** Stops awaiting promptly. The process runner must also stop the actual child. */
async function cancellable<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  ensureActive(signal);
  if (!signal) return operation();
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      signal.removeEventListener('abort', onAbort);
      reject(abortError());
      return;
    }
    Promise.resolve().then(() => { ensureActive(signal); return operation(); })
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/**
 * Computes two identical patches, then applies the persisted-equivalent patch
 * twice to fresh baseline copies. Exact output bytes, length and SHA-256 must
 * match the separately supplied intended target. No codec gets the originals.
 */
export async function validatePatchRoundTrip(
  request: PatchRoundTripRequest,
  codec: PatchCodecPort,
): Promise<PatchRoundTripResult> {
  const format = request.format;
  const signal = request.signal;
  const allowNoop = request.allowNoop;
  ensureActive(signal);
  if (format !== 'bps' && format !== 'ips') throw new Error('Unsupported patch format.');
  if (!codec.supportedFormats.includes(format)) throw new Error('Codec does not support the selected format.');
  if (!codec.id.trim() || !codec.version.trim()) throw new Error('A pinned codec id and version are required.');
  assertSha256(codec.executableSha256, 'codec.executableSha256');
  assertSha256(request.expectedSourceRawSha256, 'expectedSourceRawSha256');
  assertSha256(request.expectedTargetRawSha256, 'expectedTargetRawSha256');
  if (allowNoop !== undefined && typeof allowNoop !== 'boolean') throw new Error('allowNoop must be a boolean.');
  const codecIdentity = Object.freeze({ id: codec.id, version: codec.version, executableSha256: codec.executableSha256 });
  const outputLimit = request.maxOutputBytes ?? DEFAULT_ROM_BYTE_LIMIT;
  const patchLimit = request.maxPatchBytes ?? DEFAULT_ROM_BYTE_LIMIT;
  assertIntegerInRange(outputLimit, 1, DEFAULT_ROM_BYTE_LIMIT, 'maxOutputBytes');
  assertIntegerInRange(patchLimit, 1, DEFAULT_ROM_BYTE_LIMIT, 'maxPatchBytes');
  boundedBuffer(request.sourceRaw, DEFAULT_ROM_BYTE_LIMIT, 'sourceRaw');
  boundedBuffer(request.targetRaw, outputLimit, 'targetRaw');
  const source = Buffer.from(request.sourceRaw);
  const target = Buffer.from(request.targetRaw);
  const sourceHash = sha256(source);
  const targetHash = sha256(target);
  if (sourceHash !== request.expectedSourceRawSha256) throw new Error('Patch source raw baseline hash mismatch.');
  if (targetHash !== request.expectedTargetRawSha256) throw new Error('Intended patch target raw hash mismatch.');
  const noOp = source.equals(target);
  if (noOp && allowNoop !== true) throw new Error('Identical source and target require explicit allowNoop.');
  // Deliberately conservative IPS export profile: fixed size, at most 16 MiB.
  // A codec's truncation extension or beyond-24-bit behavior is not assumed.
  if (format === 'ips' && (source.length !== target.length || target.length > 0x1000000)) {
    throw new Error('This IPS profile requires equal lengths of at most 16 MiB. Use BPS for other cartridge sizes.');
  }

  const create = async (): Promise<Buffer> => {
    ensureActive(signal);
    const sourceCopy = Buffer.from(source);
    const targetCopy = Buffer.from(target);
    const generated = await cancellable(() => codec.create({
      format, source: sourceCopy, target: targetCopy,
      ...(signal ? { signal } : {}),
    }), signal);
    ensureActive(signal);
    if (!sourceCopy.equals(source) || !targetCopy.equals(target)) throw new Error('Patch creator mutated its input bytes.');
    boundedBuffer(generated, patchLimit, 'generatedPatch');
    return Buffer.from(generated);
  };
  const patch = await create();
  const repeatedPatch = await create();
  if (!patch.equals(repeatedPatch)) throw new Error('Patch creation was not deterministic for these exact inputs.');

  const apply = async (): Promise<Buffer> => {
    ensureActive(signal);
    const sourceCopy = Buffer.from(source);
    const patchCopy = Buffer.from(patch);
    const applied = await cancellable(() => codec.apply({
      format, source: sourceCopy, patch: patchCopy, maxOutputBytes: outputLimit,
      ...(signal ? { signal } : {}),
    }), signal);
    ensureActive(signal);
    if (!sourceCopy.equals(source) || !patchCopy.equals(patch)) throw new Error('Patch applier mutated its input bytes.');
    boundedBuffer(applied, outputLimit, 'appliedOutput');
    const snapshot = Buffer.from(applied);
    if (snapshot.length !== target.length || sha256(snapshot) !== targetHash || !snapshot.equals(target)) {
      throw new Error('Fresh patch application did not reproduce the intended target bytes and hash.');
    }
    return snapshot;
  };
  const firstApplication = await apply();
  await apply();
  ensureActive(signal);
  return Object.freeze({
    patchBytes: Buffer.from(patch),
    verifiedTargetRaw: firstApplication,
    evidence: Object.freeze({
      format,
      codecId: codecIdentity.id,
      codecVersion: codecIdentity.version,
      codecExecutableSha256: codecIdentity.executableSha256,
      sourceRawSha256: sourceHash,
      sourceBytes: source.length,
      targetRawSha256: targetHash,
      targetBytes: target.length,
      patchSha256: sha256(patch),
      patchBytes: patch.length,
      deterministicCreationRuns: 2,
      freshApplicationRuns: 2,
      noOpExplicitlyAllowed: noOp && allowNoop === true,
    }),
  });
}
