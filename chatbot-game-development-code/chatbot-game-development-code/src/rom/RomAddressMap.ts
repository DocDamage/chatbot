import { assertIntegerInRange, assertSha256, type Sha256, type VerifiedRom } from './RomIdentity.js';

export type RomAddress =
  | { readonly space: 'snes-cpu'; readonly value: number }
  | { readonly space: 'normalized-rom'; readonly value: number }
  | { readonly space: 'raw-file'; readonly value: number };

export interface CpuRomWindow {
  readonly name: string;
  readonly cpuStart: number;
  readonly normalizedStart: number;
  readonly length: number;
}

export interface RomMappingProfile {
  readonly id: string;
  readonly targetId: string;
  readonly normalizedSha256: Sha256;
  readonly windows: readonly CpuRomWindow[];
}

export interface ResolvedRomSpan {
  readonly normalizedOffset: number;
  readonly rawFileOffset: number;
  readonly byteLength: number;
  readonly mappingWindow?: string;
}

/**
 * Windows are reviewed target data. This is not mapper detection or a universal
 * SNES formula. CPU aliases may map to the same ROM bytes; CPU windows may not
 * overlap. RAM, registers, unmapped addresses and spans crossing a window fail.
 */
export class RomAddressMapper {
  readonly #windows: readonly CpuRomWindow[];
  readonly #normalizedBytes: number;
  readonly #prefixBytes: number;

  constructor(rom: VerifiedRom, profile: RomMappingProfile) {
    assertSha256(profile.normalizedSha256, 'profile.normalizedSha256');
    if (profile.id !== rom.identity.mappingProfileId || profile.targetId !== rom.identity.targetId
      || profile.normalizedSha256 !== rom.identity.normalized.sha256) {
      throw new Error('Address mapping profile does not match this exact enrolled target.');
    }
    if (!Array.isArray(profile.windows) || profile.windows.length < 1 || profile.windows.length > 512) {
      throw new Error('Address profile must contain between 1 and 512 explicit CPU ROM windows.');
    }
    this.#normalizedBytes = rom.identity.normalized.sizeBytes;
    this.#prefixBytes = rom.prefixBytes;
    const names = new Set<string>();
    const windows = profile.windows.map(window => {
      if (typeof window.name !== 'string' || !window.name.trim() || names.has(window.name)) {
        throw new Error('CPU window names must be nonempty and unique.');
      }
      names.add(window.name);
      assertIntegerInRange(window.cpuStart, 0, 0xffffff, 'window.cpuStart');
      assertIntegerInRange(window.normalizedStart, 0, this.#normalizedBytes - 1, 'window.normalizedStart');
      assertIntegerInRange(window.length, 1, this.#normalizedBytes, 'window.length');
      if (window.length > 0x1000000 - window.cpuStart
        || window.length > this.#normalizedBytes - window.normalizedStart) {
        throw new Error('CPU ROM window exceeds its CPU or normalized address space.');
      }
      return Object.freeze({ ...window });
    }).sort((a, b) => a.cpuStart - b.cpuStart);
    for (let index = 1; index < windows.length; index++) {
      const previous = windows[index - 1]!;
      if (windows[index]!.cpuStart - previous.cpuStart < previous.length) {
        throw new Error('CPU ROM windows must not overlap.');
      }
    }
    this.#windows = Object.freeze(windows);
    Object.freeze(this);
  }

  resolve(address: RomAddress, byteLength = 1): ResolvedRomSpan {
    assertIntegerInRange(byteLength, 1, this.#normalizedBytes, 'byteLength');
    assertIntegerInRange(address.value, 0, Number.MAX_SAFE_INTEGER, 'address.value');
    let offset: number;
    let mappingWindow: string | undefined;
    if (address.space === 'normalized-rom') {
      offset = address.value;
    } else if (address.space === 'raw-file') {
      if (address.value < this.#prefixBytes) throw new Error('Copier-header bytes have no normalized ROM address.');
      offset = address.value - this.#prefixBytes;
    } else if (address.space === 'snes-cpu') {
      assertIntegerInRange(address.value, 0, 0xffffff, 'SNES CPU address');
      const window = this.#windows.find(candidate => address.value >= candidate.cpuStart
        && address.value - candidate.cpuStart < candidate.length);
      if (!window || byteLength > window.length - (address.value - window.cpuStart)) {
        throw new Error('CPU span is unmapped or crosses an explicit ROM window.');
      }
      offset = window.normalizedStart + address.value - window.cpuStart;
      mappingWindow = window.name;
    } else {
      throw new Error('An explicit supported address space is required.');
    }
    if (offset >= this.#normalizedBytes || byteLength > this.#normalizedBytes - offset) {
      throw new Error('ROM span is out of bounds.');
    }
    return Object.freeze({
      normalizedOffset: offset,
      rawFileOffset: offset + this.#prefixBytes,
      byteLength,
      ...(mappingWindow === undefined ? {} : { mappingWindow }),
    });
  }
}

export function parseBankedSnesAddress(text: string): RomAddress {
  if (typeof text !== 'string' || !/^\$?[a-fA-F0-9]{2}:[a-fA-F0-9]{4}$/.test(text)) {
    throw new Error('Use an explicit banked SNES CPU address such as $00:8000.');
  }
  return Object.freeze({ space: 'snes-cpu', value: Number.parseInt(text.replace(/[$:]/g, ''), 16) });
}
