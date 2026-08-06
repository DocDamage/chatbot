import fs from 'node:fs';
import path from 'node:path';

const EPSILON = 1e-9;
const METRICS = ['lines', 'branches', 'functions', 'statements'];

function cleanCell(value) {
  return value.trim().replace(/^`|`$/g, '');
}

function metricPct(metric) {
  if (!metric || typeof metric.total !== 'number' || typeof metric.covered !== 'number') {
    return null;
  }
  return metric.total === 0 ? 100 : (metric.covered / metric.total) * 100;
}

function normalizeMetric(metric) {
  if (!metric) return null;
  return {
    total: metric.total,
    covered: metric.covered,
    skipped: metric.skipped ?? 0,
    pct: Number(metricPct(metric).toFixed(4)),
  };
}

function normalizeMetrics(entry) {
  return Object.fromEntries(METRICS.map((metric) => [metric, normalizeMetric(entry?.[metric])]));
}

function normalizeFilePath(root, filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  const relative = path.relative(root, filePath).replaceAll('\\', '/');
  if (!relative.startsWith('../') && relative !== '..') return relative;
  const sourceIndex = normalized.lastIndexOf('/src/');
  return sourceIndex >= 0 ? normalized.slice(sourceIndex + 1) : normalized;
}

export function normalizeCoverageSummary(root, rawSummary) {
  const files = new Map();
  for (const [filePath, entry] of Object.entries(rawSummary)) {
    if (filePath === 'total') continue;
    files.set(normalizeFilePath(root, filePath), normalizeMetrics(entry));
  }
  return { global: normalizeMetrics(rawSummary.total), files };
}

export function productionSupportedFeatureIds(markdown) {
  const ids = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map(cleanCell);
    if (!/^[A-Z]+-\d+$/.test(cells[0] ?? '')) continue;
    if (cells[8] === 'PRODUCTION_SUPPORTED') ids.push(cells[0]);
  }
  return ids.sort();
}

function compareFeatureIds(policyIds, manifestIds, violations) {
  const declared = [...policyIds].sort();
  if (JSON.stringify(declared) !== JSON.stringify(manifestIds)) {
    violations.push(
      `Tier B feature IDs do not match PRODUCTION_SUPPORTED manifest records: policy=${declared.join(',') || '(none)'} manifest=${manifestIds.join(',') || '(none)'}`,
    );
  }
}

function validateScope(policy, violations) {
  const configured = policy.coverageScope?.collectCoverageFrom ?? [];
  const allowed = new Set(policy.coverageScope?.allowedExclusions ?? []);
  const exclusions = configured.filter((pattern) => pattern.startsWith('!'));
  for (const exclusion of exclusions) {
    if (!allowed.has(exclusion)) {
      violations.push(`Coverage exclusion is not explicitly allowed: ${exclusion}`);
    }
  }
  if (configured.includes('!src/**/index.ts')) {
    violations.push('Broad index.ts exclusion is prohibited because it hides production entry points.');
  }
  if (!configured.includes('src/**/*.ts')) {
    violations.push('Coverage scope must include all server TypeScript source with src/**/*.ts.');
  }
}

function compareMetric(label, current, baseline, violations) {
  const currentPct = metricPct(current);
  const baselinePct = metricPct(baseline);
  if (currentPct === null || baselinePct === null) {
    violations.push(`${label} has invalid current or baseline coverage data.`);
    return;
  }
  if (currentPct + EPSILON < baselinePct) {
    violations.push(
      `${label} regressed: ${currentPct.toFixed(4)}% < ${baselinePct.toFixed(4)}% (${current.covered}/${current.total} vs ${baseline.covered}/${baseline.total}).`,
    );
  }
}

function targetGaps(metrics, target) {
  const gaps = [];
  for (const metric of ['lines', 'branches']) {
    const currentPct = metricPct(metrics?.[metric]);
    if (currentPct === null || currentPct + EPSILON < target[metric]) {
      gaps.push({ metric, current: currentPct === null ? null : Number(currentPct.toFixed(4)), target: target[metric] });
    }
  }
  return gaps;
}

function evaluateBaseline(label, current, baseline, mode, violations) {
  if (mode === 'audit') return;
  if (!baseline) {
    violations.push(`${label} is missing a locked baseline while policy mode is enforce.`);
    return;
  }
  for (const metric of METRICS) compareMetric(`${label} ${metric}`, current?.[metric], baseline?.[metric], violations);
}

function evaluateTier(name, tier, coverage, mode, violations) {
  const files = [];
  for (const record of tier.files ?? []) {
    const current = coverage.files.get(record.path);
    if (!current) {
      violations.push(`Tier ${name} file is absent from coverage summary: ${record.path}`);
      files.push({ ...record, current: null, gaps: targetGaps(null, tier.target) });
      continue;
    }
    evaluateBaseline(`Tier ${name} ${record.path}`, current, record.baseline, mode, violations);
    const gaps = targetGaps(current, tier.target);
    if (tier.enforceTarget && gaps.length > 0) {
      violations.push(`Tier ${name} target not met by ${record.path}: ${gaps.map((gap) => `${gap.metric}=${gap.current ?? 'missing'}<${gap.target}`).join(', ')}`);
    }
    files.push({ path: record.path, control: record.control, current, baseline: record.baseline, gaps });
  }
  return {
    description: tier.description,
    target: tier.target,
    enforceTarget: tier.enforceTarget,
    files,
  };
}

export function evaluateServerCoverage({ root, policy, rawSummary, featureManifest }) {
  const violations = [];
  validateScope(policy, violations);
  const coverage = normalizeCoverageSummary(root, rawSummary);
  const manifestIds = productionSupportedFeatureIds(featureManifest);
  compareFeatureIds(policy.tiers.B.featureIds ?? [], manifestIds, violations);
  if (manifestIds.length > 0 && (policy.tiers.B.files ?? []).length === 0) {
    violations.push('Tier B must map at least one source file when PRODUCTION_SUPPORTED features exist.');
  }

  evaluateBaseline('Global', coverage.global, policy.baseline.global, policy.mode, violations);
  const globalTarget = policy.globalMilestones.find((stage) => stage.stage === policy.activeStage);
  if (!globalTarget) violations.push(`Unknown active coverage stage: ${policy.activeStage}`);
  if (policy.mode === 'enforce' && globalTarget?.lines != null && globalTarget?.branches != null) {
    for (const gap of targetGaps(coverage.global, globalTarget)) {
      violations.push(`Global ${gap.metric} target not met: ${gap.current}<${gap.target}`);
    }
  }

  const tiers = {
    A: evaluateTier('A', policy.tiers.A, coverage, policy.mode, violations),
    B: evaluateTier('B', policy.tiers.B, coverage, policy.mode, violations),
  };

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: policy.mode,
    activeStage: policy.activeStage,
    baselineCommit: policy.baseline.commit,
    global: {
      current: coverage.global,
      baseline: policy.baseline.global,
      activeTarget: globalTarget ?? null,
      milestones: policy.globalMilestones,
    },
    productionSupportedFeatureIds: manifestIds,
    tiers,
    violations,
    passed: violations.length === 0,
  };
}

export function loadCoverageInputs(root, paths = {}) {
  const policyPath = path.join(root, paths.policy ?? 'config/server-coverage-policy.json');
  const summaryPath = path.join(root, paths.summary ?? 'coverage/coverage-summary.json');
  const manifestPath = path.join(root, paths.manifest ?? 'docs/implementation/PRODUCTION_FEATURE_MANIFEST.md');
  return {
    policy: JSON.parse(fs.readFileSync(policyPath, 'utf8')),
    rawSummary: JSON.parse(fs.readFileSync(summaryPath, 'utf8')),
    featureManifest: fs.readFileSync(manifestPath, 'utf8'),
    policyPath,
    summaryPath,
    manifestPath,
  };
}
