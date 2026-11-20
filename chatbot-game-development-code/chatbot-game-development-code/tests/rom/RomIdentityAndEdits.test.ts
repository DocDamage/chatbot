import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { identifyRom, sha256, type RomTargetSpec } from '../../src/rom/RomIdentity.js';
import { applyCheckedByteEdits, type ByteEditRequest, type CheckedByteEdit } from '../../src/rom/CheckedByteEdits.js';
import { RomAddressMapper, parseBankedSnesAddress, type RomMappingProfile } from '../../src/rom/RomAddressMap.js';

// Entirely synthetic bytes; these are not a commercial ROM or accepted game hash.
function fixture(headered = false) {
  const normalized = Buffer.alloc(0x10000);
  for (let index = 0; index < normalized.length; index++) normalized[index] = (index * 31 + 7) % 256;
  const prefix = Buffer.alloc(512, 0xa5);
  const raw = headered ? Buffer.concat([prefix, normalized]) : Buffer.from(normalized);
  const spec: RomTargetSpec = {
    targetId: 'synthetic-snes-fixture', platform: 'snes', region: 'synthetic', revision: 'fixture-1',
    mappingProfileId: 'synthetic-two-bank-map',
    raw: { sizeBytes: raw.length, sha256: sha256(raw) },
    normalized: { sizeBytes: normalized.length, sha256: sha256(normalized) },
    normalization: headered
      ? { kind: 'remove-snes-copier-header', prefixBytes: 512, prefixSha256: sha256(prefix) }
      : { kind: 'none' },
  };
  const rom = identifyRom(raw, spec);
  const request = (edits: readonly CheckedByteEdit[], allowNoop?: boolean): ByteEditRequest => ({
    expectedRawSha256: spec.raw.sha256, expectedNormalizedSha256: spec.normalized.sha256, edits,
    ...(allowNoop === undefined ? {} : { allowNoop }),
  });
  const edit = (offset: number, replacementBytes = Buffer.from([0xfe])): CheckedByteEdit => ({
    addressSpace: 'normalized-rom', offset, expectedBytes: normalized.subarray(offset, offset + replacementBytes.length), replacementBytes,
  });
  const profile: RomMappingProfile = {
    id: spec.mappingProfileId, targetId: spec.targetId, normalizedSha256: spec.normalized.sha256,
    windows: [
      { name: 'bank-00-high', cpuStart: 0x008000, normalizedStart: 0, length: 0x8000 },
      { name: 'bank-01-high', cpuStart: 0x018000, normalizedStart: 0x8000, length: 0x8000 },
      { name: 'bank-80-mirror', cpuStart: 0x808000, normalizedStart: 0, length: 0x8000 },
    ],
  };
  return { raw, normalized, prefix, spec, rom, request, edit, profile };
}

test('exact raw hash rejects a wrong baseline even when length matches', () => {
  const { raw, spec } = fixture();
  raw[5] = raw[5]! ^ 1;
  assert.throws(() => identifyRom(raw, spec), /Raw ROM baseline/);
});

test('explicit header normalization records both identities and retains the original header', () => {
  const { raw, normalized, prefix, rom } = fixture(true);
  assert.equal(rom.prefixBytes, 512);
  assert.notEqual(rom.identity.raw.sha256, rom.identity.normalized.sha256);
  assert.deepEqual(rom.copyRaw(), raw);
  assert.deepEqual(rom.copyNormalized(), normalized);
  assert.deepEqual(rom.materializeRaw(normalized).subarray(0, 512), prefix);
});

test('none normalization does not guess and remove a 512-byte prefix', () => {
  const { raw, spec } = fixture(true);
  assert.throws(() => identifyRom(raw, { ...spec, normalization: { kind: 'none' } }), /identical raw and normalized/);
  // A length heuristic alone cannot change representation. A caller can enroll
  // all bytes as an identity representation, but no bytes disappear implicitly.
  const explicitIdentity = identifyRom(raw, {
    ...spec, normalization: { kind: 'none' }, normalized: { ...spec.raw },
  });
  assert.equal(explicitIdentity.copyNormalized().length, raw.length);
});

test('a normalized hash cannot be substituted for the raw baseline hash', () => {
  const { raw, spec } = fixture(true);
  assert.throws(() => identifyRom(raw, {
    ...spec, raw: { ...spec.raw, sha256: spec.normalized.sha256 },
  }), /Raw ROM baseline/);
});

test('incorrect normalized identity and explicit header digest are rejected separately', () => {
  const { raw, spec } = fixture(true);
  assert.throws(() => identifyRom(raw, {
    ...spec, normalized: { ...spec.normalized, sha256: '0'.repeat(64) },
  }), /Normalized ROM/);
  assert.throws(() => identifyRom(raw, {
    ...spec, normalization: { kind: 'remove-snes-copier-header', prefixBytes: 512, prefixSha256: '0'.repeat(64) },
  }), /copier-header digest/);
});

test('private snapshots do not alias input buffers or returned byte copies', () => {
  const { raw, normalized, rom, spec } = fixture(true);
  const originalHash = spec.raw.sha256;
  raw.fill(0);
  rom.copyRaw().fill(1);
  rom.copyNormalized().fill(2);
  assert.equal(sha256(rom.copyRaw()), originalHash);
  assert.deepEqual(rom.copyNormalized(), normalized);
  assert.equal(Object.isFrozen(rom.identity.normalization), true);
});

test('byte edits preserve source, length and header and accept unsorted adjacent spans', () => {
  const { raw, normalized, prefix, rom, edit, request } = fixture(true);
  const before = Buffer.from(raw);
  const result = applyCheckedByteEdits(rom, request([
    edit(7, Buffer.from([0xa1, 0xa2])), edit(5, Buffer.from([0xb1, 0xb2])),
  ]));
  assert.deepEqual(raw, before);
  assert.deepEqual(rom.copyRaw(), before);
  assert.deepEqual(rom.copyNormalized(), normalized);
  assert.equal(result.outputRaw.length, raw.length);
  assert.deepEqual(result.outputRaw.subarray(0, 512), prefix);
  assert.deepEqual(result.outputNormalized.subarray(5, 9), Buffer.from([0xb1, 0xb2, 0xa1, 0xa2]));
  assert.equal(result.changedByteCount, 4);
  assert.equal(sha256(result.outputRaw), result.outputRawSha256);
  result.outputNormalized.fill(0);
  assert.equal(sha256(result.outputRaw), result.outputRawSha256, 'output Buffers do not alias');
});

test('edit proposal requires both identities, including the raw header variant', () => {
  const { rom, edit, request } = fixture(true);
  assert.throws(() => applyCheckedByteEdits(rom, {
    ...request([edit(4)]), expectedRawSha256: rom.identity.normalized.sha256,
  }), /both raw and normalized/);
  assert.throws(() => applyCheckedByteEdits(rom, {
    ...request([edit(4)]), expectedNormalizedSha256: '0'.repeat(64),
  }), /both raw and normalized/);
});

test('stale expected bytes are rejected before any output can be returned', () => {
  const { rom, edit, request } = fixture();
  const first = edit(1);
  const stale = { ...edit(5), expectedBytes: Buffer.from([0]) };
  const before = rom.copyRaw();
  assert.throws(() => applyCheckedByteEdits(rom, request([first, stale])), /stale expected bytes/);
  assert.deepEqual(rom.copyRaw(), before);
});

test('overlaps and duplicate spans are rejected even if their bytes agree', () => {
  const { rom, edit, request } = fixture();
  assert.throws(() => applyCheckedByteEdits(rom, request([
    edit(5, Buffer.from([1, 2])), edit(6, Buffer.from([2, 3])),
  ])), /overlap/);
  assert.throws(() => applyCheckedByteEdits(rom, request([edit(5), edit(5)])), /overlap/);
});

test('fractional, negative, NaN, infinity and unsafe offsets are rejected', () => {
  const { rom, edit, request } = fixture();
  for (const offset of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => applyCheckedByteEdits(rom, request([{ ...edit(1), offset }])), /safe integer/);
  }
});

test('zero length, length change, end offset and overrun fail', () => {
  const { rom, edit, request, normalized } = fixture();
  assert.throws(() => applyCheckedByteEdits(rom, request([{
    addressSpace: 'normalized-rom', offset: 0, expectedBytes: Buffer.alloc(0), replacementBytes: Buffer.alloc(0),
  }], true)), /byteLength/);
  assert.throws(() => applyCheckedByteEdits(rom, request([{
    ...edit(1), replacementBytes: Buffer.from([1, 2]),
  }])), /preserve byte length/);
  assert.throws(() => applyCheckedByteEdits(rom, request([{ ...edit(1), offset: normalized.length }])), /safe integer/);
  assert.throws(() => applyCheckedByteEdits(rom, request([{
    addressSpace: 'normalized-rom', offset: normalized.length - 1,
    expectedBytes: Buffer.from([1, 2]), replacementBytes: Buffer.from([3, 4]),
  }])), /out of bounds/);
});

test('byte edit API rejects raw offsets instead of silently interpreting them as normalized', () => {
  const { rom, edit, request } = fixture(true);
  const rawSpaceEdit = { ...edit(512), addressSpace: 'raw-file' } as unknown as CheckedByteEdit;
  assert.throws(() => applyCheckedByteEdits(rom, request([rawSpaceEdit])), /resolve other spaces first/);
});

test('empty and identical proposals require explicit allowNoop', () => {
  const { rom, edit, request } = fixture();
  assert.throws(() => applyCheckedByteEdits(rom, request([])), /no-op/);
  const unchanged = edit(1, rom.copyNormalized().subarray(1, 2));
  assert.throws(() => applyCheckedByteEdits(rom, request([unchanged])), /no-op/);
  assert.equal(applyCheckedByteEdits(rom, request([], true)).changedByteCount, 0);
  assert.equal(applyCheckedByteEdits(rom, request([unchanged], true)).outputRawSha256, rom.identity.raw.sha256);
});

test('explicit CPU, normalized and raw addresses resolve through a bound profile', () => {
  const { rom, profile } = fixture(true);
  const mapper = new RomAddressMapper(rom, profile);
  assert.deepEqual(mapper.resolve(parseBankedSnesAddress('$00:8000')), {
    normalizedOffset: 0, rawFileOffset: 512, byteLength: 1, mappingWindow: 'bank-00-high',
  });
  assert.equal(mapper.resolve({ space: 'snes-cpu', value: 0x018002 }, 3).normalizedOffset, 0x8002);
  assert.equal(mapper.resolve({ space: 'snes-cpu', value: 0x808002 }).normalizedOffset, 2);
  assert.equal(mapper.resolve({ space: 'raw-file', value: 514 }).normalizedOffset, 2);
  assert.equal(mapper.resolve({ space: 'normalized-rom', value: 2 }).rawFileOffset, 514);
});

test('CPU gaps, bank-crossing spans, raw header bytes and final-byte overrun fail', () => {
  const { rom, profile } = fixture(true);
  const mapper = new RomAddressMapper(rom, profile);
  assert.throws(() => mapper.resolve({ space: 'snes-cpu', value: 0x7e0010 }), /unmapped/);
  assert.throws(() => mapper.resolve({ space: 'snes-cpu', value: 0x00ffff }, 2), /crosses/);
  assert.throws(() => mapper.resolve({ space: 'raw-file', value: 511 }), /Copier-header/);
  assert.throws(() => mapper.resolve({ space: 'normalized-rom', value: 0xffff }, 2), /out of bounds/);
  assert.throws(() => parseBankedSnesAddress('8000'), /explicit banked/);
  assert.throws(() => mapper.resolve({ space: 'snes-cpu', value: 0x1000000 }), /safe integer/);
});

test('mapping profiles bind the target hash and disallow overlapping CPU windows', () => {
  const { rom, profile } = fixture();
  assert.throws(() => new RomAddressMapper(rom, { ...profile, normalizedSha256: '0'.repeat(64) }), /exact enrolled target/);
  assert.throws(() => new RomAddressMapper(rom, {
    ...profile, windows: [...profile.windows, { name: 'bad-overlap', cpuStart: 0x008001, normalizedStart: 10, length: 2 }],
  }), /must not overlap/);
});
