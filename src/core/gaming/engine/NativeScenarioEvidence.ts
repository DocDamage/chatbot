import crypto from 'node:crypto';
import path from 'node:path';
import { canonicalJson, digestJson } from './CanonicalJson';
import { EngineAssertion, EngineAssertionReport, EngineType, GameEngineError } from './GameEngineTypes';

export interface ScenarioBinding {
  runId: string;
  requestDigest: string;
  engine: EngineType;
  projectRoot: string;
  scenePath: string;
}

export function scenarioRequestDigest(binding: Omit<ScenarioBinding, 'requestDigest'>, assertions: EngineAssertion[], scopeDigest?: string): string {
  if (scopeDigest !== undefined && !/^[0-9a-f]{64}$/.test(scopeDigest)) throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'Invalid server runtime scope digest.');
  return digestJson('native-scenario:v1', { ...binding, assertions, ...(scopeDigest ? { scopeDigest } : {}) });
}

export function scenarioBinding(engine: EngineType, projectRoot: string, scenePath: string, assertions: EngineAssertion[], scopeDigest?: string): ScenarioBinding {
  const runId = crypto.randomUUID();
  const binding = { runId, engine, projectRoot: path.resolve(projectRoot), scenePath };
  return { ...binding, requestDigest: scenarioRequestDigest(binding, assertions, scopeDigest) };
}

export function validateAssertions(assertions: EngineAssertion[]): void {
  if (!Array.isArray(assertions)) throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'Assertions must be an array.');
  for (const assertion of assertions) {
    if (!assertion || typeof assertion.type !== 'string' || typeof assertion.target !== 'string' ||
      !Object.hasOwn(assertion, 'expected') || (assertion.type === 'property_equals' && typeof assertion.property !== 'string')) {
      throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'Malformed runtime assertion.');
    }
    canonicalJson(assertion.expected);
  }
}

function compare(assertion: EngineAssertion, actual: unknown): boolean {
  switch (assertion.type) {
    case 'node_exists': return typeof actual === 'boolean' && typeof assertion.expected === 'boolean' && actual === assertion.expected;
    case 'property_equals': return canonicalJson(actual) === canonicalJson(assertion.expected);
    case 'screen_text': return typeof actual === 'string' && typeof assertion.expected === 'string' && actual.includes(assertion.expected);
    case 'fps_above': return typeof actual === 'number' && Number.isFinite(actual) && typeof assertion.expected === 'number' && actual > assertion.expected;
    default: return false;
  }
}

/** Last boundary for injected engine backends as well as native providers. */
export function checkedScenarioReport(report: EngineAssertionReport, requested: EngineAssertion[]): EngineAssertionReport {
  validateAssertions(requested);
  if (!report || !Array.isArray(report.assertions)) throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'Runtime backend produced no assertion report.');
  const complete = requested.length > 0 && report.assertions.length === requested.length;
  const assertions = requested.map((expected, index) => {
    const observed = report.assertions[index];
    let passed = false;
    try {
      passed = !!observed && observed.type === expected.type && observed.target === expected.target && observed.property === expected.property &&
        canonicalJson(observed.expected) === canonicalJson(expected.expected) && observed.passed === true && compare(expected, observed.actual);
    } catch { /* Missing or malformed observations cannot pass. */ }
    return { ...expected, actual: observed?.actual, passed: complete && passed };
  });
  return { ...report, assertions, passed: report.passed === true && !report.error && complete && assertions.every(assertion => assertion.passed) };
}

/** Reject incomplete/replayed/foreign reports and compare observations with the host's unchanged expectations. */
export function evaluateScenarioPayload(payload: unknown, binding: ScenarioBinding, requested: EngineAssertion[]): EngineAssertion[] {
  if (!payload || typeof payload !== 'object') throw new Error('Native scenario produced no valid report.');
  const report = payload as Record<string, unknown>;
  if (report.mode !== 'scenario') throw new Error('Native report is not a scenario result.');
  if (report.error != null && typeof report.error !== 'string') throw new Error('Malformed native scenario error.');
  if (canonicalJson(report.evidence) !== canonicalJson({
    runId: binding.runId, requestDigest: binding.requestDigest, engine: binding.engine,
    projectRoot: binding.projectRoot, scenePath: binding.scenePath
  })) throw new Error('Native scenario evidence is stale or belongs to another request/project.');
  if (!requested.length || !Array.isArray(report.assertions) || report.assertions.length !== requested.length) {
    throw new Error('Native scenario requires a nonempty, complete assertion report.');
  }
  return requested.map((assertion, index) => {
    const observation = (report.assertions as unknown[])[index];
    if (!observation || typeof observation !== 'object') throw new Error('Malformed native assertion observation.');
    const item = observation as Record<string, unknown>;
    if (item.assertionId !== index || typeof item.passed !== 'boolean') throw new Error('Missing or reordered native assertion identity.');
    if (Object.hasOwn(item, 'actualJson') && typeof item.actualJson !== 'string') throw new Error('Malformed actualJson.');
    const actual = Object.hasOwn(item, 'actualJson') ? JSON.parse(item.actualJson as string) as unknown : item.actual;
    canonicalJson(actual);
    return { ...assertion, actual, passed: !report.error && item.passed === true && compare(assertion, actual) };
  });
}
