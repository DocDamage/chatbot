import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson, digestJson } from './CanonicalJson';
import { EngineMutationProposal, EngineProposalDraft, EngineType, GameEngineError } from './GameEngineTypes';
import { resolveProjectPath } from './ProjectPathGuard';

export function copyJson<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

function inputHash(root: string, relativePath: string): string | null {
  const target = resolveProjectPath(root, relativePath);
  if (!fs.existsSync(target)) return null;
  if (!fs.statSync(target).isFile()) throw new GameEngineError('SCRIPT_VALIDATION_FAILED', 'Mutation target must be a file.');
  return crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
}

/** One integrity definition for every file/engine proposal. Approval remains server-owned. */
export function proposalDigest(root: string, proposal: EngineMutationProposal): string {
  const { status: _status, approverId: _approver, approvalDigest: _approval, inputDigest: _digest, ...scope } = proposal;
  return digestJson('engine-proposal:v1', { projectRoot: path.resolve(root), ...scope });
}

export function createEngineProposal(engine: EngineType, root: string, draft: EngineProposalDraft, ttlMinutes = 30): EngineMutationProposal {
  // Validate before cloning: JSON.stringify alone silently drops or coerces invalid values.
  const actions = copyJson(draft.actions);
  if (!Array.isArray(actions) || actions.some(action => !action || typeof action.type !== 'string' ||
    typeof action.targetPath !== 'string' || !action.targetPath.trim() || !action.params ||
    Array.isArray(action.params) || typeof action.params !== 'object')) {
    throw new GameEngineError('SCRIPT_VALIDATION_FAILED', 'Invalid mutation actions.');
  }
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0 || ttlMinutes > 30) {
    throw new GameEngineError('APPROVAL_REQUIRED', 'Proposal lifetime must be between zero and 30 minutes.');
  }
  const inputFileHashes: Record<string, string | null> = Object.create(null);
  for (const action of actions) inputFileHashes[action.targetPath] = inputHash(root, action.targetPath);
  const expectedOutputs = copyJson(draft.expectedOutputs ?? actions.map(action => action.targetPath));
  if (!Array.isArray(expectedOutputs) || expectedOutputs.some(value => typeof value !== 'string')) {
    throw new GameEngineError('SCRIPT_VALIDATION_FAILED', 'Invalid expected outputs.');
  }
  for (const output of expectedOutputs) resolveProjectPath(root, output);
  const proposal: EngineMutationProposal = {
    id: `${engine}-prop-${crypto.randomUUID()}`, engine,
    projectId: draft.projectId, title: draft.title, description: draft.description, risk: draft.risk,
    actions, requesterId: draft.requesterId || 'system', tenantId: draft.tenantId || 'default-tenant',
    environment: draft.environment || process.env.NODE_ENV || 'development',
    capabilityVersion: draft.capabilityVersion || '1.0.0', expectedOutputs, inputFileHashes,
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
    inputDigest: '', status: 'proposed'
  };
  if (draft.projectScope) proposal.projectScope = copyJson(draft.projectScope);
  for (const field of ['projectId', 'title', 'description', 'requesterId', 'tenantId', 'environment', 'capabilityVersion'] as const) {
    if (typeof proposal[field] !== 'string') throw new GameEngineError('SCRIPT_VALIDATION_FAILED', `Invalid proposal field '${field}'.`);
  }
  if (!proposal.projectId.trim() || !['low', 'medium', 'high', 'destructive'].includes(proposal.risk)) {
    throw new GameEngineError('SCRIPT_VALIDATION_FAILED', 'Invalid proposal project or risk.');
  }
  proposal.inputDigest = proposalDigest(root, proposal);
  return proposal;
}

function assertIntegrity(root: string, proposal: EngineMutationProposal): void {
  if (proposalDigest(root, proposal) !== proposal.inputDigest) {
    throw new GameEngineError('APPROVAL_DIGEST_MISMATCH', 'Proposal scope changed after creation.');
  }
  if (!Number.isFinite(Date.parse(proposal.expiresAt)) || Date.parse(proposal.expiresAt) <= Date.now()) {
    throw new GameEngineError('APPROVAL_REQUIRED', 'Mutation proposal has expired.');
  }
}

function approvalDigest(proposal: EngineMutationProposal, approverId: string): string {
  return digestJson('engine-approval:v1', {
    proposalId: proposal.id, inputDigest: proposal.inputDigest, approverId,
    tenantId: proposal.tenantId, expiresAt: proposal.expiresAt
  });
}

export function approveEngineProposal(root: string, proposal: EngineMutationProposal, approverId: string, tenantId?: string): void {
  if (proposal.status !== 'proposed') throw new GameEngineError('APPROVAL_REQUIRED', `Proposal cannot be approved; status is ${proposal.status}.`);
  assertIntegrity(root, proposal);
  if (typeof approverId !== 'string' || !approverId.trim()) throw new GameEngineError('APPROVAL_REQUIRED', 'An approver identity is required.');
  if (tenantId && tenantId !== proposal.tenantId) throw new GameEngineError('APPROVAL_REQUIRED', 'Tenant mismatch for mutation approval.');
  proposal.approverId = approverId;
  proposal.approvalDigest = approvalDigest(proposal, approverId);
  proposal.status = 'approved';
}

export function assertEngineApproval(root: string, proposal: EngineMutationProposal, providedDigest: string,
  options?: { callerId?: string; tenantId?: string }): void {
  if (proposal.status !== 'approved' || !proposal.approvalDigest || !proposal.approverId) {
    throw new GameEngineError('APPROVAL_REQUIRED', `Proposal cannot be applied; status is ${proposal.status}.`);
  }
  assertIntegrity(root, proposal);
  if (!providedDigest || providedDigest !== proposal.approvalDigest || providedDigest !== approvalDigest(proposal, proposal.approverId)) {
    throw new GameEngineError('APPROVAL_DIGEST_MISMATCH', 'Approval digest does not match the exact approved mutation.');
  }
  if (!options?.callerId?.trim()) throw new GameEngineError('APPROVAL_REQUIRED', 'Caller identity is required to apply an approved mutation.');
  if (options.callerId !== proposal.approverId) throw new GameEngineError('APPROVAL_REQUIRED', 'Caller does not match approver identity.');
  if (options.tenantId && options.tenantId !== proposal.tenantId) throw new GameEngineError('APPROVAL_REQUIRED', 'Tenant mismatch on mutation application.');
  for (const [relativePath, expected] of Object.entries(proposal.inputFileHashes || {})) {
    if (inputHash(root, relativePath) !== expected) throw new GameEngineError('APPROVAL_DIGEST_MISMATCH', `Input file '${relativePath}' has been modified since proposal creation.`);
  }
}
