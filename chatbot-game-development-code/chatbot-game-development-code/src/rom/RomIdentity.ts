import { createHash } from 'node:crypto';

export type Sha256 = string;

export interface ByteIdentity {
  readonly sizeBytes: number;
  readonly sha256: Sha256;
}

/** Selection is explicit. Neither an extension nor a length heuristic selects it. */
export type RomNormalization =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'remove-snes-copier-header';
      readonly prefixBytes: 512;
      readonly prefixSha256: Sha256;
    };

/** The narrow identity subset of the project's larger, versioned target manifest. */
export interface RomTargetSpec {
  readonly targetId: string;
  readonly platform: 'snes';
  readonly region: string;
  readonly revision: string;
  readonly mappingProfileId: string;
  readonly raw: ByteIdentity;
  readonly normalized: ByteIdentity;
  readonly normalization: RomNormalization;
}

export const DEFAULT_ROM_BYTE_LIMIT = 64 * 1024 * 1024;

export function sha256(bytes: Uint8Array): Sha256 {
  return createHash('sha256').update(bytes).digest('hex');
}

export function assertSha256(value: string, label: string): void {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase, 64-character SHA-256 digest.`);
  }
}

export function assertIntegerInRange(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a safe integer in [${minimum}, ${maximum}].`);
  }
}

function nonempty(value: string, label: string): void {
  if (typeof value !== 'string' || !value.trim() || value.length > 512 || /[\0\r\n]/.test(value)) {
    throw new Error(`${label} must be a nonempty single-line string of at most 512 characters.`);
  }
}

function copySpec(spec: RomTargetSpec, maxBytes: number): RomTargetSpec {
  nonempty(spec.targetId, 'targetId');
  nonempty(spec.region, 'region');
  nonempty(spec.revision, 'revision');
  nonempty(spec.mappingProfileId, 'mappingProfileId');
  if (spec.platform !== 'snes') throw new Error('This cartridge identity profile currently supports SNES only.');
  for (const [label, identity] of [['raw', spec.raw], ['normalized', spec.normalized]] as const) {
    assertIntegerInRange(identity.sizeBytes, 1, maxBytes, `${label}.sizeBytes`);
    assertSha256(identity.sha256, `${label}.sha256`);
  }

  let normalization: RomNormalization;
  if (spec.normalization.kind === 'none') {
    if (spec.raw.sizeBytes !== spec.normalized.sizeBytes || spec.raw.sha256 !== spec.normalized.sha256) {
      throw new Error('The none normalization requires identical raw and normalized identities.');
    }
    normalization = Object.freeze({ kind: 'none' });
  } else if (spec.normalization.kind === 'remove-snes-copier-header') {
    if (spec.normalization.prefixBytes !== 512) throw new Error('The SNES copier-header profile removes exactly 512 bytes.');
    assertSha256(spec.normalization.prefixSha256, 'normalization.prefixSha256');
    if (spec.raw.sizeBytes - 512 !== spec.normalized.sizeBytes) {
      throw new Error('The explicit copier-header sizes are inconsistent.');
    }
    normalization = Object.freeze({
      kind: 'remove-snes-copier-header',
      prefixBytes: 512,
      prefixSha256: spec.normalization.prefixSha256,
    });
  } else {
    throw new Error('Unsupported normalization; no automatic header inference is performed.');
  }
  return Object.freeze({
    targetId: spec.targetId,
    platform: 'snes',
    region: spec.region,
    revision: spec.revision,
    mappingProfileId: spec.mappingProfileId,
    raw: Object.freeze({ ...spec.raw }),
    normalized: Object.freeze({ ...spec.normalized }),
    normalization,
  });
}

/**
 * A private snapshot, not a frozen view of a caller-owned Buffer. All byte getters
 * return copies. A caller changing its input after construction cannot alter this
 * baseline. This class establishes exact enrolled identity, not gameplay validity.
 */
export class VerifiedRom {
  readonly identity: RomTargetSpec;
  readonly #raw: Buffer;
  readonly #normalized: Buffer;

  constructor(rawInput: Buffer, spec: RomTargetSpec, maxBytes = DEFAULT_ROM_BYTE_LIMIT) {
    assertIntegerInRange(maxBytes, 1, DEFAULT_ROM_BYTE_LIMIT, 'maxBytes');
    if (!Buffer.isBuffer(rawInput)) throw new Error('rawInput must be a Buffer.');
    assertIntegerInRange(rawInput.byteLength, 1, maxBytes, 'rawInput.byteLength');
    const identity = copySpec(spec, maxBytes);
    const raw = Buffer.from(rawInput);
    if (raw.length !== identity.raw.sizeBytes || sha256(raw) !== identity.raw.sha256) {
      throw new Error('Raw ROM baseline does not match the enrolled length and SHA-256.');
    }
    const prefixBytes = identity.normalization.kind === 'none' ? 0 : 512;
    if (identity.normalization.kind === 'remove-snes-copier-header'
      && sha256(raw.subarray(0, prefixBytes)) !== identity.normalization.prefixSha256) {
      throw new Error('The explicit copier-header digest does not match.');
    }
    const normalized = Buffer.from(raw.subarray(prefixBytes));
    if (normalized.length !== identity.normalized.sizeBytes || sha256(normalized) !== identity.normalized.sha256) {
      throw new Error('Normalized ROM does not match the separately enrolled identity.');
    }
    this.identity = identity;
    this.#raw = raw;
    this.#normalized = normalized;
    Object.freeze(this);
  }

  get prefixBytes(): 0 | 512 {
    return this.identity.normalization.kind === 'none' ? 0 : 512;
  }

  copyRaw(): Buffer { return Buffer.from(this.#raw); }
  copyNormalized(): Buffer { return Buffer.from(this.#normalized); }

  /** Same-size reconstruction only; preserves the exact enrolled copier header. */
  materializeRaw(normalizedOutput: Uint8Array): Buffer {
    if (!(normalizedOutput instanceof Uint8Array)
      || normalizedOutput.byteLength !== this.#normalized.length) {
      throw new Error('Reconstruction requires the original normalized length.');
    }
    const output = Buffer.from(this.#raw);
    Buffer.from(normalizedOutput).copy(output, this.prefixBytes);
    return output;
  }
}

export function identifyRom(raw: Buffer, target: RomTargetSpec, maxBytes?: number): VerifiedRom {
  return new VerifiedRom(raw, target, maxBytes);
}
