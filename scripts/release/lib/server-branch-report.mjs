import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_TARGET_PERCENTAGES = [65, 70, 75, 76];

export const KNOWN_AREAS = [
  { name: 'server/routes', match: (p) => p.startsWith('src/server/routes/') },
  { name: 'server (other)', match: (p) => p.startsWith('src/server/') && !p.startsWith('src/server/routes/') },
  { name: 'core/knowledge', match: (p) => p.startsWith('src/core/knowledge/') },
  { name: 'core/tools', match: (p) => p.startsWith('src/core/tools/') },
  { name: 'core/rag', match: (p) => p.startsWith('src/core/rag/') },
  { name: 'core/agents', match: (p) => p.startsWith('src/core/agents/') },
  { name: 'core/capabilities', match: (p) => p.startsWith('src/core/capabilities/') },
  { name: 'core/gaming', match: (p) => p.startsWith('src/core/gaming/') },
  { name: 'core/gis', match: (p) => p.startsWith('src/core/gis/') },
  { name: 'core/website', match: (p) => p.startsWith('src/core/website/') },
  { name: 'core/providers', match: (p) => p.startsWith('src/core/providers/') },
  { name: 'core/study', match: (p) => p.startsWith('src/core/study/') },
];

export function normalizeFilePath(root, filePath) {
  if (!filePath) return '';
  const normalized = filePath.replaceAll('\\', '/');
  if (root) {
    try {
      const relative = path.relative(root, filePath).replaceAll('\\', '/');
      if (!relative.startsWith('../') && relative !== '..' && !/^[A-Za-z]:/.test(relative) && !path.isAbsolute(relative)) {
        return relative;
      }
    } catch {
      // Ignore relative failure across drives
    }
  }
  const sourceIndex = normalized.lastIndexOf('/src/');
  if (sourceIndex >= 0) return normalized.slice(sourceIndex + 1);
  if (normalized.startsWith('src/')) return normalized;
  return normalized;
}

export function parseLcovBranchData(lcovContent, root = '') {
  const fileBranches = new Map();
  if (!lcovContent || typeof lcovContent !== 'string') {
    return fileBranches;
  }

  let currentFile = null;
  let currentUncoveredLines = new Map();

  for (const rawLine of lcovContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('SF:')) {
      const rawPath = line.slice(3).trim();
      currentFile = normalizeFilePath(root, rawPath);
      currentUncoveredLines = fileBranches.get(currentFile) || new Map();
      fileBranches.set(currentFile, currentUncoveredLines);
    } else if (line.startsWith('BRDA:') && currentFile) {
      // BRDA:<line>,<block>,<branch>,<taken>
      const parts = line.slice(5).split(',');
      if (parts.length >= 4) {
        const lineNum = parseInt(parts[0], 10);
        const taken = parts[3].trim();
        const isCovered = taken !== '-' && taken !== '0' && Number(taken) > 0;
        if (!isCovered && !isNaN(lineNum)) {
          const currentCount = currentUncoveredLines.get(lineNum) || 0;
          currentUncoveredLines.set(lineNum, currentCount + 1);
        }
      }
    } else if (line === 'end_of_record') {
      currentFile = null;
    }
  }

  return fileBranches;
}

export function calculateTargetGaps(totalBranches, coveredBranches, targetPcts = DEFAULT_TARGET_PERCENTAGES) {
  const targets = {};
  for (const pct of targetPcts) {
    const requiredCovered = Math.ceil((pct / 100) * totalBranches);
    const additionalNeeded = Math.max(0, requiredCovered - coveredBranches);
    targets[`${pct}%`] = {
      targetPct: pct,
      requiredCovered,
      additionalNeeded,
    };
  }
  return targets;
}

export function assignArea(relPath) {
  for (const area of KNOWN_AREAS) {
    if (area.match(relPath)) {
      return area.name;
    }
  }
  // Generic fallback area based on path segments
  const parts = relPath.split('/');
  if (parts.length >= 3 && parts[0] === 'src') {
    return `${parts[1]}/${parts[2]}`;
  }
  if (parts.length >= 2 && parts[0] === 'src') {
    return parts[1];
  }
  return 'other';
}

export function generateServerBranchGapReport({
  root = '',
  summaryData,
  lcovContent = '',
  targetPercentages = DEFAULT_TARGET_PERCENTAGES,
}) {
  if (!summaryData || typeof summaryData !== 'object') {
    throw new Error('Invalid or missing coverage summary data');
  }

  const lcovMap = parseLcovBranchData(lcovContent, root);
  const totalSummary = summaryData.total?.branches || { total: 0, covered: 0, skipped: 0, pct: 0 };
  const globalTotal = totalSummary.total || 0;
  const globalCovered = totalSummary.covered || 0;
  const globalUncovered = Math.max(0, globalTotal - globalCovered);
  const globalPct = globalTotal === 0 ? 100 : Number(((globalCovered / globalTotal) * 100).toFixed(4));

  const files = [];
  const areaAggregates = new Map();

  for (const [rawPath, metrics] of Object.entries(summaryData)) {
    if (rawPath === 'total') continue;

    const relPath = normalizeFilePath(root, rawPath);
    const branchMetric = metrics?.branches || { total: 0, covered: 0, pct: 0 };
    const total = branchMetric.total || 0;
    const covered = branchMetric.covered || 0;
    const uncovered = Math.max(0, total - covered);
    const pct = total === 0 ? 100 : Number(((covered / total) * 100).toFixed(4));

    const uncoveredMap = lcovMap.get(relPath);
    const uncoveredLines = {};
    if (uncoveredMap) {
      // Sort line numbers numerically
      const sortedLines = [...uncoveredMap.keys()].sort((a, b) => a - b);
      for (const line of sortedLines) {
        uncoveredLines[line] = uncoveredMap.get(line);
      }
    }

    const area = assignArea(relPath);
    if (!areaAggregates.has(area)) {
      areaAggregates.set(area, { area, total: 0, covered: 0, uncovered: 0, filesCount: 0 });
    }
    const areaStat = areaAggregates.get(area);
    areaStat.total += total;
    areaStat.covered += covered;
    areaStat.uncovered += uncovered;
    areaStat.filesCount += 1;

    files.push({
      path: relPath,
      area,
      total,
      covered,
      uncovered,
      pct,
      uncoveredLines,
    });
  }

  // Sort files deterministically: uncovered desc, total desc, path asc
  files.sort((a, b) => {
    if (b.uncovered !== a.uncovered) return b.uncovered - a.uncovered;
    if (b.total !== a.total) return b.total - a.total;
    return a.path.localeCompare(b.path);
  });

  // Calculate area percentages and sort areas by uncovered desc
  const areas = [...areaAggregates.values()]
    .map((a) => ({
      ...a,
      pct: a.total === 0 ? 100 : Number(((a.covered / a.total) * 100).toFixed(4)),
    }))
    .sort((a, b) => {
      if (b.uncovered !== a.uncovered) return b.uncovered - a.uncovered;
      return a.area.localeCompare(b.area);
    });

  const targets = calculateTargetGaps(globalTotal, globalCovered, targetPercentages);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    global: {
      total: globalTotal,
      covered: globalCovered,
      uncovered: globalUncovered,
      pct: globalPct,
    },
    targets,
    areas,
    files,
  };
}

export function loadCoverageArtifacts(root = process.cwd()) {
  const summaryPath = path.join(root, 'coverage/coverage-summary.json');
  const lcovPath = path.join(root, 'coverage/lcov.info');

  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Missing coverage summary at ${summaryPath}. Run 'npm run test:coverage' first.`);
  }

  const summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const lcovContent = fs.existsSync(lcovPath) ? fs.readFileSync(lcovPath, 'utf8') : '';

  return { summaryData, lcovContent };
}
