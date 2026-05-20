import { ChronoSource } from './ChronoDate';

const AUTHORITY_SCORE = {
  primary: 1,
  academic: 0.92,
  institutional: 0.85,
  reference: 0.72,
  metadata: 0.68,
  community: 0.45
};

export class SourceAuthorityRanker {
  rank(sources: ChronoSource[], modernClaim = false): ChronoSource[] {
    return [...sources].sort((a, b) => this.score(b, modernClaim) - this.score(a, modernClaim));
  }

  score(source: ChronoSource, modernClaim = false): number {
    const base = AUTHORITY_SCORE[source.authority] ?? 0.5;
    const recencyBonus = modernClaim && source.sourceType === 'metadata' ? 0.05 : 0;
    return Math.min(1, base * source.confidence + recencyBonus);
  }
}
