import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { evaluateClientCoverage } from '../lib/client-coverage-policy.mjs';

const root = '/repo';

function metric(covered, total = 100) {
  return { covered, total, skipped: 0, pct: total === 0 ? 100 : (covered / total) * 100 };
}

function metrics(value, total = 100) {
  return {
    lines: metric(value, total),
    branches: metric(value, total),
    functions: metric(value, total),
    statements: metric(value, total),
  };
}

function summary(globalValue = 60, fileValue = 80) {
  return {
    total: metrics(globalValue),
    '/repo/client/src/critical.tsx': metrics(fileValue),
    '/repo/client/src/main.tsx': metrics(0, 2),
  };
}

function policy(mode = 'audit') {
  return {
    mode,
    activeStage: 'stage-1-baseline',
    baseline: {
      commit: mode === 'enforce' ? 'a'.repeat(40) : null,
      global: mode === 'enforce' ? metrics(60) : null,
    },
    coverageScope: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
      ],
      allowedExclusions: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
      ],
    },
    globalMilestones: [
      { stage: 'stage-1-baseline', lines: null, branches: null },
      { stage: 'final', lines: 80, branches: 70 },
    ],
    criticalWorkflows: {
      description: 'critical client workflows',
      target: { lines: 80, branches: 70 },
      enforceFromStage: 'final',
      requiredWorkflowIds: ['core'],
      files: [
        {
          path: 'client/src/critical.tsx',
          control: 'critical workflow',
          workflowIds: ['core'],
          baseline: mode === 'enforce' ? metrics(80) : null,
        },
      ],
    },
  };
}

test('repository client policy covers production entry points and required workflow categories', () => {
  const policyUrl = new URL('../../../config/client-coverage-policy.json', import.meta.url);
  const repositoryPolicy = JSON.parse(fs.readFileSync(policyUrl, 'utf8'));
  assert.ok(['audit', 'enforce'].includes(repositoryPolicy.mode));
  assert.ok(repositoryPolicy.coverageScope.include.includes('src/**/*.{ts,tsx}'));
  assert.ok(!repositoryPolicy.coverageScope.exclude.includes('src/main.tsx'));
  assert.equal(repositoryPolicy.criticalWorkflows.target.lines, 80);
  assert.equal(repositoryPolicy.globalMilestones.at(-1).lines, 80);
  assert.ok(repositoryPolicy.criticalWorkflows.requiredWorkflowIds.includes('api-clients'));
  assert.ok(
    repositoryPolicy.criticalWorkflows.requiredWorkflowIds.includes(
      'dangerous-action-confirmation',
    ),
  );
});

test('audit mode reports the complete baseline without pretending final targets pass', () => {
  const report = evaluateClientCoverage({
    root,
    policy: policy('audit'),
    rawSummary: summary(),
  });
  assert.equal(report.passed, true);
  assert.equal(report.global.current.lines.pct, 60);
  assert.equal(report.criticalWorkflows.files[0].gaps.length, 0);
});

test('enforce mode rejects a global percentage regression', () => {
  const report = evaluateClientCoverage({
    root,
    policy: policy('enforce'),
    rawSummary: summary(59, 80),
  });
  assert.equal(report.passed, false);
  assert.ok(
    report.violations.some((violation) =>
      violation.includes('Global client lines percentage regressed'),
    ),
  );
});

test('enforce mode rejects more uncovered code even when percentage is unchanged', () => {
  const countPolicy = policy('enforce');
  countPolicy.baseline.global = metrics(80);
  const rawSummary = summary(80, 80);
  rawSummary.total = metrics(160, 200);
  const report = evaluateClientCoverage({ root, policy: countPolicy, rawSummary });
  assert.equal(report.passed, false);
  assert.ok(
    report.violations.some((violation) =>
      violation.includes('Global client lines uncovered count regressed'),
    ),
  );
});

test('enforce mode rejects a critical workflow file regression', () => {
  const report = evaluateClientCoverage({
    root,
    policy: policy('enforce'),
    rawSummary: summary(60, 79),
  });
  assert.equal(report.passed, false);
  assert.ok(
    report.violations.some((violation) =>
      violation.includes('Critical client client/src/critical.tsx lines'),
    ),
  );
});

test('final stage enforces 80 percent line coverage for every critical file', () => {
  const finalPolicy = policy('enforce');
  finalPolicy.activeStage = 'final';
  finalPolicy.baseline.global = metrics(80);
  finalPolicy.criticalWorkflows.files[0].baseline = metrics(79);
  const report = evaluateClientCoverage({
    root,
    policy: finalPolicy,
    rawSummary: summary(80, 79),
  });
  assert.equal(report.passed, false);
  assert.ok(
    report.violations.some((violation) =>
      violation.includes('Critical client target not met'),
    ),
  );
});

test('missing required workflow mappings fail the policy', () => {
  const incompletePolicy = policy('audit');
  incompletePolicy.criticalWorkflows.requiredWorkflowIds.push('missing-workflow');
  const report = evaluateClientCoverage({
    root,
    policy: incompletePolicy,
    rawSummary: summary(),
  });
  assert.equal(report.passed, false);
  assert.ok(
    report.violations.some((violation) =>
      violation.includes('Required client workflow has no critical source mapping'),
    ),
  );
});

test('broad production exclusions are rejected', () => {
  const unsafePolicy = policy('audit');
  unsafePolicy.coverageScope.exclude.push('src/main.tsx');
  unsafePolicy.coverageScope.allowedExclusions.push('src/main.tsx');
  const report = evaluateClientCoverage({
    root,
    policy: unsafePolicy,
    rawSummary: summary(),
  });
  assert.equal(report.passed, false);
  assert.ok(
    report.violations.some((violation) =>
      violation.includes('Broad production client exclusion is prohibited'),
    ),
  );
});
