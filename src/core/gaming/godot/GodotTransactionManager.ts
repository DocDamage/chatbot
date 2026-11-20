import fs from 'node:fs';
import crypto from 'node:crypto';
import { EngineMutationProposal, EngineMutationAction, EngineProposalDraft, EngineTransaction, GameEngineError } from '../engine/GameEngineTypes';
import { resolveProjectPath } from '../engine/ProjectPathGuard';
import { assertEngineApproval, approveEngineProposal, copyJson, createEngineProposal } from '../engine/EngineProposalIntegrity';
import { validateGodotAction } from '../engine/EngineTextMutationPolicy';
import { digestJson } from '../engine/CanonicalJson';
import { restoreEngineSnapshots } from '../engine/EngineSnapshotRestore';

export class GodotTransactionManager {
  private readonly proposals = new Map<string, EngineMutationProposal>();
  private readonly transactions = new Map<string, EngineTransaction>();
  private readonly undoStack: string[] = [];
  private readonly applying = new Set<string>();

  constructor(private readonly projectRoot: string) {}

  /** Action identity helper; stored proposals additionally bind root, files, and authority scope. */
  public static computeInputDigest(projectId: string, actions: EngineMutationAction[]): string {
    return digestJson('godot-actions:v1', { projectId, actions });
  }

  public createProposal(options: Omit<EngineProposalDraft, 'engine' | 'risk'> & { risk?: EngineProposalDraft['risk']; ttlMinutes?: number }): EngineMutationProposal {
    const proposal = createEngineProposal('godot', this.projectRoot, { ...options, engine: 'godot', risk: options.risk ?? 'medium' }, options.ttlMinutes);
    this.proposals.set(proposal.id, proposal);
    return copyJson(proposal);
  }

  private storedProposal(id: string): EngineMutationProposal {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new GameEngineError('SCENE_NOT_FOUND', `Proposal not found: ${id}`);
    return proposal;
  }

  public getProposal(id: string): EngineMutationProposal {
    return copyJson(this.storedProposal(id));
  }

  public approveProposal(id: string, approverId: string): EngineMutationProposal {
    const proposal = this.storedProposal(id);
    approveEngineProposal(this.projectRoot, proposal, approverId);
    return copyJson(proposal);
  }

  public async executeTransaction(id: string, providedDigest: string,
    actionApplier: (action: EngineMutationAction, root: string) => Promise<void>,
    options?: { callerId?: string; tenantId?: string }): Promise<EngineTransaction> {
    const proposal = this.storedProposal(id);
    assertEngineApproval(this.projectRoot, proposal, providedDigest, options);
    if (this.applying.size) throw new GameEngineError('APPROVAL_REQUIRED', 'A Godot mutation is already applying.');
    // All capabilities and targets are checked before invoking any writer.
    for (const action of proposal.actions) validateGodotAction(this.projectRoot, action);
    const snapshots = [...new Set(proposal.actions.map(action => resolveProjectPath(this.projectRoot, action.targetPath)))].map(target => ({
      path: target, previousContent: fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null
    }));
    this.applying.add(id);
    try {
      for (const action of proposal.actions) await actionApplier(copyJson(action), this.projectRoot);
      proposal.status = 'applied';
      const transaction: EngineTransaction = {
        id: `godot-tx-${crypto.randomUUID()}`, proposalId: id, timestamp: new Date().toISOString(),
        actions: copyJson(proposal.actions), snapshots, rolledBack: false
      };
      this.transactions.set(transaction.id, transaction);
      this.undoStack.push(transaction.id);
      return copyJson(transaction);
    } catch (error) {
      this.restore(snapshots);
      const message = error instanceof Error ? error.message : String(error);
      throw new GameEngineError('INTERNAL_ADAPTER_ERROR', `Transaction failed and rolled back automatically: ${message}`);
    } finally {
      this.applying.delete(id);
    }
  }

  private restore(snapshots: EngineTransaction['snapshots']): void {
    restoreEngineSnapshots(this.projectRoot, snapshots);
  }

  public rollbackTransaction(id: string): boolean {
    if (this.applying.size) throw new GameEngineError('APPROVAL_REQUIRED', 'A Godot mutation is already applying.');
    const transaction = this.transactions.get(id);
    if (!transaction || transaction.rolledBack) return false;
    this.restore(transaction.snapshots);
    transaction.rolledBack = true;
    this.storedProposal(transaction.proposalId).status = 'rolled_back';
    return true;
  }

  public undo(): boolean {
    const id = this.undoStack.pop();
    return id ? this.rollbackTransaction(id) : false;
  }

  public getTransaction(id: string): EngineTransaction | undefined {
    const transaction = this.transactions.get(id);
    return transaction ? copyJson(transaction) : undefined;
  }
}
