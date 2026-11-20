import { assertIntegerInRange, assertSha256, sha256, type Sha256, type VerifiedRom } from './RomIdentity.js';

export interface CheckedByteEdit {
  readonly addressSpace: 'normalized-rom';
  readonly offset: number;
  readonly expectedBytes: Uint8Array;
  readonly replacementBytes: Uint8Array;
}

export interface ByteEditRequest {
  readonly expectedRawSha256: Sha256;
  readonly expectedNormalizedSha256: Sha256;
  readonly edits: readonly CheckedByteEdit[];
  readonly allowNoop?: boolean;
}

export interface ByteEditResult {
  readonly originalRawSha256: Sha256;
  readonly originalNormalizedSha256: Sha256;
  readonly outputRawSha256: Sha256;
  readonly outputNormalizedSha256: Sha256;
  readonly changedByteCount: number;
  readonly outputRaw: Buffer;
  readonly outputNormalized: Buffer;
}

/** Validates every edit against one baseline before writing any result bytes. */
export function applyCheckedByteEdits(rom: VerifiedRom, request: ByteEditRequest): ByteEditResult {
  assertSha256(request.expectedRawSha256, 'expectedRawSha256');
  assertSha256(request.expectedNormalizedSha256, 'expectedNormalizedSha256');
  if (request.expectedRawSha256 !== rom.identity.raw.sha256
    || request.expectedNormalizedSha256 !== rom.identity.normalized.sha256) {
    throw new Error('Edit proposal baseline does not match both raw and normalized ROM hashes.');
  }
  if (request.allowNoop !== undefined && typeof request.allowNoop !== 'boolean') {
    throw new Error('allowNoop must be a boolean.');
  }
  if (!Array.isArray(request.edits) || request.edits.length > 4096) {
    throw new Error('edits must be an array of at most 4096 byte edits.');
  }
  const baseline = rom.copyNormalized();
  let totalEditBytes = 0;
  const edits = request.edits.map((edit, index) => {
    if (edit.addressSpace !== 'normalized-rom') {
      throw new Error(`Edit ${index} must explicitly use normalized-rom offsets; resolve other spaces first.`);
    }
    if (!(edit.expectedBytes instanceof Uint8Array) || !(edit.replacementBytes instanceof Uint8Array)) {
      throw new Error(`Edit ${index} requires expected and replacement byte arrays.`);
    }
    assertIntegerInRange(edit.offset, 0, baseline.length - 1, `edit ${index} offset`);
    assertIntegerInRange(edit.expectedBytes.byteLength, 1, baseline.length, `edit ${index} byteLength`);
    if (edit.expectedBytes.byteLength !== edit.replacementBytes.byteLength) {
      throw new Error(`Edit ${index} must preserve byte length.`);
    }
    if (edit.expectedBytes.byteLength > baseline.length - edit.offset) {
      throw new Error(`Edit ${index} is out of bounds.`);
    }
    if (edit.expectedBytes.byteLength > baseline.length - totalEditBytes) {
      throw new Error('Total edit bytes exceed the non-overlapping ROM byte budget.');
    }
    totalEditBytes += edit.expectedBytes.byteLength;
    return {
      offset: edit.offset,
      expected: Buffer.from(edit.expectedBytes),
      replacement: Buffer.from(edit.replacementBytes),
      index,
    };
  }).sort((a, b) => a.offset - b.offset);
  for (let index = 0; index < edits.length; index++) {
    const edit = edits[index]!;
    const previous = edits[index - 1];
    if (previous && edit.offset - previous.offset < previous.expected.length) {
      throw new Error(`Edits ${previous.index} and ${edit.index} overlap.`);
    }
    if (!baseline.subarray(edit.offset, edit.offset + edit.expected.length).equals(edit.expected)) {
      throw new Error(`Edit ${edit.index} has stale expected bytes.`);
    }
  }

  const outputNormalized = Buffer.from(baseline);
  let changedByteCount = 0;
  for (const edit of edits) {
    for (let index = 0; index < edit.expected.length; index++) {
      if (edit.expected[index] !== edit.replacement[index]) changedByteCount++;
    }
    edit.replacement.copy(outputNormalized, edit.offset);
  }
  if (changedByteCount === 0 && request.allowNoop !== true) {
    throw new Error('The edit proposal is a no-op; allowNoop must be explicitly true.');
  }
  const outputRaw = rom.materializeRaw(outputNormalized);
  return Object.freeze({
    originalRawSha256: rom.identity.raw.sha256,
    originalNormalizedSha256: rom.identity.normalized.sha256,
    outputRawSha256: sha256(outputRaw),
    outputNormalizedSha256: sha256(outputNormalized),
    changedByteCount,
    outputRaw,
    outputNormalized,
  });
}
