import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EngineMutationProposal, EngineProposalDraft, EngineTransaction, EngineType, GameEngineError } from './GameEngineTypes';
import { resolveProjectPath } from './ProjectPathGuard';

export class ProjectMutationStore {
  private readonly proposals = new Map<string, EngineMutationProposal>();
  private readonly transactions = new Map<string, EngineTransaction>();

  constructor(private readonly engine: EngineType, private readonly projectRoot: string) {}

  public createProposal(draft: EngineProposalDraft): EngineMutationProposal {
    const id = `${this.engine}-prop-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const requesterId = draft.requesterId || 'system';
    const tenantId = draft.tenantId || 'default-tenant';
    const environment = draft.environment || process.env.NODE_ENV || 'development';
    const capabilityVersion = draft.capabilityVersion || '1.0.0';
    const expectedOutputs = (draft.actions || []).map(a => a.targetPath);

    const inputFileHashes: Record<string, string | null> = {};
    for (const action of draft.actions || []) {
      if (action.targetPath) {
        try {
          const target = resolveProjectPath(this.projectRoot, action.targetPath);
          if (fs.existsSync(target) && fs.statSync(target).isFile()) {
            inputFileHashes[action.targetPath] = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
          } else {
            inputFileHashes[action.targetPath] = null;
          }
        } catch {
          inputFileHashes[action.targetPath] = null;
        }
      }
    }

    const inputDigest = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        engine: this.engine,
        projectRoot: path.resolve(this.projectRoot),
        requesterId,
        tenantId,
        environment,
        capabilityVersion,
        actions: draft.actions,
        inputFileHashes,
        expectedOutputs,
        risk: draft.risk
      }))
      .digest('hex');

    const proposal: EngineMutationProposal = {
      ...draft,
      engine: this.engine,
      id,
      requesterId,
      tenantId,
      environment,
      capabilityVersion,
      expectedOutputs,
      inputFileHashes,
      inputDigest,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      status: 'proposed'
    };
    this.proposals.set(id, proposal);
    return proposal;
  }

  public approve(proposalId: string, approverId: string, options?: { tenantId?: string }): EngineMutationProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new GameEngineError('SCENE_NOT_FOUND', `Mutation proposal not found: ${proposalId}`);
    if (proposal.status !== 'proposed') throw new GameEngineError('APPROVAL_REQUIRED', `Proposal cannot be approved; status is ${proposal.status}.`);
    if (proposal.expiresAt < new Date().toISOString()) throw new GameEngineError('APPROVAL_REQUIRED', 'Mutation proposal has expired.');
    if (!approverId.trim()) throw new GameEngineError('APPROVAL_REQUIRED', 'An approver identity is required.');
    if (options?.tenantId && proposal.tenantId && options.tenantId !== proposal.tenantId) {
      throw new GameEngineError('APPROVAL_REQUIRED', 'Tenant mismatch for mutation proposal approval.');
    }

    proposal.approverId = approverId;
    proposal.approvalDigest = crypto
      .createHash('sha256')
      .update(`${proposal.inputDigest}:${approverId}:${proposal.tenantId}:${proposal.expiresAt}`)
      .digest('hex');
    proposal.status = 'approved';
    return proposal;
  }

  public apply(proposalId: string, approvalDigest: string, options?: { callerId?: string; tenantId?: string }): EngineTransaction {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new GameEngineError('SCENE_NOT_FOUND', `Mutation proposal not found: ${proposalId}`);
    if (proposal.status !== 'approved' || !proposal.approvalDigest) throw new GameEngineError('APPROVAL_REQUIRED', `Proposal cannot be applied; status is ${proposal.status}.`);
    if (proposal.expiresAt < new Date().toISOString()) throw new GameEngineError('APPROVAL_REQUIRED', 'Mutation proposal has expired.');
    if (!approvalDigest) throw new GameEngineError('APPROVAL_REQUIRED', 'Exact proposal digest approval is required.');
    if (approvalDigest !== proposal.approvalDigest) throw new GameEngineError('APPROVAL_DIGEST_MISMATCH', 'Approval digest does not match the exact approved mutation.');
    if (options?.tenantId && proposal.tenantId && options.tenantId !== proposal.tenantId) {
      throw new GameEngineError('APPROVAL_REQUIRED', 'Tenant mismatch on mutation application.');
    }

    // Verify input file integrity (prevent TOCTOU mutations between proposal and apply)
    for (const [relPath, expectedHash] of Object.entries(proposal.inputFileHashes || {})) {
      const target = resolveProjectPath(this.projectRoot, relPath);
      const currentHash = fs.existsSync(target) && fs.statSync(target).isFile()
        ? crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')
        : null;
      if (currentHash !== expectedHash) {
        throw new GameEngineError('APPROVAL_DIGEST_MISMATCH', `Input file '${relPath}' has been modified since proposal creation.`);
      }
    }

    const writableTypes = ['create_scene', 'save_scene', 'create_script', 'update_script', 'modify_resource', 'update_project_setting', 'custom'];
    const prepared = proposal.actions.map(action => {
      const target = resolveProjectPath(this.projectRoot, action.targetPath);
      const deletesFile = action.type === 'delete_scene' || action.type === 'remove_node';
      if (!deletesFile && !writableTypes.includes(action.type)) {
        throw new GameEngineError('SCRIPT_VALIDATION_FAILED', `Native file transaction does not support action type '${action.type}'.`);
      }
      const content = action.params.content;
      if (!deletesFile && typeof content !== 'string') {
        throw new GameEngineError('SCRIPT_VALIDATION_FAILED', `${action.type} requires params.content.`);
      }
      return { action, target, deletesFile, content };
    });

    const snapshots: EngineTransaction['snapshots'] = [];
    const snapshotted = new Set<string>();
    for (const { target } of prepared) {
      if (snapshotted.has(target)) continue;
      snapshotted.add(target);
      snapshots.push({
        path: target,
        previousContent: fs.existsSync(target) && fs.statSync(target).isFile() ? fs.readFileSync(target, 'utf8') : null
      });
    }

    try {
      for (const { target, deletesFile, content } of prepared) {
        if (deletesFile) {
          if (fs.existsSync(target) && fs.statSync(target).isFile()) fs.unlinkSync(target);
          continue;
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content as string, 'utf8');
      }
    } catch (error) {
      for (const snapshot of [...snapshots].reverse()) {
        if (snapshot.previousContent === null) {
          if (fs.existsSync(snapshot.path) && fs.statSync(snapshot.path).isFile()) fs.unlinkSync(snapshot.path);
        } else {
          fs.mkdirSync(path.dirname(snapshot.path), { recursive: true });
          fs.writeFileSync(snapshot.path, snapshot.previousContent, 'utf8');
        }
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new GameEngineError('INTERNAL_ADAPTER_ERROR', `Mutation transaction failed and was rolled back: ${message}`);
    }
    const transaction: EngineTransaction = {
      id: `${this.engine}-tx-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      proposalId,
      timestamp: new Date().toISOString(),
      actions: proposal.actions,
      snapshots,
      rolledBack: false
    };
    proposal.status = 'applied';
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  public rollback(transactionId: string): boolean {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || transaction.rolledBack) return false;
    for (const snapshot of [...transaction.snapshots].reverse()) {
      if (snapshot.previousContent === null) {
        if (fs.existsSync(snapshot.path) && fs.statSync(snapshot.path).isFile()) fs.unlinkSync(snapshot.path);
      } else {
        fs.mkdirSync(path.dirname(snapshot.path), { recursive: true });
        fs.writeFileSync(snapshot.path, snapshot.previousContent, 'utf8');
      }
    }
    transaction.rolledBack = true;
    const proposal = this.proposals.get(transaction.proposalId);
    if (proposal) proposal.status = 'rolled_back';
    return true;
  }
}
