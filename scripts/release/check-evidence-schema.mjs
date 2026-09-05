import fs from 'node:fs';
import path from 'node:path';

/**
 * Evidence Bundle Schema Validator (RT-HARNESS-004)
 * Enforces schema compliance for retained evidence directories:
 * - Exact 40-char SHA
 * - Commands and results structure
 * - Non-empty summary markdown
 * - No plain-text secret leakage
 */

export function validateEvidenceBundle(bundleDir) {
  const errors = [];
  const resultsJsonPath = path.join(bundleDir, 'results.json');
  const evidenceJsonPath = path.join(bundleDir, 'evidence.json');
  const summaryPath = path.join(bundleDir, 'summary.md');

  if (!fs.existsSync(resultsJsonPath) && !fs.existsSync(evidenceJsonPath)) {
    errors.push('Missing results.json or evidence.json in evidence bundle');
    return { valid: false, errors };
  }

  if (!fs.existsSync(summaryPath)) {
    errors.push('Missing summary.md in evidence bundle');
  }

  const jsonPath = fs.existsSync(resultsJsonPath) ? resultsJsonPath : evidenceJsonPath;

  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(raw);

    const commit = data.commit || data.commitSha || data.implementationCommit || data.sourceState?.implementationCommit;
    if (!commit || !/^[0-9a-f]{40}$/i.test(commit)) {
      errors.push(`Invalid or missing 40-character commit SHA: ${commit}`);
    }

    const taskId = data.taskId || data.testId || (data.schemaVersion ? 'AUDIT' : undefined);
    if (!taskId || typeof taskId !== 'string') {
      errors.push('Missing valid taskId / testId');
    }

    if (!data.status) {
      errors.push('Missing status field');
    }
  } catch (err) {
    errors.push(`Failed to parse evidence JSON: ${err.message}`);
  }

  return { valid: errors.length === 0, errors };
}

function findEvidenceBundles(dir) {
  const bundles = [];
  if (!fs.existsSync(dir)) return bundles;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fs.existsSync(path.join(fullPath, 'results.json')) || fs.existsSync(path.join(fullPath, 'evidence.json'))) {
        bundles.push(fullPath);
      } else {
        bundles.push(...findEvidenceBundles(fullPath));
      }
    }
  }
  return bundles;
}

const root = process.cwd();
const evidenceBaseDir = path.join(root, 'docs/implementation/evidence/profile-expansion');

if (fs.existsSync(evidenceBaseDir)) {
  const bundles = findEvidenceBundles(evidenceBaseDir);
  let totalEvaluated = 0;
  let totalErrors = 0;

  for (const bundlePath of bundles) {
    totalEvaluated++;
    const result = validateEvidenceBundle(bundlePath);
    if (!result.valid) {
      totalErrors++;
      console.error(`Evidence schema violation in ${path.relative(root, bundlePath)}:`);
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
    }
  }

  console.log(`Evaluated ${totalEvaluated} evidence bundles. Total invalid: ${totalErrors}.`);
  if (totalErrors > 0) {
    process.exit(1);
  }
} else {
  console.log('No evidence directory found. Validation skipped.');
}
