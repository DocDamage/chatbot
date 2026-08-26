/**
 * Godot Transaction Manager (PX08-T05)
 *
 * Provides cryptographic proposal generation, approval validation,
 * atomic rollback snapshots, and undo/redo stacks for Godot project mutations.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  EngineMutationProposal,
  EngineMutationAction,
  EngineTransaction,
  GameEngineError,
  MutationRisk
} from '../engine/GameEngineTypes';
import { resolveProjectPath } from '../engine/ProjectPathGuard';

export class GodotTransactionManager {
  private proposals = new Map<string, EngineMutationProposal>();
  private transactions = new Map<string, EngineTransaction>();
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  constructor(private readonly projectRoot: string) {}

  /**
   * Compute a deterministic SHA-256 digest of mutation inputs
   */
  public static computeInputDigest(
    projectId: string,
    actions: EngineMutationAction[]
  ): string {
    const sortedActions = JSON.stringify(actions, Object.keys(actions).sort());
    return crypto
      .createHash('sha256')
      .update(`${projectId}:${sortedActions}`)
      .digest('hex');
  }

  /**
   * Compute approval digest binding identity, action digest, and timestamp
   */
  public static computeApprovalDigest(
    inputDigest: string,
    approverId: string,
    expiresAt: string
  ): string {
    return crypto
      .createHash('sha256')
      .update(`${inputDigest}:${approverId}:${expiresAt}`)
      .digest('hex');
  }

  /**
   * Create a new mutation proposal
   */
  public createProposal(options: {
    projectId: string;
    title: string;
    description: string;
    risk?: MutationRisk;
    actions: EngineMutationAction[];
    ttlMinutes?: number;
  }): EngineMutationProposal {
    const id = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const inputDigest = GodotTransactionManager.computeInputDigest(
      options.projectId,
      options.actions
    );
    const ttl = options.ttlMinutes ?? 30;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000).toISOString();

    const proposal: EngineMutationProposal = {
      id,
      engine: 'godot',
      projectId: options.projectId,
      title: options.title,
      description: options.description,
      risk: options.risk ?? 'medium',
      actions: options.actions,
      inputDigest,
      createdAt,
      expiresAt,
      status: 'proposed'
    };

    this.proposals.set(id, proposal);
    return proposal;
  }

  /**
   * Get a stored proposal
   */
  public getProposal(proposalId: string): EngineMutationProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new GameEngineError('SCENE_NOT_FOUND', `Proposal not found: ${proposalId}`);
    }
    return proposal;
  }

  /**
   * Approve a proposal with an approval digest
   */
  public approveProposal(proposalId: string, approverId: string): EngineMutationProposal {
    const proposal = this.getProposal(proposalId);
    if (proposal.status !== 'proposed') {
      throw new GameEngineError('APPROVAL_REQUIRED', `Proposal ${proposalId} cannot be approved; status is ${proposal.status}`);
    }
    if (new Date(proposal.expiresAt).getTime() < Date.now()) {
      throw new GameEngineError('APPROVAL_REQUIRED', `Proposal ${proposalId} has expired`);
    }
    if (!approverId.trim()) {
      throw new GameEngineError('APPROVAL_REQUIRED', 'An approver identity is required');
    }

    const approvalDigest = GodotTransactionManager.computeApprovalDigest(
      proposal.inputDigest,
      approverId,
      proposal.expiresAt
    );

    proposal.approverId = approverId;
    proposal.approvalDigest = approvalDigest;
    proposal.status = 'approved';
    return proposal;
  }

  /**
   * Execute approved mutation actions atomically and record transaction rollback snapshot
   */
  public async executeTransaction(
    proposalId: string,
    providedApprovalDigest: string,
    actionApplier: (action: EngineMutationAction, root: string) => Promise<void>,
    options?: { callerId?: string; tenantId?: string }
  ): Promise<EngineTransaction> {
    const proposal = this.getProposal(proposalId);

    if (proposal.status !== 'approved' || !proposal.approvalDigest) {
      throw new GameEngineError(
        'APPROVAL_REQUIRED',
        `Proposal ${proposalId} cannot be applied; status is ${proposal.status}`
      );
    }

    if (proposal.approvalDigest !== providedApprovalDigest) {
      throw new GameEngineError(
        'APPROVAL_DIGEST_MISMATCH',
        `Approval digest does not match for proposal ${proposalId}`
      );
    }

    if (proposal.approverId) {
      if (!options?.callerId || !options.callerId.trim()) {
        throw new GameEngineError('APPROVAL_REQUIRED', 'Caller identity is required to apply an approved mutation.');
      }
      if (options.callerId !== proposal.approverId) {
        throw new GameEngineError('APPROVAL_REQUIRED', `Caller identity '${options.callerId}' does not match approver identity '${proposal.approverId}'.`);
      }
    }

    // Capture pre-mutation snapshots of all target files
    const snapshots: Array<{ path: string; previousContent: string | null }> = [];
    const touchedPaths = new Set<string>();

    for (const action of proposal.actions) {
      if (action.targetPath && !touchedPaths.has(action.targetPath)) {
        touchedPaths.add(action.targetPath);
        const fullPath = resolveProjectPath(this.projectRoot, action.targetPath);

        const previousContent = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null;
        snapshots.push({ path: fullPath, previousContent });
      }
    }

    const transactionId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      // Execute all actions
      for (const action of proposal.actions) {
        await actionApplier(action, this.projectRoot);
      }

      proposal.status = 'applied';

      const transaction: EngineTransaction = {
        id: transactionId,
        proposalId,
        timestamp: new Date().toISOString(),
        actions: proposal.actions,
        snapshots,
        rolledBack: false
      };

      this.transactions.set(transactionId, transaction);
      this.undoStack.push(transactionId);
      this.redoStack = [];

      return transaction;
    } catch (err: any) {
      // Roll back pre-mutation snapshots immediately on error
      for (const snap of snapshots) {
        if (snap.previousContent !== null) {
          fs.writeFileSync(snap.path, snap.previousContent, 'utf8');
        } else if (fs.existsSync(snap.path)) {
          fs.unlinkSync(snap.path);
        }
      }
      throw new GameEngineError(
        'INTERNAL_ADAPTER_ERROR',
        `Transaction failed and rolled back automatically: ${err.message}`,
        { error: err.message }
      );
    }
  }

  /**
   * Roll back a previous transaction
   */
  public rollbackTransaction(transactionId: string): boolean {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.rolledBack) return false;

    for (const snap of tx.snapshots) {
      if (snap.previousContent !== null) {
        fs.writeFileSync(snap.path, snap.previousContent, 'utf8');
      } else if (fs.existsSync(snap.path)) {
        fs.unlinkSync(snap.path);
      }
    }

    tx.rolledBack = true;
    const proposal = this.proposals.get(tx.proposalId);
    if (proposal) proposal.status = 'rolled_back';

    return true;
  }

  /**
   * Undo the latest transaction
   */
  public undo(): boolean {
    const txId = this.undoStack.pop();
    if (!txId) return false;
    const success = this.rollbackTransaction(txId);
    if (success) this.redoStack.push(txId);
    return success;
  }

  /**
   * Get transaction details
   */
  public getTransaction(txId: string): EngineTransaction | undefined {
    return this.transactions.get(txId);
  }
}
