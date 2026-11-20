import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256Utf8, validateSourcePath, createSnapshotIdentity } from '../../src/knowledge/ImmutableIdentity';
import { compileEligibilityPolicy, type EvidenceCandidate, type EligibilityPolicy } from '../../src/knowledge/Eligibility';
import { fuseEligibleRanks } from '../../src/knowledge/ReciprocalRankFusion';

test('malformed Unicode cannot produce filesystem or UTF-8 identity aliases', () => {
  for (const value of ['\ud800', '\ud801', '\udc00']) {
    assert.throws(() => validateSourcePath(`scripts/${value}.gd`));
    assert.throws(() => sha256Utf8(value));
  }
  assert.doesNotThrow(() => validateSourcePath('scripts/🎮.gd'));
  assert.notEqual(sha256Utf8('🎮'), sha256Utf8('game'));
  assert.throws(() => createSnapshotIdentity({ corpusId: 'broken\ud800', sourceKey: 'github:example/repo',
    revision: { kind: 'git-commit', value: 'a'.repeat(40) }, manifestSha256: 'b'.repeat(64), extractorVersion: '1', chunkerVersion: '1' }));
});

test('snapshot and compatibility selections have independent bounded input', () => {
  const id = `snapshot:${'a'.repeat(64)}`;
  assert.throws(() => compileEligibilityPolicy({ corpusId: 'game-docs', targetId: 'godot:4.7.2', exactSnapshotIds: new Array(513).fill(id) }), /budget/);
  assert.throws(() => compileEligibilityPolicy({ corpusId: 'game-docs', targetId: 'godot:4.7.2', exactSnapshotIds: [],
    compatibilityApprovals: new Array(513).fill({ approvalId: 'a', requestedTargetId: 'godot:4.7.2', evidenceTargetId: 'godot:4.7.1', snapshotId: id }) }), /budget/);
});

test('raw rejected candidates consume scan budget independently of output limit', () => {
  let calls = 0;
  const reject: EligibilityPolicy = { evaluate: () => { calls++; return { eligible: false, reason: 'not-ready' }; } };
  const rows: EvidenceCandidate[] = new Array(20).fill({ chunkId: 'bad' });
  assert.throws(() => fuseEligibleRanks([{ name: 'lexical', items: rows }], reject,
    { limit: 1, perChannelLimit: 1, maxScannedItems: 5 }), /scan budget/);
  assert.equal(calls, 5);
});

test('completed eligible channel quota stops scanning immediately', () => {
  const snapshotId = `snapshot:${'a'.repeat(64)}`;
  const policy = compileEligibilityPolicy({ corpusId: 'docs', targetId: 'godot:4.7.2', exactSnapshotIds: [snapshotId] });
  const row: EvidenceCandidate = { chunkId: 'one', corpusId: 'docs', targetId: 'godot:4.7.2', snapshotId, state: 'ready', retrievalApproved: true };
  const result = fuseEligibleRanks([{ name: 'lexical', items: [row, ...new Array(20).fill({ chunkId: 'bad' })] }], policy,
    { limit: 1, perChannelLimit: 1, maxScannedItems: 1 });
  assert.equal(result.length, 1);
});
