import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { compileEligibilityPolicy } from '../../src/knowledge/Eligibility';
import type { EvidenceCandidate } from '../../src/knowledge/Eligibility';
import { fuseEligibleRanks } from '../../src/knowledge/ReciprocalRankFusion';

const snapshotId = `snapshot:${'a'.repeat(64)}`;
const otherSnapshotId = `snapshot:${'b'.repeat(64)}`;
const config = { corpusId: 'public:gamedev', targetId: 'godot:4.3.0', exactSnapshotIds: [snapshotId] };
const policy = compileEligibilityPolicy(config);
function hit(chunkId: string, overrides: Partial<EvidenceCandidate> = {}): EvidenceCandidate {
  return { chunkId, corpusId: config.corpusId, targetId: config.targetId, snapshotId, state: 'ready', retrievalApproved: true, ...overrides };
}

test('ineligible hits are removed before rank assignment and channel truncation', () => {
  const rows = fuseEligibleRanks([{ name: 'lexical', items: [
    hit('wrong-version', { targetId: 'godot:3.5.0' }),
    hit('unknown', { snapshotId: undefined }),
    hit('valid-a'), hit('valid-b'),
  ] }], policy, { rankConstant: 60, perChannelLimit: 1 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].candidate.chunkId, 'valid-a');
  assert.equal(rows[0].score, 1 / 61);
  assert.equal(rows[0].contributions[0].rank, 1);
});

test('a duplicate within one channel contributes once and consumes no extra rank', () => {
  const rows = fuseEligibleRanks([{ name: 'lexical', items: [hit('a'), hit('a'), hit('b')] }], policy);
  assert.deepEqual(rows.map(row => [row.candidate.chunkId, row.score]), [['a', 1 / 61], ['b', 1 / 62]]);
  assert.equal(rows[0].contributions.length, 1);
});

test('consensus across channels beats a single channel and arrival order does not change results', () => {
  const channels = [
    { name: 'lexical', items: [hit('a'), hit('b')] },
    { name: 'dense', items: [hit('b'), hit('c')] },
  ];
  const rows = fuseEligibleRanks(channels, policy);
  assert.equal(rows[0].candidate.chunkId, 'b');
  assert.equal(rows[0].score, 1 / 61 + 1 / 62);
  assert.deepEqual(rows, fuseEligibleRanks([...channels].reverse(), policy));
  assert.ok(Object.isFrozen(rows));
});

test('score ties are deterministic by chunk ID, independent of arrival order', () => {
  const rows = fuseEligibleRanks([
    { name: 'z', items: [hit('B')] }, { name: 'a', items: [hit('A')] },
  ], policy);
  assert.deepEqual(rows.map(row => row.candidate.chunkId), ['A', 'B']);
});

test('conflicting provenance for the same ID is rejected', () => {
  const twoSnapshots = compileEligibilityPolicy({ ...config, exactSnapshotIds: [snapshotId, otherSnapshotId] });
  assert.throws(() => fuseEligibleRanks([
    { name: 'lexical', items: [hit('same')] },
    { name: 'dense', items: [hit('same', { snapshotId: otherSnapshotId })] },
  ], twoSnapshots), /conflicting provenance/);
});

test('approved compatibility is traceable in fused output', () => {
  const compatiblePolicy = compileEligibilityPolicy({
    ...config,
    compatibilityApprovals: [{ approvalId: 'fixture-approved-4.3.1', requestedTargetId: config.targetId, evidenceTargetId: 'godot:4.3.1', snapshotId: otherSnapshotId }],
  });
  const rows = fuseEligibleRanks([{ name: 'lexical', items: [hit('approved', { targetId: 'godot:4.3.1', snapshotId: otherSnapshotId })] }], compatiblePolicy);
  assert.deepEqual(rows[0].eligibility, { eligible: true, match: 'approved-compatibility', approvalId: 'fixture-approved-4.3.1' });
});

test('invalid limits, duplicate channels, and empty outcomes have explicit behavior', () => {
  const channels = [{ name: 'lexical', items: [hit('a')] }];
  for (const options of [{ limit: -1 }, { limit: NaN }, { rankConstant: 0 }, { perChannelLimit: 0 }]) {
    assert.throws(() => fuseEligibleRanks(channels, policy, options));
  }
  assert.throws(() => fuseEligibleRanks([...channels, ...channels], policy), /Duplicate/);
  assert.deepEqual(fuseEligibleRanks(channels, policy, { limit: 0 }), []);
  assert.deepEqual(fuseEligibleRanks([{ name: 'lexical', items: [hit('denied', { retrievalApproved: false })] }], policy), []);
});
