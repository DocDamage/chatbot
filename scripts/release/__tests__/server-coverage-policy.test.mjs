import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { evaluateServerCoverage, productionSupportedFeatureIds } from '../lib/server-coverage-policy.mjs';

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
    '/repo/src/critical.ts': metrics(fileValue),
    '/repo/src/server/index.ts': metrics(10),
  };
}

function manifest(status = 'PRODUCTION_PREVIEW') {
  return `| Feature ID | Name | Route | Component | Service | Persistence | Role | Availability | Status category | Tests | Evidence | Version |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n| \`CORE-001\` | Core | /api | UI | Service | DB | User | Hosted | \`${status}\` | Present | None | Unscheduled |`;
}

function policy(mode = 'audit') {
  return {
    mode,
    activeStage: 'stage-1-baseline',
    baseline: { commit: 'a'.repeat(40), global: mode === 'enforce' ? metrics(60) : null },
    coverageScope: {
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts',
      ],
      allowedExclusions: [
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts',
      ],
    },
    globalMilestones: [
      { stage: 'stage-1-baseline', lines: 60, branches: 60 },
      { stage: 'final', lines: 75, branches: 65 },
    ],
    tiers: {
      A: {
        description: 'critical',
        target: { lines: 90, branches: 85 },
        enforceFromStage: 'final',
        files: [
          {
            path: 'src/critical.ts',
            control: 'critical control',
            baseline: mode === 'enforce' ? metrics(80) : null,
          },
        ],
      },
      B: {
        description: 'supported',
        target: { lines: 80, branches: 70 },
        enforceTarget: true,
        featureIds: [],
        files: [],
      },
    },
  };
}

test('repository policy is locked in enforce mode', () => {
  const policyUrl = new URL('../../../config/server-coverage-policy.json', import.meta.url);
  const lockedPolicy = JSON.parse(fs.readFileSync(policyUrl, 'utf8'));
  assert.equal(lockedPolicy.mode, 'enforce');
  assert.equal(lockedPolicy.tiers.A.enforceFromStage, 'final');
  assert.ok(lockedPolicy.baseline.global.lines.total > 0);
  assert.ok(!lockedPolicy.coverageScope.collectCoverageFrom.includes('!src/**/index.ts'));
});

test('audit mode records honest scope including server index without pretending targets pass', () => {
  const report = evaluateServerCoverage({
    root,
    policy: policy('audit'),
    rawSummary: summary(),
    featureManifest: manifest(),
  });
  assert.equal(report.passed, true);
  assert.equal(report.tiers.A.files[0].current.lines.pct, 80);
  assert.equal(report.tiers.A.files[0].gaps[0].target, 90);
});

test('enforce mode rejects a global percentage regression', () => {
  const report = evaluateServerCoverage({
    root,
    policy: policy('enforce'),
    rawSummary: summary(59, 80),
    featureManifest: manifest(),
  });
  assert.equal(report.passed, false);
  assert.ok(report.violations.some((violation) => violation.includes('Global lines percentage regressed')));
});

test('enforce mode rejects more uncovered code even when percentage is unchanged', () => {
  const countPolicy = policy('enforce');
  countPolicy.baseline.global = metrics(80);
  const rawSummary = summary(80, 80);
  rawSummary.total = metrics(160, 200);
  const report = evaluateServerCoverage({
    root,
    policy: countPolicy,
    rawSummary,
    featureManifest: manifest(),
  });
  assert.equal(report.passed, false);
  assert.ok(report.violations.some((violation) => violation.includes('Global lines uncovered count regressed')));
});

test('enforce mode rejects a Tier A file regression even when global coverage passes', () => {
  const report = evaluateServerCoverage({
    root,
    policy: policy('enforce'),
    rawSummary: summary(60, 79),
    featureManifest: manifest(),
  });
  assert.equal(report.passed, false);
  assert.ok(report.violations.some((violation) => violation.includes('Tier A src/critical.ts lines')));
});

test('final stage enforces the Tier A 90/85 target', () => {
  const finalPolicy = policy('enforce');
  finalPolicy.activeStage = 'final';
  finalPolicy.baseline.global = metrics(80);
  finalPolicy.tiers.A.files[0].baseline = metrics(80);
  const report = evaluateServerCoverage({
    root,
    policy: finalPolicy,
    rawSummary: summary(80, 89),
    featureManifest: manifest(),
  });
  assert.equal(report.passed, false);
  assert.ok(report.violations.some((violation) => violation.includes('Tier A target not met')));
});

test('production-supported promotion requires an explicit Tier B source mapping', () => {
  assert.deepEqual(productionSupportedFeatureIds(manifest('PRODUCTION_SUPPORTED')), ['CORE-001']);
  const report = evaluateServerCoverage({
    root,
    policy: policy('audit'),
    rawSummary: summary(),
    featureManifest: manifest('PRODUCTION_SUPPORTED'),
  });
  assert.equal(report.passed, false);
  assert.ok(report.violations.some((violation) => violation.includes('Tier B feature IDs do not match')));
  assert.ok(report.violations.some((violation) => violation.includes('has no source mapping')));
});

test('a complete Tier B mapping can satisfy production-supported policy', () => {
  const supportedPolicy = policy('audit');
  supportedPolicy.tiers.B.featureIds = ['CORE-001'];
  supportedPolicy.tiers.B.files = [
    {
      path: 'src/critical.ts',
      control: 'core production service',
      featureIds: ['CORE-001'],
      baseline: null,
    },
  ];
  const report = evaluateServerCoverage({
    root,
    policy: supportedPolicy,
    rawSummary: summary(),
    featureManifest: manifest('PRODUCTION_SUPPORTED'),
  });
  assert.equal(report.passed, true);
});

test('broad source exclusions are rejected', () => {
  const unsafePolicy = policy('audit');
  unsafePolicy.coverageScope.collectCoverageFrom.push('!src/**/index.ts');
  const report = evaluateServerCoverage({
    root,
    policy: unsafePolicy,
    rawSummary: summary(),
    featureManifest: manifest(),
  });
  assert.equal(report.passed, false);
  assert.ok(report.violations.some((violation) => violation.includes('index.ts exclusion is prohibited')));
});
