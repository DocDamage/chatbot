import {
  SourceAuthorityTier,
  BASE_AUTHORITY_WEIGHTS,
  VersionCompatibilityStatus,
  VERSION_COMPATIBILITY_SCORES,
  DEFAULT_RETRIEVAL_POLICY_WEIGHTS,
  RetrievalPolicyWeightsSchema
} from './retrieval-scoring';

describe('Retrieval Scoring Schemas & Weights (CRK-P09)', () => {
  it('should enforce descending baseline authority order matching §1875-1890', () => {
    expect(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.USER_CANONICAL]).toBe(1.00);
    expect(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.REPO_EVIDENCE]).toBe(0.98);
    expect(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.OFFICIAL_SPEC]).toBe(0.97);
    expect(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.OFFICIAL_DOCS]).toBe(0.95);
    expect(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.REPUTABLE_RESEARCH]).toBe(0.88);
    expect(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.VETTED_REFERENCE]).toBe(0.84);
    expect(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.ACCEPTED_DEV_QA]).toBe(0.78);
    expect(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.CURATED_CODE]).toBe(0.74);
    expect(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.ENCYCLOPEDIA]).toBe(0.67);
    expect(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.EDUCATIONAL_WEB]).toBe(0.58);
    expect(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.GENERAL_WEB]).toBe(0.42);
  });

  it('should define version compatibility scores matching §1928-1934', () => {
    expect(VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.EXACT]).toBe(1.00);
    expect(VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.SAME_MAJOR_COMPATIBLE_MINOR]).toBe(0.90);
    expect(VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.SAME_MAJOR_UNKNOWN_MINOR]).toBe(0.75);
    expect(VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.OLDER_MAJOR]).toBe(0.25);
    expect(VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.KNOWN_INCOMPATIBLE]).toBe(0.00);
    expect(VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.UNKNOWN]).toBe(0.55);
  });

  it('should sum default retrieval weights to 1.00 (§1958-1966)', () => {
    const w = DEFAULT_RETRIEVAL_POLICY_WEIGHTS;
    const sum = Number((
      w.semanticSimilarity +
      w.lexicalScore +
      w.rerankerScore +
      w.authorityScore +
      w.versionScore +
      w.freshnessScore +
      w.qualityScore
    ).toFixed(2));
    expect(sum).toBe(1.00);
    expect(RetrievalPolicyWeightsSchema.safeParse(w).success).toBe(true);
  });
});
