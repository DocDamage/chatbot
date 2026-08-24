import { FindingOverlay, RepositoryFinding } from './RepositoryFindings';

export interface RepositoryOverlayMetrics { ownership?: ReadonlyMap<string, string>; churn?: ReadonlyMap<string, number>; testedPaths?: ReadonlySet<string>; trustBoundaries?: ReadonlySet<string>; }

/** Produces an accessible, deterministic table model; rendering is deliberately UI-neutral. */
export function buildRepositoryOverlayData(findings: RepositoryFinding[], metrics: RepositoryOverlayMetrics = {}): FindingOverlay[] {
  const groups = new Map<string, RepositoryFinding[]>();
  for (const finding of findings) for (const evidence of finding.evidence) groups.set(evidence.path, [...(groups.get(evidence.path) || []), finding]);
  return [...groups].map(([path, values]) => ({
    path,
    hotspot: values.reduce((total, value) => total + ({ critical: 4, high: 3, medium: 2, low: 1, info: 0 }[value.severity]), 0),
    ownership: metrics.ownership?.get(path), churn: metrics.churn?.get(path),
    testGap: !(metrics.testedPaths?.has(path) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)),
    trustBoundary: Boolean(metrics.trustBoundaries?.has(path)) || values.some(value => value.ruleId.includes('DANGEROUS') || value.ruleId.includes('ROUTE')),
    findingIds: values.map(value => value.id).sort()
  })).sort((left, right) => right.hotspot - left.hotspot || left.path.localeCompare(right.path));
}
