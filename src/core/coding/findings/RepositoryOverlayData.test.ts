import { buildRepositoryOverlayData } from './RepositoryOverlayData';
import { RepositoryFinding } from './RepositoryFindings';

describe('repository overlay data', () => {
  it('joins ownership, churn, test coverage, and trust-boundary signals deterministically', () => {
    const findings: RepositoryFinding[] = [{ id: 'f1', ruleId: 'CF03-ROUTE-POLICY', severity: 'medium', disposition: 'signal', title: 'route', message: 'review', confidence: 0.7, source: 'repository-rule', evidence: [{ path: 'src/routes.ts', lineStart: 4, lineEnd: 4, excerpt: 'router.get()', digest: 'a' }] }];
    const overlays = buildRepositoryOverlayData(findings, { ownership: new Map([['src/routes.ts', 'platform']]), churn: new Map([['src/routes.ts', 12]]), testedPaths: new Set(['src/routes.ts']), trustBoundaries: new Set(['src/routes.ts']) });
    expect(overlays).toEqual([expect.objectContaining({ path: 'src/routes.ts', ownership: 'platform', churn: 12, testGap: false, trustBoundary: true, hotspot: 2 })]);
  });
  it('reports test gaps and leaves absent optional metrics undefined', () => {
    const findings: RepositoryFinding[] = [{ id: 'f2', ruleId: 'CF03-HARDCODED-SECRET', severity: 'high', disposition: 'suspected_weakness', title: 'secret', message: 'review', confidence: 0.7, source: 'repository-rule', evidence: [{ path: 'src/config.ts', lineStart: 1, lineEnd: 1, excerpt: '', digest: 'b' }] }];
    expect(buildRepositoryOverlayData(findings)).toEqual([expect.objectContaining({ hotspot: 3, testGap: true, trustBoundary: false, ownership: undefined, churn: undefined })]);
  });
  it('sorts overlays by severity and recognizes test-file paths', () => {
    const findings: RepositoryFinding[] = [
      { id: 'low', ruleId: 'a', severity: 'low', disposition: 'signal', title: 'low', message: '', confidence: 0.5, source: 'repository-rule', evidence: [{ path: 'a.ts', lineStart: 1, lineEnd: 1, excerpt: '', digest: 'a' }] },
      { id: 'high', ruleId: 'b', severity: 'high', disposition: 'signal', title: 'high', message: '', confidence: 0.5, source: 'repository-rule', evidence: [{ path: 'b.test.ts', lineStart: 1, lineEnd: 1, excerpt: '', digest: 'b' }] }
    ];
    expect(buildRepositoryOverlayData(findings).map(value => [value.path, value.testGap])).toEqual([['b.test.ts', false], ['a.ts', true]]);
  });
  it('handles empty explicit metric collections and an empty findings set', () => {
    const finding: RepositoryFinding = { id: 'f3', ruleId: 'plain', severity: 'info', disposition: 'signal', title: 'info', message: '', confidence: 0.5, source: 'repository-rule', evidence: [{ path: 'plain.ts', lineStart: 1, lineEnd: 1, excerpt: '', digest: 'c' }] };
    expect(buildRepositoryOverlayData([finding], { ownership: new Map(), churn: new Map(), testedPaths: new Set(), trustBoundaries: new Set() })).toEqual([expect.objectContaining({ ownership: undefined, churn: undefined, testGap: true, trustBoundary: false, hotspot: 0 })]);
    expect(buildRepositoryOverlayData([])).toEqual([]);
  });
  it('derives a trust boundary from a route finding when explicit metrics do not flag it', () => {
    const finding: RepositoryFinding = { id: 'f4', ruleId: 'CF03-ROUTE-POLICY', severity: 'medium', disposition: 'signal', title: 'route', message: '', confidence: 0.5, source: 'repository-rule', evidence: [{ path: 'route.ts', lineStart: 1, lineEnd: 1, excerpt: '', digest: 'd' }] };
    expect(buildRepositoryOverlayData([finding], { trustBoundaries: new Set() })[0].trustBoundary).toBe(true);
  });
  it('uses path order as the deterministic hotspot tie-breaker', () => {
    const finding = (id: string, path: string): RepositoryFinding => ({ id, ruleId: 'plain', severity: 'low', disposition: 'signal', title: 'low', message: '', confidence: 0.5, source: 'repository-rule', evidence: [{ path, lineStart: 1, lineEnd: 1, excerpt: '', digest: id }] });
    expect(buildRepositoryOverlayData([finding('b', 'b.ts'), finding('a', 'a.ts')]).map(value => value.path)).toEqual(['a.ts', 'b.ts']);
  });
});

