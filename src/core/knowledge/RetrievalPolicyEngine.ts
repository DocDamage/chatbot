import {
  CandidateEvidence,
  ScoredEvidence,
  RetrievalPolicy,
  RetrievalPolicyWeights,
  DEFAULT_RETRIEVAL_POLICY_WEIGHTS
} from '../../types/retrieval-scoring';
import { SourceAuthorityPolicy } from './SourceAuthorityPolicy';
import { FreshnessScorer } from './FreshnessScorer';
import { VersionCompatibilityEvaluator } from './VersionCompatibilityEvaluator';
import { QualityScorer } from './QualityScorer';

export class RetrievalPolicyEngine {
  private policy: RetrievalPolicy;
  private authorityPolicy: SourceAuthorityPolicy;
  private freshnessScorer: FreshnessScorer;
  private versionEvaluator: VersionCompatibilityEvaluator;
  private qualityScorer: QualityScorer;

  constructor(customPolicy?: Partial<RetrievalPolicy>) {
    this.authorityPolicy = new SourceAuthorityPolicy(customPolicy?.authorityWeights);
    this.freshnessScorer = new FreshnessScorer(customPolicy?.domainHalfLifeDays);
    this.versionEvaluator = new VersionCompatibilityEvaluator();
    this.qualityScorer = new QualityScorer();

    this.policy = {
      version: customPolicy?.version ?? '1.0.0',
      id: customPolicy?.id ?? 'default-retrieval-policy-v1',
      name: customPolicy?.name ?? 'Standard Production Retrieval Policy',
      weights: customPolicy?.weights ?? { ...DEFAULT_RETRIEVAL_POLICY_WEIGHTS },
      domainHalfLifeDays: customPolicy?.domainHalfLifeDays ?? {},
      authorityWeights: this.authorityPolicy.getAllWeights()
    };
  }

  public getPolicy(): RetrievalPolicy {
    return { ...this.policy, weights: { ...this.policy.weights } };
  }

  public updateWeights(weights: Partial<RetrievalPolicyWeights>): void {
    this.policy.weights = { ...this.policy.weights, ...weights };
  }

  public scoreEvidence(candidate: CandidateEvidence, referenceDate?: Date): ScoredEvidence {
    const sem = Math.min(1.0, Math.max(0.0, candidate.rawSimilarity ?? 0.50));
    const lex = Math.min(1.0, Math.max(0.0, candidate.rawLexical ?? sem));
    const rerank = Math.min(1.0, Math.max(0.0, candidate.rawReranker ?? sem));

    const auth = this.authorityPolicy.getAuthorityScore(candidate.authorityTier);
    const verRes = this.versionEvaluator.evaluate(candidate.versionContext);
    const fresh = this.freshnessScorer.computeFreshness(
      candidate.publishedAt,
      candidate.domain,
      undefined,
      referenceDate
    );
    const qual = this.qualityScorer.computeQuality(candidate.qualitySignals);

    const w = this.policy.weights;
    const finalScore = Number((
      sem * w.semanticSimilarity +
      lex * w.lexicalScore +
      rerank * w.rerankerScore +
      auth * w.authorityScore +
      verRes.score * w.versionScore +
      fresh * w.freshnessScore +
      qual * w.qualityScore
    ).toFixed(4));

    return {
      ...candidate,
      versionStatus: verRes.status,
      breakdown: {
        semanticSimilarity: sem,
        lexicalScore: lex,
        rerankerScore: rerank,
        authorityScore: auth,
        versionScore: verRes.score,
        freshnessScore: fresh,
        qualityScore: qual,
        finalScore
      }
    };
  }

  public rank(candidates: CandidateEvidence[], referenceDate?: Date): ScoredEvidence[] {
    const scored = candidates.map(c => this.scoreEvidence(c, referenceDate));
    return scored.sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore);
  }
}
