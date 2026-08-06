import fs from 'node:fs';
import path from 'node:path';

const EPSILON = 1e-9;
const METRICS = ['lines', 'branches', 'functions', 'statements'];

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
  const clientIndex = normalized.lastIndexOf('/client/src/');
  return clientIndex >= 0 ? normalized.slice(clientIndex + 1) : normalized;
}

export function normalizeClientCoverageSummary(root, rawSummary) {
  const files = new Map();
  for (const [filePath, entry] of Object.entries(rawSummary)) {
    if (filePath === 'total') continue;
    files.set(normalizeFilePath(root, filePath), normalizeMetrics(entry));
  }
  return { global: normalizeMetrics(rawSummary.total), files };
}

function validateScope(policy, violations) {
  const scope = policy.coverageScope ?? {};
  const include = scope.include ?? [];
  const exclude = scope.exclude ?? [];
  const allowed = new Set(scope.allowedExclusions ?? []);

  if (!include.includes('src/**/*.{ts,tsx}')) {
    violations.push('Client coverage scope must include src/**/*.{ts,tsx}.');
  }
  for (const exclusion of exclude) {
    if (!allowed.has(exclusion)) {
      violations.push(`Client coverage exclusion is not explicitly allowed: ${exclusion}`);
    }
  }

  const prohibited = [
    'src/main.tsx',
    'src/components/**',
    'src/api/**',
    'src/features/**',
    'src/**/*.tsx',
    'src/**/*.ts',
  ];
  for (const exclusion of exclude) {
    if (prohibited.includes(exclusion)) {
      violations.push(`Broad production client exclusion is prohibited: ${exclusion}`);
    }
  }

  const requiredExclusions = [
    'src/**/*.d.ts',
    'src/**/__tests__/**',
    'src/**/*.test.{ts,tsx}',
    'src/**/*.spec.{ts,tsx}',
    'src/test/**',
  ];
  for (const required of requiredExclusions) {
    if (!exclude.includes(required)) {
      violations.push(`Client coverage scope is missing required non-production exclusion: ${required}`);
    }
  }
}

function validateWorkflowMapping(policy, violations) {
  const critical = policy.criticalWorkflows ?? {};
  const requiredIds = new Set(critical.requiredWorkflowIds ?? []);
  const mapped = new Map([...requiredIds].map((id) => [id, 0]));
  const seen = new Set();

  for (const record of critical.files ?? []) {
    if (seen.has(record.path)) {
      violations.push(`Critical workflow contains duplicate file: ${record.path}`);
    }
    seen.add(record.path);

    if (!record.path?.startsWith('client/src/')) {
      violations.push(`Critical client file must use a repo-relative client/src path: ${record.path}`);
    }
    if (!Array.isArray(record.workflowIds) || record.workflowIds.length === 0) {
      violations.push(`Critical client file must map at least one workflow: ${record.path}`);
      continue;
    }
    for (const workflowId of record.workflowIds) {
      if (!requiredIds.has(workflowId)) {
        violations.push(`Critical client file ${record.path} maps unknown workflow: ${workflowId}`);
        continue;
      }
      mapped.set(workflowId, mapped.get(workflowId) + 1);
    }
  }

  for (const [workflowId, count] of mapped) {
    if (count === 0) {
      violations.push(`Required client workflow has no critical source mapping: ${workflowId}`);
    }
  }
}

function compareMetric(label, current, baseline, violations) {
  const currentPct = metricPct(current);
  const baselinePct = metricPct(baseline);
  if (currentPct === null || baselinePct === null) {
    violations.push(`${label} has invalid current or baseline coverage data.`);
    return;
  }

  const currentUncovered = current.total - current.covered;
  const baselineUncovered = baseline.total - baseline.covered;
  if (currentUncovered > baselineUncovered) {
    violations.push(
      `${label} uncovered count regressed: ${currentUncovered} > ${baselineUncovered} ` +
        `(${current.covered}/${current.total} vs ${baseline.covered}/${baseline.total}).`,
    );
  }
  if (currentPct + EPSILON < baselinePct) {
    violations.push(
      `${label} percentage regressed: ${currentPct.toFixed(4)}% < ${baselinePct.toFixed(4)}% ` +
        `(${current.covered}/${current.total} vs ${baseline.covered}/${baseline.total}).`,
    );
  }
}

function evaluateBaseline(label, current, baseline, mode, violations) {
  if (mode === 'audit') return;
  if (!baseline) {
    violations.push(`${label} is missing a locked baseline while policy mode is enforce.`);
    return;
  }
  for (const metric of METRICS) {
    compareMetric(`${label} ${metric}`, current?.[metric], baseline?.[metric], violations);
  }
}

function targetGaps(metrics, target) {
  const gaps = [];
  for (const metric of ['lines', 'branches']) {
    const currentPct = metricPct(metrics?.[metric]);
    if (currentPct === null || currentPct + EPSILON < target[metric]) {
      gaps.push({
        metric,
        current: currentPct === null ? null : Number(currentPct.toFixed(4)),
        target: target[metric],
      });
    }
  }
  return gaps;
}

function stageAtOrAfter(policy, targetStage, violations) {
  const stages = policy.globalMilestones ?? [];
  const currentIndex = stages.findIndex((stage) => stage.stage === policy.activeStage);
  const targetIndex = stages.findIndex((stage) => stage.stage === targetStage);
  if (currentIndex < 0) {
    violations.push(`Unknown active client coverage stage: ${policy.activeStage}`);
    return false;
  }
  if (targetIndex < 0) {
    violations.push(`Unknown client coverage enforcement stage: ${targetStage}`);
    return false;
  }
  return currentIndex >= targetIndex;
}

function evaluateCriticalFiles(policy, coverage, violations) {
  const critical = policy.criticalWorkflows;
  const enforceTarget =
    policy.mode === 'enforce' &&
    stageAtOrAfter(policy, critical.enforceFromStage, violations);
  const files = [];

  for (const record of critical.files ?? []) {
    const current = coverage.files.get(record.path);
    if (!current) {
      violations.push(`Critical client file is absent from coverage summary: ${record.path}`);
      files.push({ ...record, current: null, gaps: targetGaps(null, critical.target) });
      continue;
    }

    evaluateBaseline(`Critical client ${record.path}`, current, record.baseline, policy.mode, violations);
    const gaps = targetGaps(current, critical.target);
    if (enforceTarget && gaps.length > 0) {
      violations.push(
        `Critical client target not met by ${record.path}: ` +
          gaps.map((gap) => `${gap.metric}=${gap.current ?? 'missing'}<${gap.target}`).join(', '),
      );
    }
    files.push({ ...record, current, gaps });
  }

  return {
    description: critical.description,
    target: critical.target,
    enforceFromStage: critical.enforceFromStage,
    enforceTarget,
    files,
  };
}

export function evaluateClientCoverage({ root, policy, rawSummary }) {
  const violations = [];
  if (!['audit', 'enforce'].includes(policy.mode)) {
    violations.push(`Unknown client coverage policy mode: ${policy.mode}`);
  }

  validateScope(policy, violations);
  validateWorkflowMapping(policy, violations);
  const coverage = normalizeClientCoverageSummary(root, rawSummary);
  evaluateBaseline('Global client', coverage.global, policy.baseline?.global, policy.mode, violations);

  const activeTarget = (policy.globalMilestones ?? []).find(
    (stage) => stage.stage === policy.activeStage,
  );
  if (!activeTarget) {
    violations.push(`Unknown active client coverage stage: ${policy.activeStage}`);
  } else if (
    policy.mode === 'enforce' &&
    activeTarget.lines != null &&
    activeTarget.branches != null
  ) {
    for (const gap of targetGaps(coverage.global, activeTarget)) {
      violations.push(`Global client ${gap.metric} target not met: ${gap.current}<${gap.target}`);
    }
  }

  const criticalWorkflows = evaluateCriticalFiles(policy, coverage, violations);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: policy.mode,
    activeStage: policy.activeStage,
    baselineCommit: policy.baseline?.commit ?? null,
    global: {
      current: coverage.global,
      baseline: policy.baseline?.global ?? null,
      activeTarget: activeTarget ?? null,
      milestones: policy.globalMilestones ?? [],
    },
    criticalWorkflows,
    violations,
    passed: violations.length === 0,
  };
}

export function loadClientCoverageInputs(root, paths = {}) {
  const policyPath = path.join(root, paths.policy ?? 'config/client-coverage-policy.json');
  const summaryPath = path.join(root, paths.summary ?? 'client/coverage/coverage-summary.json');
  return {
    policy: JSON.parse(fs.readFileSync(policyPath, 'utf8')),
    rawSummary: JSON.parse(fs.readFileSync(summaryPath, 'utf8')),
    policyPath,
    summaryPath,
  };
}
