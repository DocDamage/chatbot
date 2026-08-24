import { createHash } from 'crypto';
import { FindingSeverity, RepositoryFinding } from './RepositoryFindings';

interface SarifResult { ruleId?: string; level?: string; message?: { text?: string }; locations?: Array<{ physicalLocation?: { artifactLocation?: { uri?: string }; region?: { startLine?: number; endLine?: number } } }> }
interface SarifLog { version?: string; runs?: Array<{ tool?: { driver?: { name?: string } }; results?: SarifResult[] }> }

export function ingestSarif(input: string | SarifLog): RepositoryFinding[] {
  const log: SarifLog = typeof input === 'string' ? JSON.parse(input) : input;
  validateSarifDocument(log);
  return log.runs!.flatMap(run => (run.results || []).flatMap(result => {
    const location = result.locations?.[0]?.physicalLocation;
    const path = safePath(location?.artifactLocation?.uri);
    if (!path) return [];
    const line = Math.max(1, location?.region?.startLine || 1);
    const excerpt = result.message?.text || 'SARIF finding';
    const ruleId = result.ruleId || `${run.tool?.driver?.name || 'sarif'}-unknown`;
    const evidence = { path, lineStart: line, lineEnd: Math.max(line, location?.region?.endLine || line), excerpt, digest: hash(`${path}\0${line}\0${excerpt}`) };
    return [{ id: hash(`${ruleId}\0${evidence.digest}`), ruleId, severity: severity(result.level), disposition: 'signal' as const, title: ruleId, message: excerpt, confidence: 0.6, evidence: [evidence], source: 'sarif' as const }];
  })).sort((a, b) => a.id.localeCompare(b.id));
}
export function validateSarifDocument(log: SarifLog): void {
  if (log.version !== '2.1.0' || !Array.isArray(log.runs)) throw new Error('Only SARIF 2.1.0 documents with a runs array are supported.');
  for (const run of log.runs) if (run.results && !Array.isArray(run.results)) throw new Error('SARIF results must be an array.');
}
function severity(level?: string): FindingSeverity { return level === 'error' ? 'high' : level === 'warning' ? 'medium' : 'info'; }
function safePath(value?: string): string | undefined { if (!value || value.includes('\0') || /^([a-z]+:)?\/\//i.test(value) || value.startsWith('/') || value.includes('..')) return undefined; return value.replace(/\\/g, '/'); }
function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
