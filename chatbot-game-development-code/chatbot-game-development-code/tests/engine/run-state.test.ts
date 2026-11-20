import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, reduceRun, type RunEvent, type RunState } from '../../src/engine/run-state.js';
import { sha256 } from '../../src/engine/proposal-integrity.js';

type Body<E = RunEvent> = E extends RunEvent ? Omit<E, 'expectedRevision' | 'atMs'> : never;
const advance = (state: RunState, event: Body, atMs = state.updatedAtMs + 1): RunState =>
  reduceRun(state, { ...event, expectedRevision: state.revision, atMs } as RunEvent);
const fresh = (maxRepairAttempts = 2) => createRun({ id: 'run', ownerId: 'alice', tenantId: 'team', projectKey: 'project',
  nowMs: 0, deadlineAtMs: 1_000, maxRepairAttempts });
function awaiting(): RunState {
  let state = advance(fresh(), { type: 'start' });
  state = advance(state, { type: 'profile_resolved', profileDigest: sha256('profile') });
  state = advance(state, { type: 'context_ready', contextDigest: sha256('context') });
  return advance(state, { type: 'proposal_ready', proposal: { id: 'proposal', digest: sha256('proposal'), requiredCheckIds: ['compile', 'behavior'] } });
}
function applying(): RunState {
  const state = awaiting();
  return advance(state, { type: 'approval_validated', proposalDigest: state.proposal!.digest, approvalId: 'approval' });
}
function verifying(): RunState {
  const state = applying();
  return advance(state, { type: 'apply_committed', proposalDigest: state.proposal!.digest, transactionId: 'tx' });
}
function failedChecks(state = verifying()): RunState {
  return advance(state, { type: 'checks_failed', proposalDigest: state.proposal!.digest,
    evidenceDigest: sha256('failed evidence'), failureFingerprint: sha256('failure') });
}

test('optimistic revision checks reject two writers and terminal transitions', () => {
  const initial = fresh();
  const event: RunEvent = { type: 'start', expectedRevision: 0, atMs: 1 };
  const started = reduceRun(initial, event);
  assert.equal(initial.phase, 'queued');
  assert.equal(started.revision, 1);
  assert.throws(() => reduceRun(started, event), /Expected revision/);
  const failed = advance(started, { type: 'fail', reason: 'unsupported engine' });
  assert.throws(() => advance(failed, { type: 'start' }), /Terminal runs/);
});

test('cannot skip approval, confuse proposal identities, or pass only compilation', () => {
  const pending = awaiting();
  assert.throws(() => advance(pending, { type: 'apply_committed', proposalDigest: pending.proposal!.digest, transactionId: 'tx' }), /not legal/);
  assert.throws(() => advance(pending, { type: 'approval_validated', proposalDigest: sha256('other'), approvalId: 'approval' }), /another proposal/);
  const state = verifying();
  assert.throws(() => advance(state, { type: 'checks_passed', proposalDigest: state.proposal!.digest,
    evidenceDigest: sha256('evidence'), passedCheckIds: ['compile'] }), /Every planned check/);
  const done = advance(state, { type: 'checks_passed', proposalDigest: state.proposal!.digest,
    evidenceDigest: sha256('evidence'), passedCheckIds: ['behavior', 'compile'] });
  assert.equal(done.phase, 'succeeded');
});

test('repair budget is persistent and repaired content receives a distinct proposal', () => {
  const failed = { ...failedChecks(), maxRepairAttempts: 1 };
  const repairing = advance(failed, { type: 'begin_repair' });
  assert.equal(repairing.repairsStarted, 1);
  assert.throws(() => advance(repairing, { type: 'proposal_ready', proposal: repairing.proposal! }), /new proposal/);
  const next = advance(repairing, { type: 'proposal_ready', proposal: {
    id: 'repair-proposal', digest: sha256('repair'), requiredCheckIds: ['compile', 'behavior'] } });
  assert.equal(next.phase, 'awaiting_approval');
  assert.equal(next.approvalId, undefined);
  const applied = advance(advance(next, { type: 'approval_validated', proposalDigest: next.proposal!.digest, approvalId: 'repair-approval' }),
    { type: 'apply_committed', proposalDigest: next.proposal!.digest, transactionId: 'repair-tx' });
  assert.throws(() => advance(failedChecks(applied), { type: 'begin_repair' }), /attempt budget/);
});

test('worker interruption requires reconciliation and never silently replays a committed write', () => {
  const interrupted = advance(applying(), { type: 'interrupt', reason: 'worker restart' });
  assert.throws(() => advance(interrupted, { type: 'approval_validated', proposalDigest: interrupted.proposal!.digest, approvalId: 'approval' }), /not legal/);
  const reconciled = advance(interrupted, { type: 'reconcile', outcome: 'committed', receiptDigest: sha256('receipt'),
    proposalDigest: interrupted.proposal!.digest, transactionId: 'tx-recovered' });
  assert.equal(reconciled.phase, 'verifying');
  const again = advance(reconciled, { type: 'interrupt', reason: 'lost worker' });
  assert.throws(() => advance(again, { type: 'reconcile', outcome: 'not_applied', receiptDigest: sha256('receipt') }), /cannot be replayed/);
  const unknown = advance(interrupted, { type: 'reconcile', outcome: 'uncertain', receiptDigest: sha256('unknown') });
  assert.equal(unknown.phase, 'failed');
  assert.match(unknown.reason!, /operator reconciliation/);
});

test('an unapplied recovery resets approval and blocked resume keeps the reviewed scope', () => {
  const interrupted = advance(applying(), { type: 'interrupt', reason: 'lost worker' });
  const recovered = advance(interrupted, { type: 'reconcile', outcome: 'not_applied', receiptDigest: sha256('no-effects') });
  assert.equal(recovered.phase, 'awaiting_approval');
  assert.equal(recovered.approvalId, undefined);
  const blocked = advance(recovered, { type: 'block', reason: 'ASSETS_REQUIRED' });
  assert.throws(() => advance(blocked, { type: 'resume', reconciliationDigest: sha256('resume') }), /SHA-256 receipt/);
  const resumed = advance(blocked, { type: 'resume', reconciliationDigest: sha256('resume'), proposalDigest: blocked.proposal!.digest });
  assert.equal(resumed.phase, 'awaiting_approval');
});

test('cancel and timeout are terminal only after process and lease settlement', () => {
  const running = verifying();
  assert.throws(() => advance(running, { type: 'fail', reason: 'killed process maybe' }), /Settle side effects/);
  assert.throws(() => advance(running, { type: 'block', reason: 'still running' }), /reconciled/);
  const cancelling = advance(running, { type: 'request_cancel' });
  assert.equal(cancelling.phase, 'cancelling');
  assert.throws(() => advance(cancelling, { type: 'cancellation_settled', receiptDigest: sha256('stop'), processTreeStopped: true,
    leaseReleased: true, disposition: 'no_apply' }), /committed transaction/);
  const cancelled = advance(cancelling, { type: 'cancellation_settled', receiptDigest: sha256('stop'), processTreeStopped: true,
    leaseReleased: true, disposition: 'applied_preserved' });
  assert.equal(cancelled.phase, 'cancelled');
  const timedOut = advance(fresh(), { type: 'request_timeout' }, 1_000);
  assert.equal(timedOut.phase, 'cancelling');
  const settled = advance(timedOut, { type: 'cancellation_settled', receiptDigest: sha256('stop'), processTreeStopped: true,
    leaseReleased: true, disposition: 'no_apply' });
  assert.equal(settled.phase, 'timed_out');
  assert.throws(() => advance(fresh(), { type: 'start' }, 1_000), /deadline has elapsed/);
});
