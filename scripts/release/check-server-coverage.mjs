import fs from 'node:fs';
import path from 'node:path';
import { evaluateServerCoverage, loadCoverageInputs } from './lib/server-coverage-policy.mjs';

const root = process.cwd();
const reportPath = path.join(root, 'coverage/server-coverage-policy-report.json');

try {
  const inputs = loadCoverageInputs(root);
  const report = evaluateServerCoverage({ root, ...inputs });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const global = report.global.current;
  console.log(
    `Server coverage policy (${report.mode}, ${report.activeStage}): ` +
      `lines ${global.lines.pct}% (${global.lines.covered}/${global.lines.total}), ` +
      `branches ${global.branches.pct}% (${global.branches.covered}/${global.branches.total}).`,
  );
  console.log(`Tier A critical files evaluated: ${report.tiers.A.files.length}.`);
  console.log(`Tier B production-supported feature IDs: ${report.productionSupportedFeatureIds.length}.`);
  console.log(`Coverage policy report: ${path.relative(root, reportPath)}`);

  if (!report.passed) {
    for (const violation of report.violations) console.error(`Coverage policy failed: ${violation}`);
    process.exit(1);
  }
  if (report.mode === 'audit') {
    const baselineCandidate = {
      global: report.global.current,
      tierA: Object.fromEntries(
        report.tiers.A.files.map((file) => [file.path, file.current]),
      ),
    };
    console.log(`SERVER_COVERAGE_BASELINE_JSON=${JSON.stringify(baselineCandidate)}`);
    console.log('Audit mode passed structural checks. Lock the reported baseline before verification.');
  } else {
    console.log('Server coverage policy passed.');
  }
} catch (error) {
  console.error(`Server coverage policy could not run: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
