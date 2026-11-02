/**
 * Unreal Mutation Manager (PX09-T07)
 *
 * Implements staged, approved Unreal Engine mutation jobs (actor placement,
 * Blueprint node creation, source-control checkout proposals).
 */

import { EngineMutationAction, EngineMutationProposal, EngineTransaction, GameEngineError } from '../engine/GameEngineTypes';
import { UnrealLicenseGate } from './UnrealLicenseGate';
import crypto from 'node:crypto';

export class UnrealMutationManager {
  private proposals = new Map<string, EngineMutationProposal>();

  public createProposal(options: {
    projectId: string;
    title: string;
    description: string;
    actions: EngineMutationAction[];
  }): EngineMutationProposal {
    UnrealLicenseGate.assertCleared();

    const id = `ue5-prop-${Date.now()}`;
    const proposal: EngineMutationProposal = {
      id,
      engine: 'unreal',
      projectId: options.projectId,
      title: options.title,
      description: options.description,
      risk: 'medium',
      actions: options.actions,
      inputDigest: crypto.createHash('sha256').update(JSON.stringify({ projectId: options.projectId, actions: options.actions })).digest('hex'),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      status: 'proposed'
    };

    this.proposals.set(id, proposal);
    return proposal;
  }

  public applyMutation(proposalId: string, approvalDigest: string): EngineTransaction {
    UnrealLicenseGate.assertCleared();
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new GameEngineError('SCENE_NOT_FOUND', `Unreal proposal not found: ${proposalId}`);
    }

    throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'UNREAL_EDITOR_BACKEND_UNAVAILABLE: staged proposals cannot be applied without a verified editor adapter.');
  }
}
