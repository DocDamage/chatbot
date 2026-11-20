import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { compileEligibilityPolicy } from '../../src/knowledge/Eligibility';
import type { CompatibilityApproval, EvidenceCandidate } from '../../src/knowledge/Eligibility';

const exactSnapshot = `snapshot:${'a'.repeat(64)}`;
const otherSnapshot = `snapshot:${'b'.repeat(64)}`;
const targetId = 'godot:4.1.0:gdscript:desktop';
const otherTargetId = 'godot:4.10.0:gdscript:desktop';
const candidate: EvidenceCandidate = {
  chunkId: 'chunk-1', corpusId: 'public:gamedev', snapshotId: exactSnapshot,
  targetId, state: 'ready', retrievalApproved: true,
};
const config = { corpusId: 'public:gamedev', targetId, exactSnapshotIds: [exactSnapshot] };

test('exact target and exact selected snapshot must both match', () => {
  const policy = compileEligibilityPolicy(config);
  assert.deepEqual(policy.evaluate(candidate), { eligible: true, match: 'exact' });
  assert.equal(policy.evaluate({ ...candidate, targetId: otherTargetId }).eligible, false);
  assert.equal(policy.evaluate({ ...candidate, snapshotId: otherSnapshot }).eligible, false);
  assert.equal(policy.evaluate({ ...candidate, corpusId: 'private:other' }).eligible, false);
});

test('unknown or incomplete metadata is never broadened into a match', () => {
  const policy = compileEligibilityPolicy(config);
  for (const field of ['chunkId', 'corpusId', 'snapshotId', 'targetId', 'state', 'retrievalApproved']) {
    const incomplete = { ...candidate } as Record<string, unknown>;
    delete incomplete[field];
    assert.deepEqual(policy.evaluate(incomplete), { eligible: false, reason: 'unknown-metadata' }, field);
  }
  for (const value of [null, undefined, 'text', {}, { ...candidate, targetId: 'unknown' }, { ...candidate, retrievalApproved: 'true' }]) {
    assert.equal(policy.evaluate(value).eligible, false);
  }
});

test('staged, failed, retired, and unapproved content cannot leak into retrieval', () => {
  const policy = compileEligibilityPolicy(config);
  for (const state of ['staging', 'validated', 'failed', 'retired']) assert.equal(policy.evaluate({ ...candidate, state }).eligible, false);
  assert.deepEqual(policy.evaluate({ ...candidate, retrievalApproved: false }), { eligible: false, reason: 'not-approved' });
});

test('compatibility requires an explicit approval bound to requested target, evidence target, and snapshot', () => {
  const approval: CompatibilityApproval = {
    approvalId: 'approved-regression-fixture-17', requestedTargetId: targetId,
    evidenceTargetId: otherTargetId, snapshotId: otherSnapshot,
  };
  const policy = compileEligibilityPolicy({ ...config, compatibilityApprovals: [approval] });
  const compatible = { ...candidate, targetId: otherTargetId, snapshotId: otherSnapshot };
  assert.deepEqual(policy.evaluate(compatible), { eligible: true, match: 'approved-compatibility', approvalId: approval.approvalId });
  assert.equal(policy.evaluate({ ...compatible, targetId: 'godot:4.10.1:gdscript:desktop' }).eligible, false);
  assert.equal(policy.evaluate({ ...compatible, snapshotId: exactSnapshot }).eligible, false);
  assert.equal(policy.evaluate({ ...compatible, corpusId: 'private:other' }).eligible, false);
  assert.throws(() => compileEligibilityPolicy({ ...config, compatibilityApprovals: [{ ...approval, requestedTargetId: otherTargetId }] }));
});

test('empty allowlists stay empty and caller mutation cannot widen a compiled policy', () => {
  assert.equal(compileEligibilityPolicy({ ...config, exactSnapshotIds: [] }).evaluate(candidate).eligible, false);
  const mutable = { ...config, exactSnapshotIds: [exactSnapshot], compatibilityApprovals: [] as CompatibilityApproval[] };
  const policy = compileEligibilityPolicy(mutable);
  mutable.targetId = otherTargetId;
  mutable.exactSnapshotIds.push(otherSnapshot);
  mutable.compatibilityApprovals.push({ approvalId: 'late', requestedTargetId: targetId, evidenceTargetId: targetId, snapshotId: otherSnapshot });
  assert.equal(policy.evaluate(candidate).eligible, true);
  assert.equal(policy.evaluate({ ...candidate, snapshotId: otherSnapshot }).eligible, false);
});

test('ambiguous requested IDs and duplicate approvals fail at policy construction', () => {
  for (const value of ['', 'unknown', '*', 'latest', 'godot:*', 'godot:unknown', 'godot:latest:gdscript', ' godot:4.1.0']) {
    assert.throws(() => compileEligibilityPolicy({ ...config, targetId: value }));
  }
  const approval = { approvalId: 'approved', requestedTargetId: targetId, evidenceTargetId: otherTargetId, snapshotId: otherSnapshot };
  assert.throws(() => compileEligibilityPolicy({ ...config, compatibilityApprovals: [approval, approval] }));
});
