import { canonicalJson, digestJson, isSha256, sha256, type JsonValue } from './proposal-integrity.js';

export type CheckKind = 'compile' | 'editor-inspection' | 'smoke' | 'behavior' | 'export';
export type EvidenceStatus = 'passed' | 'failed' | 'blocked' | 'missing' | 'stale' | 'invalid';
export interface EvidenceBinding {
  runId: string;
  proposalId: string;
  proposalDigest: string;
  projectId: string;
  projectSnapshotDigest: string;
  profileDigest: string;
  engine: string;
  engineVersion: string;
  adapterVersion: string;
  toolId: string;
  toolVersion: string;
  executablePath: string;
  executableSha256: string;
  invocationId: string;
  checkId: string;
  kind: CheckKind;
}
export interface AssertionRequirement {
  id: string;
  operator: 'equals' | 'at_least' | 'at_most' | 'exists' | 'near';
  /** Required for near; absolute error per scalar/vector component. */
  absoluteTolerance?: number;
  expected: JsonValue;
}
export interface ExpectedCheck {
  binding: EvidenceBinding;
  notBeforeMs: number;
  deadlineAtMs: number;
  assertions: readonly AssertionRequirement[];
  expectedArtifactPaths: readonly string[];
}
export interface ArtifactReceipt {
  relativePath: string;
  sha256: string;
  byteLength: number;
  createdAtMs: number;
  invocationId: string;
}
export interface InvocationEvidence {
  schemaVersion: 1;
  binding: EvidenceBinding;
  disposition: 'completed' | 'skipped' | 'unavailable' | 'cancelled' | 'timed_out';
  startedAtMs: number;
  finishedAtMs: number;
  exitCode: number | null;
  signal: string | null;
  /** Server collector transcript includes start/exit control records even for quiet tools. */
  logText: string;
  logSha256: string;
  reportText: string | null;
  reportSha256: string | null;
  /** Collected and hashed from actual files by the trusted runner, not copied from model text. */
  artifacts: readonly ArtifactReceipt[];
}
export interface EngineReport {
  schemaVersion: 1;
  binding: EvidenceBinding;
  completed: true;
  assertions: readonly { id: string; status: 'observed' | 'failed' | 'skipped'; actual: JsonValue }[];
  diagnostics: readonly { severity: 'error' | 'warning' | 'info'; code: string; message: string }[];
}
export interface CheckEvaluation {
  checkId: string;
  kind: CheckKind;
  status: EvidenceStatus;
  reasons: readonly string[];
  evidenceDigest?: string;
  failureFingerprint: string;
}
export interface SuiteEvaluation {
  status: EvidenceStatus;
  checks: readonly CheckEvaluation[];
  issues: readonly string[];
  passedCheckIds: readonly string[];
  evidenceDigest: string;
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const time = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const kindSet = new Set(['compile', 'editor-inspection', 'smoke', 'behavior', 'export']);
const bindingKeys = ['runId', 'proposalId', 'proposalDigest', 'projectId', 'projectSnapshotDigest', 'profileDigest',
  'engine', 'engineVersion', 'adapterVersion', 'toolId', 'toolVersion', 'executablePath', 'executableSha256',
  'invocationId', 'checkId', 'kind'];

function validBinding(value: unknown): value is EvidenceBinding {
  return record(value) && Object.keys(value).length === bindingKeys.length && bindingKeys.every(key => text(value[key]))
    && ['proposalDigest', 'projectSnapshotDigest', 'profileDigest', 'executableSha256'].every(key => isSha256(value[key]))
    && kindSet.has(String(value.kind));
}

function expectedIssues(expected: ExpectedCheck): string[] {
  const issues: string[] = [];
  if (!validBinding(expected.binding)) issues.push('Verification plan has an invalid identity binding.');
  if (!time(expected.notBeforeMs) || !time(expected.deadlineAtMs) || expected.deadlineAtMs <= expected.notBeforeMs) {
    issues.push('Verification plan has an invalid execution window.');
  }
  if (!expected.assertions.length || new Set(expected.assertions.map(assertion => assertion.id)).size !== expected.assertions.length) {
    issues.push('Verification requires a nonempty, unique assertion set.');
  }
  for (const assertion of expected.assertions) {
    if (!text(assertion.id) || !['equals', 'at_least', 'at_most', 'exists', 'near'].includes(assertion.operator)) {
      issues.push('Verification plan has an invalid assertion.');
    }
    try { canonicalJson(assertion.expected); } catch { issues.push('Expected assertion value is not JSON.'); }
    if (assertion.operator === 'exists' && assertion.expected !== true) issues.push('Existence checks require expected true and a boolean presence observation.');
    if (assertion.operator === 'near' && (!finiteShape(assertion.expected) || typeof assertion.absoluteTolerance !== 'number' || !Number.isFinite(assertion.absoluteTolerance) || assertion.absoluteTolerance < 0)) issues.push('Near checks require a finite scalar/vector and an explicit nonnegative absolute tolerance.');
    if (assertion.operator !== 'near' && assertion.absoluteTolerance !== undefined) issues.push('Tolerance is valid only for near checks.');
    if (['at_least', 'at_most'].includes(assertion.operator)
        && (typeof assertion.expected !== 'number' || !Number.isFinite(assertion.expected))) issues.push('Numeric assertion has a nonnumeric threshold.');
  }
  if (new Set(expected.expectedArtifactPaths).size !== expected.expectedArtifactPaths.length
      || expected.expectedArtifactPaths.some(path => !safeRelativePath(path))) issues.push('Invalid expected artifact paths.');
  if (expected.binding.kind === 'export' && !expected.expectedArtifactPaths.length) issues.push('Export verification requires an explicit output manifest.');
  return issues;
}

function safeRelativePath(path: string): boolean {
  return text(path) && !path.startsWith('/') && !/[\\:\u0000-\u001f]/.test(path)
    && path.split('/').every(part => part.length > 0 && part !== '.' && part !== '..');
}

function aggregate(statuses: readonly EvidenceStatus[]): EvidenceStatus {
  for (const status of ['failed', 'invalid', 'stale', 'blocked', 'missing'] as const) {
    if (statuses.includes(status)) return status;
  }
  return statuses.length > 0 ? 'passed' : 'invalid';
}

function finiteShape(value: JsonValue): boolean {
  return typeof value === 'number' ? Number.isFinite(value)
    : Array.isArray(value) && value.length > 0 && value.length <= 16 && value.every(item => typeof item === 'number' && Number.isFinite(item));
}

function nearValue(actual: JsonValue, expected: JsonValue, tolerance: number): boolean {
  if (!finiteShape(actual) || !finiteShape(expected)) return false;
  if (typeof actual === 'number' && typeof expected === 'number') return Math.abs(actual - expected) <= tolerance;
  return Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length
    && actual.every((value, index) => Math.abs((value as number) - (expected[index] as number)) <= tolerance);
}

function observedMatches(requirement: AssertionRequirement, actual: JsonValue): boolean {
  switch (requirement.operator) {
    case 'equals': return canonicalJson(actual) === canonicalJson(requirement.expected);
    case 'at_least': return typeof actual === 'number' && Number.isFinite(actual) && actual >= (requirement.expected as number);
    case 'at_most': return typeof actual === 'number' && Number.isFinite(actual) && actual <= (requirement.expected as number);
    case 'exists': return actual === true;
    case 'near': return nearValue(actual, requirement.expected, requirement.absoluteTolerance!);
  }
}

/**
 * Evaluate authenticated runner records. Hashes bind content; they do not establish
 * who produced it. Only the trusted runner/store may supply these records.
 * EngineReport assertion values are compared against the server's original plan;
 * a model- or tool-supplied "passed: true" is never accepted as a verdict.
 */
export function evaluateCheck(expected: ExpectedCheck, evidence: unknown, nowMs: number): CheckEvaluation {
  let evidenceDigest: string | undefined;
  const finish = (status: EvidenceStatus, reasons: string[]): CheckEvaluation => ({
    checkId: expected.binding.checkId, kind: expected.binding.kind, status, reasons,
    ...(evidenceDigest ? { evidenceDigest } : {}),
    failureFingerprint: digestJson({ checkId: expected.binding.checkId, kind: expected.binding.kind, status, reasons }),
  });
  const planningIssues = expectedIssues(expected);
  if (planningIssues.length || !time(nowMs)) return finish('invalid', [...planningIssues, ...(!time(nowMs) ? ['Invalid evaluator time.'] : [])]);
  if (evidence === undefined || evidence === null) return finish('missing', ['No invocation evidence was recorded.']);
  if (!record(evidence)) return finish('invalid', ['Invocation evidence must be an object.']);
  if (evidence.schemaVersion !== 1 || !validBinding(evidence.binding)) return finish('invalid', ['Malformed invocation envelope or binding.']);
  if (canonicalJson(evidence.binding) !== canonicalJson(expected.binding)) return finish('stale', ['Evidence belongs to a different run, proposal, tool, profile, executable, or check.']);
  // Only current, correctly bound process failures can drive this proposal's repair.
  // Failure cannot be masked by a successful report, missing logs, or skipped assertions.
  if (typeof evidence.exitCode === 'number' && Number.isInteger(evidence.exitCode) && evidence.exitCode !== 0) {
    return finish('failed', [`Process exited with nonzero code ${evidence.exitCode}.`]);
  }
  if (evidence.signal !== null && text(evidence.signal)) return finish('failed', [`Process ended with signal ${evidence.signal}.`]);
  if (['skipped', 'unavailable', 'cancelled', 'timed_out'].includes(String(evidence.disposition))) {
    return finish('blocked', [`Invocation was ${evidence.disposition}.`]);
  }
  if (evidence.disposition !== 'completed') return finish('invalid', ['Unknown invocation disposition.']);
  if (evidence.exitCode !== 0 || evidence.signal !== null) return finish('missing', ['A completed zero exit and no termination signal must be recorded.']);
  if (!time(evidence.startedAtMs) || !time(evidence.finishedAtMs) || evidence.finishedAtMs < evidence.startedAtMs) {
    return finish('invalid', ['Malformed execution timestamps.']);
  }
  if (evidence.startedAtMs < expected.notBeforeMs || evidence.finishedAtMs > expected.deadlineAtMs || evidence.finishedAtMs > nowMs) {
    return finish('stale', ['Evidence falls outside the current invocation time window.']);
  }
  if (!text(evidence.logText)) return finish('missing', ['The invocation transcript is missing or empty.']);
  if (Buffer.byteLength(evidence.logText, 'utf8') > 2_000_000 || !isSha256(evidence.logSha256)
      || sha256(evidence.logText) !== evidence.logSha256) return finish('invalid', ['Transcript exceeds its bound or fails its content hash.']);
  if (!text(evidence.reportText)) return finish('missing', ['The structured engine report is missing.']);
  if (Buffer.byteLength(evidence.reportText, 'utf8') > 1_000_000 || !isSha256(evidence.reportSha256)
      || sha256(evidence.reportText) !== evidence.reportSha256) return finish('invalid', ['Report exceeds its bound or fails its content hash.']);
  let report: unknown;
  try { report = JSON.parse(evidence.reportText); } catch { return finish('invalid', ['The structured engine report is malformed JSON.']); }
  if (!record(report) || report.schemaVersion !== 1 || report.completed !== true || !validBinding(report.binding)
      || !Array.isArray(report.assertions) || !Array.isArray(report.diagnostics)) {
    return finish('invalid', ['Malformed or incomplete structured engine report.']);
  }
  if (canonicalJson(report.binding) !== canonicalJson(expected.binding)) return finish('stale', ['The structured report binding is stale or mismatched.']);
  const statuses: EvidenceStatus[] = [];
  const reasons: string[] = [];
  for (const diagnostic of report.diagnostics) {
    if (!record(diagnostic) || !['error', 'warning', 'info'].includes(String(diagnostic.severity))
        || !text(diagnostic.code) || !text(diagnostic.message)) {
      statuses.push('invalid'); reasons.push('Malformed diagnostic record.');
    } else if (diagnostic.severity === 'error') {
      statuses.push('failed'); reasons.push(`Engine diagnostic ${diagnostic.code}: ${diagnostic.message}`);
    }
  }
  const observed = new Map<string, Record<string, unknown>>();
  for (const assertion of report.assertions) {
    if (!record(assertion) || !text(assertion.id) || !['observed', 'failed', 'skipped'].includes(String(assertion.status))
        || !Object.hasOwn(assertion, 'actual')) {
      statuses.push('invalid'); reasons.push('Malformed assertion record.'); continue;
    }
    if (observed.has(assertion.id) || !expected.assertions.some(required => required.id === assertion.id)) {
      statuses.push('invalid'); reasons.push(`Unexpected or duplicate assertion: ${assertion.id}.`); continue;
    }
    observed.set(assertion.id, assertion);
  }
  for (const requirement of expected.assertions) {
    const assertion = observed.get(requirement.id);
    if (!assertion) { statuses.push('missing'); reasons.push(`Missing assertion: ${requirement.id}.`); continue; }
    if (assertion.status === 'skipped') { statuses.push('blocked'); reasons.push(`Skipped assertion: ${requirement.id}.`); continue; }
    if (assertion.status === 'failed') { statuses.push('failed'); reasons.push(`Failed assertion: ${requirement.id}.`); continue; }
    try {
      canonicalJson(assertion.actual);
      const passed = observedMatches(requirement, assertion.actual as JsonValue);
      statuses.push(passed ? 'passed' : 'failed');
      if (!passed) reasons.push(`Observed value does not satisfy assertion: ${requirement.id}.`);
    } catch {
      statuses.push('invalid'); reasons.push(`Assertion value is not canonical JSON: ${requirement.id}.`);
    }
  }
  if (!Array.isArray(evidence.artifacts)) { statuses.push('invalid'); reasons.push('Artifact receipt list is missing.'); }
  else {
    const artifacts = new Map<string, Record<string, unknown>>();
    for (const artifact of evidence.artifacts) {
      if (!record(artifact) || !text(artifact.relativePath) || !safeRelativePath(artifact.relativePath)
          || !isSha256(artifact.sha256) || !Number.isSafeInteger(artifact.byteLength) || Number(artifact.byteLength) <= 0
          || !time(artifact.createdAtMs) || artifact.invocationId !== expected.binding.invocationId) {
        statuses.push('invalid'); reasons.push('Malformed or foreign artifact receipt.'); continue;
      }
      if (artifact.createdAtMs < evidence.startedAtMs || artifact.createdAtMs > evidence.finishedAtMs) {
        statuses.push('stale'); reasons.push(`Stale output artifact: ${artifact.relativePath}.`);
      }
      if (artifacts.has(artifact.relativePath) || !expected.expectedArtifactPaths.includes(artifact.relativePath)) {
        statuses.push('invalid'); reasons.push(`Unexpected or duplicate output artifact: ${artifact.relativePath}.`);
      }
      artifacts.set(artifact.relativePath, artifact);
    }
    for (const file of expected.expectedArtifactPaths) {
      if (!artifacts.has(file)) { statuses.push('missing'); reasons.push(`Missing required output artifact: ${file}.`); }
    }
  }
  try { evidenceDigest = digestJson(evidence); } catch { statuses.push('invalid'); reasons.push('Invocation evidence is not canonical JSON.'); }
  return finish(aggregate(statuses), reasons);
}

/** All planned levels remain separate; compile evidence cannot satisfy a behavior check. */
export function evaluateSuite(expected: readonly ExpectedCheck[], observations: readonly unknown[], nowMs: number): SuiteEvaluation {
  const issues: string[] = [];
  if (!expected.length) issues.push('The verification plan is empty.');
  if (new Set(expected.map(check => check.binding.checkId)).size !== expected.length
      || new Set(expected.map(check => check.binding.invocationId)).size !== expected.length) issues.push('Duplicate planned checks or invocation identifiers.');
  const first = expected[0]?.binding;
  const sameScopeKeys = ['runId', 'proposalId', 'proposalDigest', 'projectId', 'projectSnapshotDigest', 'profileDigest'] as const;
  if (first && expected.some(check => sameScopeKeys.some(key => check.binding[key] !== first[key]))) issues.push('Verification plan mixes project or proposal snapshots.');
  const grouped = new Map<string, unknown[]>();
  for (const observation of observations) {
    const binding = record(observation) && record(observation.binding) ? observation.binding : undefined;
    const match = binding && expected.find(check => check.binding.checkId === binding.checkId && check.binding.invocationId === binding.invocationId);
    if (!match) { issues.push('Unplanned or uncorrelated invocation evidence was supplied.'); continue; }
    const existing = grouped.get(match.binding.checkId) || [];
    existing.push(observation); grouped.set(match.binding.checkId, existing);
  }
  const checks = expected.map(check => {
    const matches = grouped.get(check.binding.checkId) || [];
    if (matches.length > 1) {
      const reasons = ['Duplicate invocation evidence; a unique final record is required.'];
      return { checkId: check.binding.checkId, kind: check.binding.kind, status: 'invalid' as const, reasons,
        failureFingerprint: digestJson({ checkId: check.binding.checkId, reasons }) };
    }
    return evaluateCheck(check, matches[0], nowMs);
  });
  const status = aggregate([...checks.map(check => check.status), ...(issues.length ? ['invalid' as const] : [])]);
  return { status, checks, issues, passedCheckIds: checks.filter(check => check.status === 'passed').map(check => check.checkId),
    evidenceDigest: digestJson({ checks, issues }) };
}
