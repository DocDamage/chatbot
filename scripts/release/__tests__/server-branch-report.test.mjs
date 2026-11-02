import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeFilePath,
  parseLcovBranchData,
  calculateTargetGaps,
  assignArea,
  generateServerBranchGapReport,
} from '../lib/server-branch-report.mjs';

test('normalizeFilePath handles Windows, POSIX, relative, and absolute paths', () => {
  const root = 'C:/repo/project';
  assert.equal(normalizeFilePath(root, 'C:\\repo\\project\\src\\server\\index.ts'), 'src/server/index.ts');
  assert.equal(normalizeFilePath(root, '/other/path/src/core/knowledge/Source.ts'), 'src/core/knowledge/Source.ts');
  assert.equal(normalizeFilePath(root, 'src/server/routes/chat.ts'), 'src/server/routes/chat.ts');
  assert.equal(normalizeFilePath(root, 'src\\core\\agents\\Agent.ts'), 'src/core/agents/Agent.ts');
  assert.equal(normalizeFilePath('', 'src\\core\\index.ts'), 'src/core/index.ts');
});

test('calculateTargetGaps uses exact ceiling arithmetic', () => {
  const total = 20531;
  const covered = 13077;
  const gaps = calculateTargetGaps(total, covered, [65, 70, 75, 76]);

  // 65%: Math.ceil(0.65 * 20531) = 13346
  assert.equal(gaps['65%'].requiredCovered, 13346);
  assert.equal(gaps['65%'].additionalNeeded, 13346 - 13077); // 269

  // 70%: Math.ceil(0.70 * 20531) = 14372
  assert.equal(gaps['70%'].requiredCovered, 14372);
  assert.equal(gaps['70%'].additionalNeeded, 14372 - 13077); // 1295

  // 75%: Math.ceil(0.75 * 20531) = 15399
  assert.equal(gaps['75%'].requiredCovered, 15399);
  assert.equal(gaps['75%'].additionalNeeded, 15399 - 13077); // 2322

  // 76%: Math.ceil(0.76 * 20531) = 15604
  assert.equal(gaps['76%'].requiredCovered, 15604);
  assert.equal(gaps['76%'].additionalNeeded, 15604 - 13077); // 2527

  // If covered exceeds target, additional needed is 0
  const higherGaps = calculateTargetGaps(100, 90, [75]);
  assert.equal(higherGaps['75%'].additionalNeeded, 0);
});

test('parseLcovBranchData handles covered, uncovered, partial branches, and malformed lines', () => {
  const lcov = `
TN:
SF:src/server/index.ts
BRDA:10,0,0,1
BRDA:10,0,1,0
BRDA:25,1,0,-
BRDA:25,1,1,3
BRDA:malformed
BRDA:30,2,0,0
end_of_record
SF:src/core/empty.ts
end_of_record
`;

  const map = parseLcovBranchData(lcov);
  assert.equal(map.has('src/server/index.ts'), true);

  const serverUncovered = map.get('src/server/index.ts');
  // Line 10: branch 1 is uncovered (taken=0) -> count 1
  assert.equal(serverUncovered.get(10), 1);
  // Line 25: branch 0 is uncovered (taken=-) -> count 1
  assert.equal(serverUncovered.get(25), 1);
  // Line 30: branch 0 is uncovered (taken=0) -> count 1
  assert.equal(serverUncovered.get(30), 1);

  // Empty file has no uncovered lines
  const emptyUncovered = map.get('src/core/empty.ts');
  assert.equal(emptyUncovered.size, 0);
});

test('generateServerBranchGapReport handles zero-total files, missing LCOV, and area rollups deterministically', () => {
  const summaryData = {
    total: {
      branches: { total: 20531, covered: 13077, skipped: 0, pct: 63.6939 },
    },
    'src/server/routes/chat.ts': {
      branches: { total: 100, covered: 50, pct: 50 },
    },
    'src/server/index.ts': {
      branches: { total: 265, covered: 45, pct: 16.98 },
    },
    'src/core/empty.ts': {
      branches: { total: 0, covered: 0, pct: 100 },
    },
    'src/core/knowledge/Source.ts': {
      branches: { total: 50, covered: 40, pct: 80 },
    },
  };

  const lcov = `
SF:src/server/index.ts
BRDA:15,0,0,0
BRDA:15,0,1,0
BRDA:20,1,0,1
end_of_record
`;

  const report1 = generateServerBranchGapReport({
    root: '',
    summaryData,
    lcovContent: lcov,
  });

  const report2 = generateServerBranchGapReport({
    root: '',
    summaryData,
    lcovContent: lcov,
  });

  // Check determinism (excluding generatedAt timestamp)
  assert.deepEqual(
    { ...report1, generatedAt: '' },
    { ...report2, generatedAt: '' }
  );

  // Verify totals
  assert.equal(report1.global.total, 20531);
  assert.equal(report1.global.covered, 13077);
  assert.equal(report1.global.uncovered, 7454);
  assert.equal(report1.global.pct, 63.6939);

  // Verify area rollups
  const serverRoutes = report1.areas.find((a) => a.area === 'server/routes');
  assert.ok(serverRoutes);
  assert.equal(serverRoutes.total, 100);
  assert.equal(serverRoutes.covered, 50);

  const serverOther = report1.areas.find((a) => a.area === 'server (other)');
  assert.ok(serverOther);
  assert.equal(serverOther.total, 265);
  assert.equal(serverOther.covered, 45);

  // Verify zero total file
  const emptyFile = report1.files.find((f) => f.path === 'src/core/empty.ts');
  assert.ok(emptyFile);
  assert.equal(emptyFile.total, 0);
  assert.equal(emptyFile.pct, 100);
  assert.equal(emptyFile.uncovered, 0);

  // Verify index uncovered lines
  const indexFile = report1.files.find((f) => f.path === 'src/server/index.ts');
  assert.ok(indexFile);
  assert.equal(indexFile.uncoveredLines[15], 2);
  assert.equal(indexFile.uncoveredLines[20], undefined);
});

test('assignArea correctly categorizes all standard repository areas', () => {
  assert.equal(assignArea('src/server/routes/auth.ts'), 'server/routes');
  assert.equal(assignArea('src/server/index.ts'), 'server (other)');
  assert.equal(assignArea('src/core/knowledge/Source.ts'), 'core/knowledge');
  assert.equal(assignArea('src/core/tools/Runner.ts'), 'core/tools');
  assert.equal(assignArea('src/core/rag/Store.ts'), 'core/rag');
  assert.equal(assignArea('src/core/agents/CodingAgent.ts'), 'core/agents');
  assert.equal(assignArea('src/core/capabilities/Cap.ts'), 'core/capabilities');
  assert.equal(assignArea('src/core/gaming/Game.ts'), 'core/gaming');
  assert.equal(assignArea('src/core/gis/Map.ts'), 'core/gis');
  assert.equal(assignArea('src/core/website/Crawler.ts'), 'core/website');
  assert.equal(assignArea('src/core/providers/LLM.ts'), 'core/providers');
  assert.equal(assignArea('src/core/study/Study.ts'), 'core/study');
});
