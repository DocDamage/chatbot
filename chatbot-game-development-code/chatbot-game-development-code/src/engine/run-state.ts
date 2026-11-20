import { isSha256 } from './proposal-integrity.js';

export type RunPhase = 'queued' | 'profiling' | 'retrieving' | 'drafting' | 'awaiting_approval'
  | 'applying' | 'verifying' | 'repairable' | 'repairing' | 'blocked' | 'interrupted'
  | 'cancelling' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out';
export interface RunProposal { readonly id: string; readonly digest: string; readonly requiredCheckIds: readonly string[] }
export interface RunState {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly ownerId: string;
  readonly tenantId: string;
  readonly projectKey: string;
  readonly phase: RunPhase;
  readonly revision: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly deadlineAtMs: number;
  readonly maxRepairAttempts: number;
  readonly repairsStarted: number;
  readonly profileDigest?: string;
  readonly contextDigest?: string;
  readonly proposal?: RunProposal;
  readonly approvalId?: string;
  readonly transactionId?: string;
  readonly failureFingerprint?: string;
  readonly evidenceDigest?: string;
  readonly suspendedPhase?: RunPhase;
  readonly cancellationKind?: 'user' | 'timeout';
  readonly reason?: string;
}

type EventBody =
  | { type: 'start' }
  | { type: 'profile_resolved'; profileDigest: string }
  | { type: 'context_ready'; contextDigest: string }
  | { type: 'proposal_ready'; proposal: RunProposal }
  | { type: 'approval_validated'; proposalDigest: string; approvalId: string }
  | { type: 'apply_committed'; proposalDigest: string; transactionId: string }
  | { type: 'checks_passed'; proposalDigest: string; evidenceDigest: string; passedCheckIds: readonly string[] }
  | { type: 'checks_failed'; proposalDigest: string; evidenceDigest: string; failureFingerprint: string }
  | { type: 'begin_repair' }
  | { type: 'block'; reason: string }
  | { type: 'resume'; reconciliationDigest: string; proposalDigest?: string }
  | { type: 'interrupt'; reason: string }
  | { type: 'reconcile'; outcome: 'not_applied' | 'committed' | 'uncertain'; receiptDigest: string;
      proposalDigest?: string; transactionId?: string }
  | { type: 'request_cancel' }
  | { type: 'request_timeout' }
  | { type: 'cancellation_settled'; receiptDigest: string; processTreeStopped: true; leaseReleased: true;
      disposition: 'no_apply' | 'applied_preserved' | 'rolled_back' }
  | { type: 'fail'; reason: string };

export type RunEvent = EventBody & { expectedRevision: number; atMs: number };

export class RunTransitionError extends Error {
  constructor(readonly code: 'REVISION_CONFLICT' | 'ILLEGAL_TRANSITION' | 'INVALID_EVENT' | 'BUDGET_EXHAUSTED', message: string) {
    super(message);
    this.name = 'RunTransitionError';
  }
}

const terminal = new Set<RunPhase>(['succeeded', 'failed', 'cancelled', 'timed_out']);
const effects = new Set<RunPhase>(['applying', 'verifying']);
const stoppageEvents = new Set(['request_cancel', 'request_timeout', 'cancellation_settled', 'interrupt', 'reconcile', 'fail', 'block']);

function requireHash(value: unknown): void {
  if (!isSha256(value)) throw new RunTransitionError('INVALID_EVENT', 'A SHA-256 receipt is required.');
}
function requireText(value: string): void {
  if (!value?.trim()) throw new RunTransitionError('INVALID_EVENT', 'A nonempty identifier or reason is required.');
}
function requireIds(ids: readonly string[]): void {
  if (!ids.length || ids.some(id => !id.trim()) || new Set(ids).size !== ids.length) {
    throw new RunTransitionError('INVALID_EVENT', 'Check identifiers must be nonempty and unique.');
  }
}

export function createRun(input: {
  id: string; ownerId: string; tenantId: string; projectKey: string;
  nowMs: number; deadlineAtMs: number; maxRepairAttempts: number;
}): RunState {
  [input.id, input.ownerId, input.tenantId, input.projectKey].forEach(requireText);
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0 || !Number.isSafeInteger(input.deadlineAtMs)
      || input.deadlineAtMs <= input.nowMs || !Number.isSafeInteger(input.maxRepairAttempts)
      || input.maxRepairAttempts < 0 || input.maxRepairAttempts > 10) {
    throw new RunTransitionError('INVALID_EVENT', 'Invalid run budget.');
  }
  return Object.freeze({ schemaVersion: 1, id: input.id, ownerId: input.ownerId, tenantId: input.tenantId,
    projectKey: input.projectKey, phase: 'queued', revision: 0, createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs, deadlineAtMs: input.deadlineAtMs,
    maxRepairAttempts: input.maxRepairAttempts, repairsStarted: 0 });
}

/**
 * Pure lifecycle reducer, not an authorization or persistence service.
 * The store must persist the returned revision using an atomic compare-and-swap.
 * Receipt-bearing events are emitted by trusted services after validation; model text
 * and HTTP bodies cannot directly dispatch these internal events.
 */
export function reduceRun(state: RunState, event: RunEvent): RunState {
  if (event.expectedRevision !== state.revision) {
    throw new RunTransitionError('REVISION_CONFLICT', `Expected revision ${state.revision}; received ${event.expectedRevision}.`);
  }
  if (terminal.has(state.phase)) throw new RunTransitionError('ILLEGAL_TRANSITION', 'Terminal runs cannot be resumed or mutated.');
  if (!Number.isSafeInteger(event.atMs) || event.atMs < state.updatedAtMs) {
    throw new RunTransitionError('INVALID_EVENT', 'Event time must be monotonic.');
  }
  if (event.atMs >= state.deadlineAtMs && !stoppageEvents.has(event.type)) {
    throw new RunTransitionError('BUDGET_EXHAUSTED', 'The run deadline has elapsed; stop and settle active processes.');
  }
  const from = (...phases: RunPhase[]) => {
    if (!phases.includes(state.phase)) throw new RunTransitionError('ILLEGAL_TRANSITION', `${event.type} is not legal in ${state.phase}.`);
  };
  const exactProposal = (digest: unknown) => {
    requireHash(digest);
    if (!state.proposal || digest !== state.proposal.digest) throw new RunTransitionError('INVALID_EVENT', 'Event belongs to another proposal.');
  };
  let changes: Partial<RunState>;
  switch (event.type) {
    case 'start':
      from('queued'); changes = { phase: 'profiling' }; break;
    case 'profile_resolved':
      from('profiling'); requireHash(event.profileDigest);
      changes = { phase: 'retrieving', profileDigest: event.profileDigest }; break;
    case 'context_ready':
      from('retrieving'); requireHash(event.contextDigest);
      changes = { phase: 'drafting', contextDigest: event.contextDigest }; break;
    case 'proposal_ready':
      from('drafting', 'repairing'); requireText(event.proposal.id); requireHash(event.proposal.digest); requireIds(event.proposal.requiredCheckIds);
      if (state.proposal?.digest === event.proposal.digest || state.proposal?.id === event.proposal.id) {
        throw new RunTransitionError('INVALID_EVENT', 'A repair must create a new proposal and require a new approval.');
      }
      changes = { phase: 'awaiting_approval', proposal: Object.freeze({ ...event.proposal,
        requiredCheckIds: Object.freeze([...event.proposal.requiredCheckIds]) }), approvalId: undefined,
        transactionId: undefined, evidenceDigest: undefined }; break;
    case 'approval_validated':
      from('awaiting_approval'); exactProposal(event.proposalDigest); requireText(event.approvalId);
      changes = { phase: 'applying', approvalId: event.approvalId }; break;
    case 'apply_committed':
      from('applying'); exactProposal(event.proposalDigest); requireText(event.transactionId);
      changes = { phase: 'verifying', transactionId: event.transactionId }; break;
    case 'checks_passed': {
      from('verifying'); exactProposal(event.proposalDigest); requireHash(event.evidenceDigest); requireIds(event.passedCheckIds);
      const required = state.proposal!.requiredCheckIds;
      if (required.length !== event.passedCheckIds.length || required.some(id => !event.passedCheckIds.includes(id))) {
        throw new RunTransitionError('INVALID_EVENT', 'Every planned check needs fresh passing evidence.');
      }
      changes = { phase: 'succeeded', evidenceDigest: event.evidenceDigest }; break;
    }
    case 'checks_failed':
      from('verifying'); exactProposal(event.proposalDigest); requireHash(event.evidenceDigest); requireHash(event.failureFingerprint);
      changes = { phase: 'repairable', evidenceDigest: event.evidenceDigest, failureFingerprint: event.failureFingerprint }; break;
    case 'begin_repair':
      from('repairable');
      if (state.repairsStarted >= state.maxRepairAttempts) throw new RunTransitionError('BUDGET_EXHAUSTED', 'The repair attempt budget is exhausted.');
      changes = { phase: 'repairing', repairsStarted: state.repairsStarted + 1 }; break;
    case 'block':
      if (effects.has(state.phase) || ['blocked', 'interrupted', 'cancelling'].includes(state.phase)) {
        throw new RunTransitionError('ILLEGAL_TRANSITION', 'An active or uncertain side effect must be reconciled, not simply blocked.');
      }
      requireText(event.reason); changes = { phase: 'blocked', suspendedPhase: state.phase, reason: event.reason }; break;
    case 'resume':
      from('blocked'); requireHash(event.reconciliationDigest);
      if (!state.suspendedPhase || effects.has(state.suspendedPhase)) throw new RunTransitionError('INVALID_EVENT', 'No safe resume checkpoint exists.');
      if (state.proposal) exactProposal(event.proposalDigest);
      changes = { phase: state.suspendedPhase, suspendedPhase: undefined, reason: undefined, approvalId: undefined }; break;
    case 'interrupt':
      if (['interrupted', 'cancelling', 'blocked'].includes(state.phase)) throw new RunTransitionError('ILLEGAL_TRANSITION', 'Run is already suspended.');
      requireText(event.reason); changes = { phase: 'interrupted', suspendedPhase: state.phase, reason: event.reason }; break;
    case 'reconcile': {
      from('interrupted'); requireHash(event.receiptDigest);
      if (event.outcome === 'uncertain') {
        changes = { phase: 'failed', reason: 'Mutation outcome is uncertain; operator reconciliation is required.' }; break;
      }
      if (event.outcome === 'committed') {
        if (!state.suspendedPhase || !effects.has(state.suspendedPhase)) throw new RunTransitionError('INVALID_EVENT', 'No mutation was in progress.');
        exactProposal(event.proposalDigest); requireText(event.transactionId || '');
        if (state.transactionId && event.transactionId !== state.transactionId) throw new RunTransitionError('INVALID_EVENT', 'Transaction receipt changed.');
        changes = { phase: 'verifying', transactionId: event.transactionId, suspendedPhase: undefined, reason: undefined }; break;
      }
      if (state.suspendedPhase === 'verifying') throw new RunTransitionError('INVALID_EVENT', 'A committed transaction cannot be replayed as unapplied.');
      if (!state.suspendedPhase) throw new RunTransitionError('INVALID_EVENT', 'Missing interrupted checkpoint.');
      changes = { phase: state.suspendedPhase === 'applying' ? 'awaiting_approval' : state.suspendedPhase,
        suspendedPhase: undefined, reason: undefined, approvalId: undefined }; break;
    }
    case 'request_cancel':
    case 'request_timeout':
      if (state.phase === 'cancelling') throw new RunTransitionError('ILLEGAL_TRANSITION', 'Cancellation is already in progress.');
      if (event.type === 'request_timeout' && event.atMs < state.deadlineAtMs) throw new RunTransitionError('INVALID_EVENT', 'Deadline has not elapsed.');
      changes = { phase: 'cancelling', suspendedPhase: state.phase, cancellationKind: event.type === 'request_timeout' ? 'timeout' : 'user' }; break;
    case 'cancellation_settled':
      from('cancelling'); requireHash(event.receiptDigest);
      if (event.processTreeStopped !== true || event.leaseReleased !== true) throw new RunTransitionError('INVALID_EVENT', 'Cancellation requires process and lease settlement.');
      if (state.transactionId && event.disposition === 'no_apply') throw new RunTransitionError('INVALID_EVENT', 'A committed transaction must be preserved or rolled back explicitly.');
      changes = { phase: state.cancellationKind === 'timeout' ? 'timed_out' : 'cancelled', reason: event.disposition }; break;
    case 'fail':
      if (effects.has(state.phase) || ['interrupted', 'cancelling'].includes(state.phase)) {
        throw new RunTransitionError('ILLEGAL_TRANSITION', 'Settle side effects and processes before marking failure.');
      }
      requireText(event.reason); changes = { phase: 'failed', reason: event.reason }; break;
  }
  return Object.freeze({ ...state, ...changes, revision: state.revision + 1, updatedAtMs: event.atMs });
}
