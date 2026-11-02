import {
  SourceAuthorityTier,
  BASE_AUTHORITY_WEIGHTS
} from '../../types/retrieval-scoring';

export class SourceAuthorityPolicy {
  private customWeights: Map<SourceAuthorityTier, number>;

  constructor(customOverrides?: Partial<Record<SourceAuthorityTier, number>>) {
    this.customWeights = new Map(
      Object.entries(BASE_AUTHORITY_WEIGHTS) as [SourceAuthorityTier, number][]
    );
    if (customOverrides) {
      for (const [tier, weight] of Object.entries(customOverrides)) {
        if (typeof weight === 'number' && weight >= 0 && weight <= 1) {
          this.customWeights.set(tier as SourceAuthorityTier, weight);
        }
      }
    }
  }

  public getAuthorityScore(tier: SourceAuthorityTier): number {
    return this.customWeights.get(tier) ?? BASE_AUTHORITY_WEIGHTS[tier] ?? 0.50;
  }

  public inferTierFromUri(uri: string): SourceAuthorityTier {
    const lower = uri.toLowerCase();
    if (lower.startsWith('project://') || lower.startsWith('workspace://') || lower.startsWith('file:///repo')) {
      return SourceAuthorityTier.REPO_EVIDENCE;
    }
    if (lower.includes('spec.whatwg.org') || lower.includes('w3.org') || lower.includes('tools.ietf.org') || lower.includes('iso.org')) {
      return SourceAuthorityTier.OFFICIAL_SPEC;
    }
    if (
      lower.includes('docs.') ||
      lower.includes('developer.') ||
      lower.includes('react.dev') ||
      lower.includes('nodejs.org/docs') ||
      lower.includes('typescriptlang.org/docs') ||
      lower.includes('docs.godotengine.org')
    ) {
      return SourceAuthorityTier.OFFICIAL_DOCS;
    }
    if (lower.includes('arxiv.org') || lower.includes('doi.org') || lower.includes('acm.org') || lower.includes('ieee.org')) {
      return SourceAuthorityTier.REPUTABLE_RESEARCH;
    }
    if (lower.includes('stackoverflow.com') || lower.includes('stackexchange.com')) {
      return SourceAuthorityTier.ACCEPTED_DEV_QA;
    }
    if (lower.includes('github.com') || lower.includes('gitlab.com')) {
      return SourceAuthorityTier.CURATED_CODE;
    }
    if (lower.includes('wikipedia.org') || lower.includes('wikidata.org')) {
      return SourceAuthorityTier.ENCYCLOPEDIA;
    }
    if (lower.includes('.edu') || lower.includes('khanacademy.org') || lower.includes('mit.edu')) {
      return SourceAuthorityTier.EDUCATIONAL_WEB;
    }
    return SourceAuthorityTier.GENERAL_WEB;
  }

  public getAllWeights(): Record<SourceAuthorityTier, number> {
    const result = {} as Record<SourceAuthorityTier, number>;
    for (const [tier, val] of this.customWeights.entries()) {
      result[tier] = val;
    }
    return result;
  }
}
