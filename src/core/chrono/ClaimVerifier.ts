import { ChronoClaim, ChronoSource } from './ChronoDate';
import { SourceAuthorityRanker } from './SourceAuthorityRanker';

export class ClaimVerifier {
  constructor(private readonly ranker = new SourceAuthorityRanker()) {}

  verify(claim: ChronoClaim, sources: ChronoSource[]) {
    const ranked = this.ranker.rank(sources);
    const sourceConfidence = ranked[0]?.confidence || 0;
    const confidence = Math.min(1, (claim.confidence + sourceConfidence) / 2);
    return {
      claim: claim.claim,
      status: confidence > 0.8 ? 'verified' : claim.status,
      confidence,
      sources: ranked
    };
  }
}
