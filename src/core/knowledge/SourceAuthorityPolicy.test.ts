import { SourceAuthorityPolicy } from './SourceAuthorityPolicy';
import { BASE_AUTHORITY_WEIGHTS, SourceAuthorityTier } from '../../types/retrieval-scoring';

describe('SourceAuthorityPolicy', () => {
  it.each([
    ['project workspace evidence', 'project://chatbot/src/index.ts', SourceAuthorityTier.REPO_EVIDENCE],
    ['workspace evidence', 'workspace://chatbot/src/index.ts', SourceAuthorityTier.REPO_EVIDENCE],
    ['file repository evidence', 'file:///repo/src/index.ts', SourceAuthorityTier.REPO_EVIDENCE],
    ['WHATWG specification', 'https://spec.whatwg.org/multipage/', SourceAuthorityTier.OFFICIAL_SPEC],
    ['W3C specification', 'https://www.w3.org/TR/css/', SourceAuthorityTier.OFFICIAL_SPEC],
    ['IETF specification', 'https://tools.ietf.org/html/rfc9110', SourceAuthorityTier.OFFICIAL_SPEC],
    ['ISO specification', 'https://www.iso.org/standard/63555.html', SourceAuthorityTier.OFFICIAL_SPEC],
    ['documentation subdomain', 'https://docs.example.com/guide', SourceAuthorityTier.OFFICIAL_DOCS],
    ['developer subdomain', 'https://developer.example.com/reference', SourceAuthorityTier.OFFICIAL_DOCS],
    ['React documentation', 'https://react.dev/learn', SourceAuthorityTier.OFFICIAL_DOCS],
    ['Node documentation', 'https://nodejs.org/docs/latest/api/', SourceAuthorityTier.OFFICIAL_DOCS],
    ['TypeScript documentation', 'https://typescriptlang.org/docs/handbook/', SourceAuthorityTier.OFFICIAL_DOCS],
    ['research preprint', 'https://arxiv.org/abs/1234.5678', SourceAuthorityTier.REPUTABLE_RESEARCH],
    ['research DOI', 'https://doi.org/10.1000/example', SourceAuthorityTier.REPUTABLE_RESEARCH],
    ['ACM research', 'https://dl.acm.org/doi/10.1145/example', SourceAuthorityTier.REPUTABLE_RESEARCH],
    ['IEEE research', 'https://ieee.org/document/123', SourceAuthorityTier.REPUTABLE_RESEARCH],
    ['Stack Overflow answer', 'https://stackoverflow.com/questions/1', SourceAuthorityTier.ACCEPTED_DEV_QA],
    ['Stack Exchange answer', 'https://security.stackexchange.com/questions/1', SourceAuthorityTier.ACCEPTED_DEV_QA],
    ['GitHub source', 'https://github.com/openai/example', SourceAuthorityTier.CURATED_CODE],
    ['GitLab source', 'https://gitlab.com/example/project', SourceAuthorityTier.CURATED_CODE],
    ['Wikipedia article', 'https://wikipedia.org/wiki/Testing', SourceAuthorityTier.ENCYCLOPEDIA],
    ['Wikidata entry', 'https://wikidata.org/wiki/Q1', SourceAuthorityTier.ENCYCLOPEDIA],
    ['university source', 'https://cs.example.edu/course', SourceAuthorityTier.EDUCATIONAL_WEB],
    ['Khan Academy source', 'https://khanacademy.org/math', SourceAuthorityTier.EDUCATIONAL_WEB],
    ['MIT source', 'https://mit.edu/research', SourceAuthorityTier.EDUCATIONAL_WEB],
    ['unclassified web page', 'https://community.example.net/post', SourceAuthorityTier.GENERAL_WEB],
  ])('classifies %s without trusting its path as authority', (_label, uri, tier) => {
    expect(new SourceAuthorityPolicy().inferTierFromUri(uri)).toBe(tier);
  });

  it('uses bounded numeric overrides while retaining safe defaults for invalid tiers and values', () => {
    const policy = new SourceAuthorityPolicy({
      [SourceAuthorityTier.GENERAL_WEB]: 0.9,
      [SourceAuthorityTier.CURATED_CODE]: -0.1,
      [SourceAuthorityTier.OFFICIAL_SPEC]: 1.1,
      [SourceAuthorityTier.REPO_EVIDENCE]: '0.99' as unknown as number,
    });

    expect(policy.getAuthorityScore(SourceAuthorityTier.GENERAL_WEB)).toBe(0.9);
    expect(policy.getAuthorityScore(SourceAuthorityTier.CURATED_CODE)).toBe(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.CURATED_CODE]);
    expect(policy.getAuthorityScore(SourceAuthorityTier.OFFICIAL_SPEC)).toBe(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.OFFICIAL_SPEC]);
    expect(policy.getAuthorityScore(SourceAuthorityTier.REPO_EVIDENCE)).toBe(BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.REPO_EVIDENCE]);
    expect(policy.getAuthorityScore('unrecognized' as SourceAuthorityTier)).toBe(0.5);
    expect(policy.getAllWeights()).toEqual(expect.objectContaining({
      [SourceAuthorityTier.GENERAL_WEB]: 0.9,
      [SourceAuthorityTier.USER_CANONICAL]: BASE_AUTHORITY_WEIGHTS[SourceAuthorityTier.USER_CANONICAL],
    }));
  });
});
