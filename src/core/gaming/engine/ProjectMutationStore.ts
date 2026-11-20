import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EngineMutationProposal, EngineProposalDraft, EngineTransaction, EngineType, GameEngineError } from './GameEngineTypes';
import { assertEngineApproval, approveEngineProposal, copyJson, createEngineProposal } from './EngineProposalIntegrity';
import { validateTextTarget } from './EngineTextMutationPolicy';
import { restoreEngineSnapshots } from './EngineSnapshotRestore';

export class ProjectMutationStore {
  private readonly proposals = new Map<string, EngineMutationProposal>();
  private readonly transactions = new Map<string, EngineTransaction>();

  constructor(private readonly engine: EngineType, private readonly projectRoot: string) {}

  public createProposal(draft: EngineProposalDraft): EngineMutationProposal {
    const proposal = createEngineProposal(this.engine, this.projectRoot, draft);
    this.proposals.set(proposal.id, proposal);
    return copyJson(proposal);
  }

  public approve(proposalId: string, approverId: string, options?: { tenantId?: string }): EngineMutationProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new GameEngineError('SCENE_NOT_FOUND', `Mutation proposal not found: ${proposalId}`);
    approveEngineProposal(this.projectRoot, proposal, approverId, options?.tenantId);
    return copyJson(proposal);
  }

  public apply(proposalId: string, approvalDigest: string, options?: { callerId?: string; tenantId?: string }): EngineTransaction {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new GameEngineError('SCENE_NOT_FOUND', `Mutation proposal not found: ${proposalId}`);
    assertEngineApproval(this.projectRoot, proposal, approvalDigest, options);

    const writableTypes = ['create_scene', 'save_scene', 'create_script', 'update_script', 'modify_resource', 'update_project_setting', 'custom'];
    const prepared = proposal.actions.map(action => {
      const deletesFile = action.type === 'delete_scene';
      if (!deletesFile && !writableTypes.includes(action.type)) {
        throw new GameEngineError('SCRIPT_VALIDATION_FAILED', `Native file transaction does not support action type '${action.type}'.`);
      }
      const target = validateTextTarget(this.projectRoot, action);
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
      restoreEngineSnapshots(this.projectRoot, snapshots);
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
    return copyJson(transaction);
  }

  public rollback(transactionId: string): boolean {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || transaction.rolledBack) return false;
    restoreEngineSnapshots(this.projectRoot, transaction.snapshots);
    transaction.rolledBack = true;
    const proposal = this.proposals.get(transaction.proposalId);
    if (proposal) proposal.status = 'rolled_back';
    return true;
  }
}
