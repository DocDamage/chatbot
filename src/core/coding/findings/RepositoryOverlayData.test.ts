import { buildRepositoryOverlayData } from './RepositoryOverlayData';
import { RepositoryFinding } from './RepositoryFindings';

describe('repository overlay data', () => {
  it('joins ownership, churn, test coverage, and trust-boundary signals deterministically', () => {
    const findings: RepositoryFinding[] = [{ id: 'f1', ruleId: 'CF03-ROUTE-POLICY', severity: 'medium', disposition: 'signal', title: 'route', message: 'review', confidence: 0.7, source: 'repository-rule', evidence: [{ path: 'src/routes.ts', lineStart: 4, lineEnd: 4, excerpt: 'router.get()', digest: 'a' }] }];
    const overlays = buildRepositoryOverlayData(findings, { ownership: new Map([['src/routes.ts', 'platform']]), churn: new Map([['src/routes.ts', 12]]), testedPaths: new Set(['src/routes.ts']), trustBoundaries: new Set(['src/routes.ts']) });
    expect(overlays).toEqual([expect.objectContaining({ path: 'src/routes.ts', ownership: 'platform', churn: 12, testGap: false, trustBoundary: true, hotspot: 2 })]);
  });
});

