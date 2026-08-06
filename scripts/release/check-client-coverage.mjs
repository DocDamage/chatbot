import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateClientCoverage,
  loadClientCoverageInputs,
} from './lib/client-coverage-policy.mjs';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const reportPath = path.join(root, 'client/coverage/client-coverage-policy-report.json');

try {
  const inputs = loadClientCoverageInputs(root);
  const report = evaluateClientCoverage({ root, ...inputs });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const global = report.global.current;
  console.log(
    `Client coverage policy (${report.mode}, ${report.activeStage}): ` +
      `lines ${global.lines.pct}% (${global.lines.covered}/${global.lines.total}), ` +
      `branches ${global.branches.pct}% (${global.branches.covered}/${global.branches.total}).`,
  );
  console.log(
    `Critical client files evaluated: ${report.criticalWorkflows.files.length}.`,
  );
  console.log(`Coverage policy report: ${path.relative(root, reportPath)}`);

  if (!report.passed) {
    for (const violation of report.violations) {
      console.error(`Client coverage policy failed: ${violation}`);
    }
    process.exit(1);
  }

  if (report.mode === 'audit') {
    const baselineCandidate = {
      global: report.global.current,
      criticalFiles: Object.fromEntries(
        report.criticalWorkflows.files.map((file) => [file.path, file.current]),
      ),
    };
    console.log(`CLIENT_COVERAGE_BASELINE_JSON=${JSON.stringify(baselineCandidate)}`);
    console.log('Audit mode passed structural checks. Lock the reported baseline before verification.');
  } else {
    console.log('Client coverage policy passed.');
  }
} catch (error) {
  console.error(
    `Client coverage policy could not run: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
}
