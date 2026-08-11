export type KnowledgeAuthority = 'repository' | 'official' | 'curated' | 'learned';

export interface CodingKnowledgeEntry {
  id: string;
  title: string;
  content: string;
  language?: string;
  ecosystem?: string;
  projectVersion?: string;
  source?: string;
  sourceDate?: string;
  authority: KnowledgeAuthority;
  projectScope?: string;
  tags: string[];
  verificationStatus: 'unverified' | 'verified' | 'promoted' | 'quarantined';
  provenance: string[];
  revalidateAfter?: string;
}

export interface PromotionEvidence { userApproved?: boolean; trustedSourceConfirmed?: boolean; verificationPassed?: boolean; regressionTestPassed?: boolean; }

export class ProvenancePolicy {
  canPromote(entry: CodingKnowledgeEntry, evidence: PromotionEvidence): boolean {
    if (entry.authority === 'repository' || entry.authority === 'official') return true;
    return Boolean(evidence.userApproved || evidence.trustedSourceConfirmed || evidence.verificationPassed && evidence.regressionTestPassed);
  }

  promote(entry: CodingKnowledgeEntry, evidence: PromotionEvidence): CodingKnowledgeEntry {
    if (!this.canPromote(entry, evidence)) throw new Error('Knowledge entry cannot be promoted without verification, trusted provenance, or explicit approval');
    return { ...entry, verificationStatus: 'promoted', provenance: [...entry.provenance, 'promotion-approved'] };
  }

  authorityRank(authority: KnowledgeAuthority): number { return { repository: 4, official: 3, curated: 2, learned: 1 }[authority]; }
}
