[ERROR] - (starship::print): Under a 'dumb' terminal (TERM=dumb).

import { createHash } from 'crypto';
import { ApprovedRepositoryGateway } from '../security/ApprovedRepositoryGateway';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingDisposition = 'signal' | 'suspected_weakness' | 'confirmed_defect' | 'accepted_risk';

export interface FindingEvidence { path: string; lineStart: number; lineEnd: number; excerpt: string; digest: string; }
export interface RepositoryFinding {
  id: string; ruleId: string; severity: FindingSeverity; disposition: FindingDisposition;
  title: string; message: string; confidence: number; evidence: FindingEvidence[];
  source: 'repository-rule' | 'sarif'; suppressed?: boolean; suppressionReason?: string;
}
export interface FindingOverlay { path: string; hotspot: number; ownership?: string; churn?: number; testGap: boolean; trustBoundary: boolean; findingIds: string[]; }

const RULES: Array<{ id: string; title: string; severity: FindingSeverity; disposition: FindingDisposition; expression: RegExp; message: string }> = [
  { id: 'CF03-HARDCODED-SECRET', title: 'Potential hard-coded secret', severity: 'high', disposition: 'suspected_weakness', expression: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"\s]{8,}/i, message: 'A secret-like literal should be moved to the configured secret boundary.' },
  { id: 'CF03-DANGEROUS-CAPABILITY', title: 'Dangerous execution capability', severity: 'high', disposition: 'signal', expression: /\b(?:eval|new\s+Function|child_process\.(?:exec|execFile))\s*\(/, message: 'Dynamic execution requires a narrowly approved capability and review.' },
  { id: 'CF03-ROUTE-POLICY', title: 'Route policy requires review', severity: 'medium', disposition: 'signal', expression: /\brouter\.(?:get|post|put|patch|delete)\s*\(/, message: 'Route policy evidence should be reviewed with authentication and authorization controls.' },
  { id: 'CF03-DEPENDENCY-LOCKFILE', title: 'Dependency lockfile is absent', severity: 'medium', disposition: 'suspected_weakness', expression: /^$/, message: 'A package manifest exists without a recognized lockfile.' }
];

export class RepositoryFindingsAnalyzer {
  constructor(private readonly gateway: ApprovedRepositoryGateway) {}

  analyze(options: { suppressions?: ReadonlyMap<string, string>; maxFiles?: number } = {}): { findings: RepositoryFinding[]; overlays: FindingOverlay[] } {
    const findings: RepositoryFinding[] = [];
    const files = this.gateway.listFiles('.', options.maxFiles ?? 3000);
    const hasManifest = files.includes('package.json');
    const hasLockfile = files.some(file => /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(file));
    if (hasManifest && !hasLockfile) findings.push(this.synthetic(RULES[3], 'package.json'));
    for (const file of files) {
      if (!/\.(?:[cm]?[jt]sx?|py|go|rs|java|cs|json|ya?ml)$/i.test(file)) continue;
      let content: string;
      try { content = this.gateway.readTextFile(file, 128 * 1024).content; } catch { continue; }
      const lines = content.split(/\r?\n/);
      for (const rule of RULES.slice(0, 3)) for (let index = 0; index < lines.length; index += 1) {
        rule.expression.lastIndex = 0;
        if (rule.expression.test(lines[index])) findings.push(this.create(rule, file, index + 1, lines[index]));
      }
    }
    const suppressed = findings.map(value => this.applySuppression(value, options.suppressions)).sort((left, right) => left.id.localeCompare(right.id));
    return { findings: suppressed, overlays: overlays(suppressed) };
  }

  private create(rule: typeof RULES[number], path: string, line: number, excerpt: string): RepositoryFinding {
    const evidence = { path, lineStart: line, lineEnd: line, excerpt: excerpt.slice(0, 500), digest: digest(`${path}\0${line}\0${excerpt}`) };
    return { id: digest(`${rule.id}\0${evidence.digest}`), ruleId: rule.id, severity: rule.severity, disposition: rule.disposition, title: rule.title, message: rule.message, confidence: 0.7, evidence: [evidence], source: 'repository-rule' };
  }
  private synthetic(rule: typeof RULES[number], path: string): RepositoryFinding { return this.create(rule, path, 1, 'package manifest has no recognized lockfile'); }
  private applySuppression(value: RepositoryFinding, suppressions?: ReadonlyMap<string, string>): RepositoryFinding {
    const reason = suppressions?.get(value.id);
    return reason ? { ...value, disposition: 'accepted_risk', suppressed: true, suppressionReason: reason } : value;
  }
}

function overlays(findings: RepositoryFinding[]): FindingOverlay[] {
  const groups = new Map<string, RepositoryFinding[]>();
  for (const finding of findings) for (const evidence of finding.evidence) groups.set(evidence.path, [...(groups.get(evidence.path) || []), finding]);
  return [...groups].map(([path, values]) => ({ path, hotspot: values.reduce((total, value) => total + ({ critical: 4, high: 3, medium: 2, low: 1, info: 0 }[value.severity]), 0), testGap: !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path), trustBoundary: values.some(value => value.ruleId.includes('DANGEROUS') || value.ruleId.includes('ROUTE')), findingIds: values.map(value => value.id).sort() })).sort((a, b) => b.hotspot - a.hotspot || a.path.localeCompare(b.path));
}
function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }

