/**
 * Controlled Context Failure Learning & Proposal Service (PX-03 / PX03-T11)
 * Mines failed queries, context truncation errors, and user corrections into
 * structured improvement proposals for human review. Never mutates rules silently.
 */

export interface CompressionFailureProposal {
  id: string;
  query: string;
  category: string;
  observedFailure: string;
  suggestedAction: 'increase_budget' | 'adjust_heuristic' | 'pin_anchor' | 'disable_lossy';
  evidenceSnapshot: Record<string, unknown>;
  status: 'pending_review' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export class ContextFailureLearningService {
  private static instance: ContextFailureLearningService;
  private proposals = new Map<string, CompressionFailureProposal>();

  public static getInstance(): ContextFailureLearningService {
    if (!ContextFailureLearningService.instance) {
      ContextFailureLearningService.instance = new ContextFailureLearningService();
    }
    return ContextFailureLearningService.instance;
  }

  public recordFailureCandidate(params: {
    query: string;
    category: string;
    observedFailure: string;
    suggestedAction: CompressionFailureProposal['suggestedAction'];
    evidenceSnapshot: Record<string, unknown>;
  }): CompressionFailureProposal {
    const id = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const proposal: CompressionFailureProposal = {
      id,
      query: params.query,
      category: params.category,
      observedFailure: params.observedFailure,
      suggestedAction: params.suggestedAction,
      evidenceSnapshot: params.evidenceSnapshot,
      status: 'pending_review',
      createdAt: new Date().toISOString()
    };

    this.proposals.set(id, proposal);
    return proposal;
  }

  public reviewProposal(id: string, reviewerId: string, decision: 'approved' | 'rejected'): boolean {
    const prop = this.proposals.get(id);
    if (!prop) return false;

    prop.status = decision;
    prop.reviewedBy = reviewerId;
    prop.reviewedAt = new Date().toISOString();
    return true;
  }

  public listProposals(status?: CompressionFailureProposal['status']): CompressionFailureProposal[] {
    let list = Array.from(this.proposals.values());
    if (status) {
      list = list.filter(p => p.status === status);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public clear(): void {
    this.proposals.clear();
  }
}
