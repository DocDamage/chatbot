import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCheck, evaluateSuite, type CheckKind, type EngineReport, type ExpectedCheck, type InvocationEvidence } from '../../src/engine/verification-evidence.js';
import { sha256 } from '../../src/engine/proposal-integrity.js';

function fixture(kind: CheckKind = 'compile'): { expected: ExpectedCheck; evidence: InvocationEvidence } {
  const binding = { runId: 'run', proposalId: 'proposal', proposalDigest: sha256('proposal'), projectId: 'project',
    projectSnapshotDigest: sha256('snapshot'), profileDigest: sha256('profile'), engine: 'godot', engineVersion: '4.7.1',
    adapterVersion: '2', toolId: 'headless-probe', toolVersion: '2', executablePath: '/tools/godot', executableSha256: sha256('exe'),
    invocationId: `invocation-${kind}`, checkId: kind, kind };
  const expected: ExpectedCheck = { binding, notBeforeMs: 100, deadlineAtMs: 500,
    assertions: [{ id: 'result', operator: 'equals', expected: true }],
    expectedArtifactPaths: kind === 'export' ? ['builds/game.exe'] : [] };
  const report: EngineReport = { schemaVersion: 1, binding, completed: true,
    assertions: [{ id: 'result', status: 'observed', actual: true }], diagnostics: [] };
  const reportText = JSON.stringify(report);
  const logText = `Invocation ${binding.invocationId} started; probe completed; exit=0.`;
  const evidence: InvocationEvidence = { schemaVersion: 1, binding, disposition: 'completed', startedAtMs: 120, finishedAtMs: 180,
    exitCode: 0, signal: null, logText, logSha256: sha256(logText), reportText, reportSha256: sha256(reportText),
    artifacts: kind === 'export' ? [{ relativePath: 'builds/game.exe', sha256: sha256('bytes'), byteLength: 20,
      createdAtMs: 170, invocationId: binding.invocationId }] : [] };
  return { expected, evidence };
}
function replaceReport(evidence: InvocationEvidence, change: (report: Record<string, unknown>) => void): InvocationEvidence {
  const report = JSON.parse(evidence.reportText!) as Record<string, unknown>; change(report);
  const reportText = JSON.stringify(report);
  return { ...evidence, reportText, reportSha256: sha256(reportText) };
}

test('separate compile, smoke, behavior and export checks accept complete current evidence', () => {
  const fixtures = (['compile', 'smoke', 'behavior', 'export'] as const).map(fixture);
  const suite = evaluateSuite(fixtures.map(item => item.expected), fixtures.map(item => item.evidence), 200);
  assert.equal(suite.status, 'passed');
  assert.deepEqual(suite.passedCheckIds, ['compile', 'smoke', 'behavior', 'export']);
  assert.match(suite.evidenceDigest, /^[a-f0-9]{64}$/);
});

test('existence means an explicit true presence observation', () => {
  const { expected, evidence } = fixture('behavior');
  const presence: ExpectedCheck = { ...expected, assertions: [{ id: 'result', operator: 'exists', expected: true }] };
  assert.equal(evaluateCheck(presence, evidence, 200).status, 'passed');
  for (const actual of [false, 0, '', null]) {
    const changed = replaceReport(evidence, report => { report.assertions = [{ id: 'result', status: 'observed', actual }]; });
    assert.equal(evaluateCheck(presence, changed, 200).status, 'failed');
  }
  assert.equal(evaluateCheck({ ...presence, assertions: [{ id: 'result', operator: 'exists', expected: false }] }, evidence, 200).status, 'invalid');
});

test('vector and scalar tolerances are explicit and evaluated by the host', () => {
  const { expected, evidence } = fixture('behavior');
  const near: ExpectedCheck = { ...expected, assertions: [{ id: 'result', operator: 'near', expected: [10, 20], absoluteTolerance: 0.1 }] };
  const observation = (actual: unknown) => replaceReport(evidence, report => { report.assertions = [{ id: 'result', status: 'observed', actual }]; });
  assert.equal(evaluateCheck(near, observation([10.05, 19.95]), 200).status, 'passed');
  assert.equal(evaluateCheck(near, observation([10, 21]), 200).status, 'failed');
  assert.equal(evaluateCheck(near, observation([10, 20, 0]), 200).status, 'failed');
  assert.equal(evaluateCheck({ ...near, assertions: [{ id: 'result', operator: 'near', expected: 10 }] }, observation(10), 200).status, 'invalid');
  assert.equal(evaluateCheck({ ...near, assertions: [{ id: 'result', operator: 'near', expected: 10, absoluteTolerance: -1 }] }, observation(10), 200).status, 'invalid');
});

test('editor inspection evidence cannot satisfy a gameplay check', () => {
  const { expected, evidence } = fixture('editor-inspection');
  assert.equal(evaluateCheck(expected, evidence, 200).status, 'passed');
  assert.equal(evaluateCheck({ ...expected, binding: { ...expected.binding, kind: 'behavior' } }, evidence, 200).status, 'stale');
});

test('nonzero process exit dominates a happy report, missing logs and malformed JSON', () => {
  const { expected, evidence } = fixture();
  for (const bad of [{ ...evidence, exitCode: 1 }, { ...evidence, exitCode: 2, logText: '', reportText: '{' },
    { ...evidence, exitCode: 3, disposition: 'skipped' }, { ...evidence, signal: 'SIGKILL' }]) {
    assert.equal(evaluateCheck(expected, bad, 200).status, 'failed');
  }
});

test('absent, skipped and malformed execution records never become success', () => {
  const { expected, evidence } = fixture();
  assert.equal(evaluateCheck(expected, undefined, 200).status, 'missing');
  assert.equal(evaluateCheck(expected, { ...evidence, logText: '' }, 200).status, 'missing');
  assert.equal(evaluateCheck(expected, { ...evidence, logSha256: sha256('different') }, 200).status, 'invalid');
  assert.equal(evaluateCheck(expected, { ...evidence, reportText: null }, 200).status, 'missing');
  assert.equal(evaluateCheck(expected, { ...evidence, reportText: '{', reportSha256: sha256('{') }, 200).status, 'invalid');
  assert.equal(evaluateCheck(expected, { ...evidence, disposition: 'skipped' }, 200).status, 'blocked');
  assert.equal(evaluateCheck(expected, { ...evidence, exitCode: null }, 200).status, 'missing');
});

test('evidence cannot be reused across runs, versions, tools, binaries, checks or snapshots', () => {
  const { expected, evidence } = fixture();
  for (const [key, value] of [['runId', 'other'], ['proposalDigest', sha256('other')], ['projectSnapshotDigest', sha256('other')],
    ['engineVersion', 'other'], ['toolVersion', 'other'], ['executableSha256', sha256('other')], ['kind', 'behavior']]) {
    assert.equal(evaluateCheck(expected, { ...evidence, binding: { ...evidence.binding, [key]: value } }, 200).status, 'stale');
  }
  const oldPayload = replaceReport(evidence, report => { report.binding = { ...evidence.binding, invocationId: 'prior-run' }; });
  assert.equal(evaluateCheck(expected, oldPayload, 200).status, 'stale');
  assert.equal(evaluateCheck(expected, { ...evidence, startedAtMs: 10 }, 200).status, 'stale');
  assert.equal(evaluateCheck(expected, { ...evidence, finishedAtMs: 300 }, 200).status, 'stale');
});

test('missing/skipped/duplicated assertions and self-reported passed flags fail closed', () => {
  const { expected, evidence } = fixture('behavior');
  assert.equal(evaluateCheck(expected, replaceReport(evidence, report => { report.assertions = []; }), 200).status, 'missing');
  assert.equal(evaluateCheck(expected, replaceReport(evidence, report => { report.assertions = [{ id: 'result', status: 'skipped', actual: true }]; }), 200).status, 'blocked');
  assert.equal(evaluateCheck(expected, replaceReport(evidence, report => { report.assertions = [{ id: 'result', status: 'observed', actual: false, passed: true }]; }), 200).status, 'failed');
  assert.equal(evaluateCheck(expected, replaceReport(evidence, report => { report.assertions = [
    { id: 'result', status: 'observed', actual: true }, { id: 'result', status: 'observed', actual: true }]; }), 200).status, 'invalid');
  assert.equal(evaluateCheck({ ...expected, assertions: [] }, evidence, 200).status, 'invalid');
});

test('numeric observations are evaluated against trusted thresholds, and error diagnostics dominate', () => {
  const { expected, evidence } = fixture('behavior');
  const numeric = { ...expected, assertions: [{ id: 'result', operator: 'at_least' as const, expected: 60 }] };
  const result = replaceReport(evidence, report => { report.assertions = [{ id: 'result', status: 'observed', actual: 59 }]; });
  assert.equal(evaluateCheck(numeric, result, 200).status, 'failed');
  const errors = replaceReport(evidence, report => { report.diagnostics = [{ severity: 'error', code: 'PARSE_ERROR', message: 'Engine rejected the script.' }]; });
  assert.equal(evaluateCheck(expected, errors, 200).status, 'failed');
});

test('export requires fresh nonempty artifacts from this exact invocation', () => {
  const { expected, evidence } = fixture('export');
  const artifact = evidence.artifacts[0];
  for (const [artifacts, status] of [
    [[], 'missing'], [[{ ...artifact, createdAtMs: 99 }], 'stale'], [[{ ...artifact, byteLength: 0 }], 'invalid'],
    [[{ ...artifact, invocationId: 'old-invocation' }], 'invalid'], [[{ ...artifact, relativePath: '../game.exe' }], 'invalid'],
  ] as const) {
    assert.equal(evaluateCheck(expected, { ...evidence, artifacts }, 200).status, status);
  }
  assert.equal(evaluateCheck({ ...expected, expectedArtifactPaths: [] }, { ...evidence, artifacts: [] }, 200).status, 'invalid');
});

test('a suite cannot pass on empty plans, duplicate receipts, unexpected tools or compilation alone', () => {
  const compile = fixture('compile'), behavior = fixture('behavior');
  assert.equal(evaluateSuite([], [], 200).status, 'invalid');
  assert.equal(evaluateSuite([compile.expected], [compile.evidence, compile.evidence], 200).status, 'invalid');
  assert.equal(evaluateSuite([compile.expected], [compile.evidence, behavior.evidence], 200).status, 'invalid');
  const incomplete = evaluateSuite([compile.expected, behavior.expected], [compile.evidence], 200);
  assert.equal(incomplete.status, 'missing');
  assert.deepEqual(incomplete.passedCheckIds, ['compile']);
});


test('foreign failed processes remain stale evidence, not current failures', () => {
  const { expected, evidence } = fixture();
  const foreign = { ...evidence, binding: { ...evidence.binding, runId: 'another-run' } };
  assert.equal(evaluateCheck(expected, { ...foreign, exitCode: 1 }, 200).status, 'stale');
  assert.equal(evaluateCheck(expected, { ...foreign, signal: 'SIGTERM' }, 200).status, 'stale');
});
