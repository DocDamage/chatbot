import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { sha256 } from '../../src/rom/RomIdentity.js';
import { validatePatchRoundTrip, type PatchCodecPort, type PatchRoundTripRequest } from '../../src/rom/PatchRoundTrip.js';

/**
 * Deliberately NOT a BPS or IPS implementation. This injected in-memory test
 * double exercises the validator contract only. Production must use a pinned
 * external codec with separate real-format integration tests.
 */
function recordingCodec() {
  const events: { kind: 'create' | 'apply'; source: Buffer; patch?: Buffer }[] = [];
  const port: PatchCodecPort = {
    id: 'unit-test-double-not-a-real-codec', version: 'fixture-1',
    executableSha256: sha256(Buffer.from('synthetic-fixture-identity')),
    supportedFormats: ['bps', 'ips'],
    async create({ source, target }) {
      events.push({ kind: 'create', source });
      return Buffer.from(JSON.stringify({ source: sha256(source), target: target.toString('hex') }));
    },
    async apply({ source, patch }) {
      events.push({ kind: 'apply', source, patch });
      const payload = JSON.parse(patch.toString('utf8')) as { source: string; target: string };
      assert.equal(sha256(source), payload.source);
      return Buffer.from(payload.target, 'hex');
    },
  };
  return { port, events };
}

function request(overrides: Partial<PatchRoundTripRequest> = {}): PatchRoundTripRequest {
  const sourceRaw = Buffer.from([1, 2, 3, 4]);
  const targetRaw = Buffer.from([1, 2, 9, 4]);
  return {
    format: 'bps', sourceRaw, targetRaw,
    expectedSourceRawSha256: sha256(sourceRaw), expectedTargetRawSha256: sha256(targetRaw),
    ...overrides,
  };
}

test('two deterministic creations and two fresh reapplications reproduce exact target bytes', async () => {
  const { port, events } = recordingCodec();
  const input = request();
  const sourceBefore = Buffer.from(input.sourceRaw);
  const targetBefore = Buffer.from(input.targetRaw);
  const result = await validatePatchRoundTrip(input, port);
  assert.deepEqual(result.verifiedTargetRaw, targetBefore);
  assert.equal(result.evidence.targetRawSha256, sha256(targetBefore));
  assert.equal(result.evidence.patchSha256, sha256(result.patchBytes));
  assert.deepEqual(events.map(event => event.kind), ['create', 'create', 'apply', 'apply']);
  assert.equal(new Set(events.map(event => event.source)).size, 4, 'all runs use distinct baseline Buffer instances');
  for (const event of events) assert.deepEqual(event.source, sourceBefore);
  assert.notEqual(events[2]!.patch, events[3]!.patch, 'fresh patch copies too');
  assert.deepEqual(input.sourceRaw, sourceBefore);
  assert.deepEqual(input.targetRaw, targetBefore);
  assert.equal(result.evidence.deterministicCreationRuns, 2);
  assert.equal(result.evidence.freshApplicationRuns, 2);
});

test('wrong source baseline and inconsistent intended target hash fail before codec execution', async () => {
  const { port, events } = recordingCodec();
  await assert.rejects(validatePatchRoundTrip(request({ expectedSourceRawSha256: '0'.repeat(64) }), port), /baseline hash mismatch/);
  await assert.rejects(validatePatchRoundTrip(request({ expectedTargetRawSha256: '0'.repeat(64) }), port), /target raw hash mismatch/);
  assert.equal(events.length, 0);
});

test('no-op patch requires explicit allowNoop', async () => {
  const { port } = recordingCodec();
  const same = Buffer.from([1, 2, 3, 4]);
  const input = request({ targetRaw: same, expectedTargetRawSha256: sha256(same) });
  await assert.rejects(validatePatchRoundTrip(input, port), /explicit allowNoop/);
  const result = await validatePatchRoundTrip({ ...input, allowNoop: true }, port);
  assert.equal(result.evidence.noOpExplicitlyAllowed, true);
});

test('empty, too-large and nondeterministic patch outputs fail', async () => {
  const { port } = recordingCodec();
  await assert.rejects(validatePatchRoundTrip(request(), {
    ...port, async create() { return Buffer.alloc(0); },
  }), /generatedPatch.byteLength/);
  await assert.rejects(validatePatchRoundTrip(request({ maxPatchBytes: 1 }), port), /generatedPatch.byteLength/);
  let count = 0;
  await assert.rejects(validatePatchRoundTrip(request(), {
    ...port, async create() { return Buffer.from([++count]); },
  }), /not deterministic/);
});

test('a codec returning baseline instead of the requested modification is rejected', async () => {
  const { port } = recordingCodec();
  await assert.rejects(validatePatchRoundTrip(request(), {
    ...port, async apply({ source }) { return Buffer.from(source); },
  }), /did not reproduce/);
});

test('an unexpected output byte or length fails even when the process claims success', async () => {
  const { port } = recordingCodec();
  for (const output of [Buffer.from([1, 2, 9, 5]), Buffer.from([1, 2, 9, 4, 0])]) {
    await assert.rejects(validatePatchRoundTrip(request(), {
      ...port, async apply() { return output; },
    }), /did not reproduce/);
  }
});

test('a second reapplication that differs is rejected', async () => {
  const { port } = recordingCodec();
  let applications = 0;
  await assert.rejects(validatePatchRoundTrip(request(), {
    ...port, async apply(input) {
      if (++applications === 2) return Buffer.from([0]);
      return port.apply(input);
    },
  }), /did not reproduce/);
  assert.equal(applications, 2);
});

test('mutating codec inputs is detected and original Buffers remain intact', async () => {
  const { port } = recordingCodec();
  const input = request();
  const before = Buffer.from(input.sourceRaw);
  await assert.rejects(validatePatchRoundTrip(input, {
    ...port, async create({ source, target }) { source.fill(0); return Buffer.from(target); },
  }), /creator mutated/);
  assert.deepEqual(input.sourceRaw, before);
  await assert.rejects(validatePatchRoundTrip(input, {
    ...port, async apply({ source, patch }) { source.fill(0); patch.fill(0); return Buffer.from(input.targetRaw); },
  }), /applier mutated/);
  assert.deepEqual(input.sourceRaw, before);
});

test('caller mutation while awaiting a codec cannot alter the captured target or baseline', async () => {
  const { port } = recordingCodec();
  const input = request();
  const expected = Buffer.from(input.targetRaw);
  let first = true;
  const result = await validatePatchRoundTrip(input, {
    ...port, async create(args) {
      if (first) {
        first = false;
        input.sourceRaw.fill(0);
        input.targetRaw.fill(0);
      }
      return port.create(args);
    },
  });
  assert.deepEqual(result.verifiedTargetRaw, expected);
});

test('conservative IPS profile rejects resizing and files above its address budget', async () => {
  const { port } = recordingCodec();
  const resized = Buffer.from([1, 2, 9, 4, 5]);
  await assert.rejects(validatePatchRoundTrip(request({
    format: 'ips', targetRaw: resized, expectedTargetRawSha256: sha256(resized),
  }), port), /equal lengths of at most 16 MiB/);
  const source = Buffer.alloc(0x1000001);
  const target = Buffer.from(source);
  target[0] = 1;
  await assert.rejects(validatePatchRoundTrip(request({
    format: 'ips', sourceRaw: source, targetRaw: target,
    expectedSourceRawSha256: sha256(source), expectedTargetRawSha256: sha256(target),
  }), port), /equal lengths of at most 16 MiB/);
});

test('BPS wrapper can verify an explicitly intended resized output within its service budget', async () => {
  const { port } = recordingCodec();
  const targetRaw = Buffer.from([1, 2, 9, 4, 5]);
  const result = await validatePatchRoundTrip(request({
    targetRaw, expectedTargetRawSha256: sha256(targetRaw),
  }), port);
  assert.deepEqual(result.verifiedTargetRaw, targetRaw);
});

test('pre-cancelled validation never calls the codec', async () => {
  const { port, events } = recordingCodec();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(validatePatchRoundTrip(request({ signal: controller.signal }), port), { name: 'AbortError' });
  assert.equal(events.length, 0);
});

test('cancellation during create rejects promptly and never starts application', async () => {
  const { port } = recordingCodec();
  const controller = new AbortController();
  let applied = false;
  await assert.rejects(validatePatchRoundTrip(request({ signal: controller.signal }), {
    ...port,
    async create() {
      controller.abort();
      return new Promise<Buffer>(() => { /* An intentionally hung test port. */ });
    },
    async apply(args) { applied = true; return port.apply(args); },
  }), { name: 'AbortError' });
  assert.equal(applied, false);
});

test('resource limits and missing codec format support fail before work starts', async () => {
  const { port, events } = recordingCodec();
  await assert.rejects(validatePatchRoundTrip(request({ maxOutputBytes: 3 }), port), /targetRaw.byteLength/);
  await assert.rejects(validatePatchRoundTrip(request({ maxPatchBytes: 0 }), port), /safe integer/);
  await assert.rejects(validatePatchRoundTrip(request(), { ...port, supportedFormats: ['ips'] }), /does not support/);
  assert.equal(events.length, 0);
});
