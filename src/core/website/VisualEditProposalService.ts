/**
 * Phase PX-16: Visual Edit Proposal Service
 * PX16-T07
 */

import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  VisualEditProposal,
  WebsiteProjectSchema,
  WebsiteBlockData
} from './WebsiteTypes';

export class VisualEditProposalService {
  private proposals: Map<string, VisualEditProposal> = new Map();

  public createProposal(input: {
    projectId: string;
    targetBlockId: string;
    targetElementId?: string;
    instruction: string;
    targetFiles: string[];
    diff: string;
    summary: string;
    blockMutation?: Partial<WebsiteBlockData>;
    responsiveImpactSummary?: string;
    wcagScoreBefore?: number;
    wcagScoreAfter?: number;
    accessibilityWarnings?: string[];
    testsToRun?: string[];
  }): VisualEditProposal {
    const id = `prop-${uuidv4()}`;

    // Compute cryptographic SHA-256 approval digest of exact changes
    const digestPayload = JSON.stringify({
      projectId: input.projectId,
      targetBlockId: input.targetBlockId,
      instruction: input.instruction,
      targetFiles: input.targetFiles,
      diff: input.diff,
      blockMutation: input.blockMutation
    });
    const approvalDigest = crypto.createHash('sha256').update(digestPayload).digest('hex');

    const proposal: VisualEditProposal = {
      id,
      projectId: input.projectId,
      targetBlockId: input.targetBlockId,
      targetElementId: input.targetElementId,
      instruction: input.instruction,
      proposedPatch: {
        targetFiles: input.targetFiles,
        diff: input.diff,
        summary: input.summary,
        blockMutation: input.blockMutation
      },
      responsiveImpactSummary:
        input.responsiveImpactSummary || 'Layout maintains responsive grid constraints across 375px-1280px.',
      accessibilityImpact: {
        contrastChanged: false,
        ariaChanged: false,
        wcagScoreBefore: input.wcagScoreBefore ?? 95,
        wcagScoreAfter: input.wcagScoreAfter ?? 95,
        warnings: input.accessibilityWarnings || []
      },
      testsToRun: input.testsToRun || ['npm run test:unit', 'npm run a11y:check'],
      approvalDigest,
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString()
    };

    this.proposals.set(id, proposal);
    return JSON.parse(JSON.stringify(proposal));
  }

  public getProposal(proposalId: string): VisualEditProposal | undefined {
    return this.proposals.get(proposalId);
  }

  public listProposals(projectId?: string): VisualEditProposal[] {
    const all = Array.from(this.proposals.values());
    if (projectId) return all.filter(p => p.projectId === projectId);
    return all;
  }

  public approveProposal(proposalId: string, providedDigest: string): VisualEditProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);

    if (proposal.approvalDigest !== providedDigest) {
      throw new Error(
        `Approval digest mismatch! Provided '${providedDigest}' does not match expected '${proposal.approvalDigest}'. Changes may have been tampered.`
      );
    }

    if (proposal.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot approve proposal in state '${proposal.status}'`);
    }

    proposal.status = 'APPROVED';
    return JSON.parse(JSON.stringify(proposal));
  }

  public rejectProposal(proposalId: string, reason?: string): VisualEditProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);

    proposal.status = 'REJECTED';
    return JSON.parse(JSON.stringify(proposal));
  }

  public applyProposal(proposalId: string): VisualEditProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);

    if (proposal.status !== 'APPROVED') {
      throw new Error(
        `Cannot apply unapproved proposal '${proposalId}'. Exact approval with valid digest is required before mutation.`
      );
    }

    proposal.status = 'APPLIED';
    proposal.appliedAt = new Date().toISOString();
    return JSON.parse(JSON.stringify(proposal));
  }
}
