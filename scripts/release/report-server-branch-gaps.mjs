import fs from 'node:fs';
import path from 'node:path';
import {
  generateServerBranchGapReport,
  loadCoverageArtifacts,
} from './lib/server-branch-report.mjs';

const root = process.cwd();
const defaultEvidencePath = path.join(
  root,
  'docs/implementation/evidence/server-branch-coverage/server-branch-gap-report.json'
);

function parseArgs() {
  const args = process.argv.slice(2);
  let outputPath = defaultEvidencePath;
  let summaryPath = null;
  let lcovPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputPath = path.resolve(root, args[i + 1]);
      i++;
    } else if (args[i] === '--summary' && args[i + 1]) {
      summaryPath = path.resolve(root, args[i + 1]);
      i++;
    } else if (args[i] === '--lcov' && args[i + 1]) {
      lcovPath = path.resolve(root, args[i + 1]);
      i++;
    }
  }

  return { outputPath, summaryPath, lcovPath };
}

try {
  const { outputPath, summaryPath, lcovPath } = parseArgs();

  let summaryData;
  let lcovContent = '';

  if (summaryPath) {
    summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    if (lcovPath && fs.existsSync(lcovPath)) {
      lcovContent = fs.readFileSync(lcovPath, 'utf8');
    }
  } else {
    const artifacts = loadCoverageArtifacts(root);
    summaryData = artifacts.summaryData;
    lcovContent = artifacts.lcovContent;
  }

  const report = generateServerBranchGapReport({
    root,
    summaryData,
    lcovContent,
  });

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  const { global, targets, areas, files } = report;

  console.log('\n===============================================================');
  console.log('              SERVER BRANCH COVERAGE GAP REPORT                ');
  console.log('===============================================================');
  console.log(
    `Current Global Branch Coverage: ${global.pct}% (${global.covered.toLocaleString()} / ${global.total.toLocaleString()})`
  );
  console.log(`Uncovered Branch Arms:          ${global.uncovered.toLocaleString()}`);
  console.log('---------------------------------------------------------------');
  console.log('TARGET PROGRESS & GAPS AT CURRENT DENOMINATOR:');
  for (const [targetKey, target] of Object.entries(targets)) {
    const status = target.additionalNeeded === 0 ? '✅ ACHIEVED' : `⏳ NEED +${target.additionalNeeded.toLocaleString()}`;
    console.log(
      `  - ${targetKey.padEnd(5)}: Required ${target.requiredCovered.toLocaleString()} arms | ${status}`
    );
  }
  console.log('---------------------------------------------------------------');
  console.log('AREA ROLLUPS:');
  console.log(
    '  ' +
      'Area'.padEnd(24) +
      'Total'.padStart(8) +
      'Covered'.padStart(9) +
      'Uncovered'.padStart(11) +
      'Coverage %'.padStart(12)
  );
  console.log('  ' + '-'.repeat(64));
  for (const a of areas) {
    console.log(
      '  ' +
        a.area.padEnd(24) +
        a.total.toLocaleString().padStart(8) +
        a.covered.toLocaleString().padStart(9) +
        a.uncovered.toLocaleString().padStart(11) +
        (a.pct.toFixed(2) + '%').padStart(12)
    );
  }

  console.log('---------------------------------------------------------------');
  console.log('TOP 15 UNCOVERED SOURCE FILES:');
  console.log(
    '  ' +
      'File'.padEnd(48) +
      'Total'.padStart(8) +
      'Covered'.padStart(9) +
      'Uncovered'.padStart(11) +
      'Coverage %'.padStart(12)
  );
  console.log('  ' + '-'.repeat(88));
  for (const f of files.slice(0, 15)) {
    const displayPath = f.path.length > 46 ? '...' + f.path.slice(-43) : f.path;
    console.log(
      '  ' +
        displayPath.padEnd(48) +
        f.total.toLocaleString().padStart(8) +
        f.covered.toLocaleString().padStart(9) +
        f.uncovered.toLocaleString().padStart(11) +
        (f.pct.toFixed(2) + '%').padStart(12)
    );
  }
  console.log('===============================================================');
  if (outputPath) {
    console.log(`Machine-readable report written to: ${path.relative(root, outputPath)}`);
  }
  console.log('');
} catch (error) {
  console.error(`Branch coverage report could not run: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
