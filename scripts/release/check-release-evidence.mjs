import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const trackerPath = path.join(root, "docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md");
const indexPath = path.join(root, "docs/implementation/RELEASE_EVIDENCE_INDEX.md");
const handoffPath = path.join(root, "docs/implementation/handoffs/CURRENT_HANDOFF.md");
const errors = [];

function fail(message) {
  errors.push(message);
}

function clean(value) {
  return value.trim().replace(/^`|`$/g, "");
}

function readRequired(filePath) {
  if (!existsSync(filePath)) {
    fail(`missing required file: ${path.relative(root, filePath)}`);
    return "";
  }
  return readFileSync(filePath, "utf8");
}

function tableRows(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map(clean));
}

function collectVerifiedTrackerRecords(markdown) {
  const records = new Map();
  for (const columns of tableRows(markdown)) {
    if (!/^P\d{2}-T\d{2}$/.test(columns[0] ?? "")) continue;
    if (columns[3] !== "VERIFIED") continue;
    records.set(columns[0], {
      commit: columns[5],
      evidencePath: columns[6],
    });
  }
  return records;
}

function collectVerifiedIndexRecords(markdown) {
  const records = new Map();
  for (const columns of tableRows(markdown)) {
    if (!/^P\d{2}-T\d{2}$/.test(columns[0] ?? "")) continue;
    if (columns[1] !== "VERIFIED") continue;
    records.set(columns[0], {
      commit: columns[2],
      evidencePath: columns[3],
    });
  }
  return records;
}

function validateResult(taskId, record) {
  if (!/^[0-9a-f]{40}$/.test(record.commit)) {
    fail(`${taskId}: tracker commit is not a full SHA`);
  }
  if (!record.evidencePath.startsWith("docs/implementation/evidence/")) {
    fail(`${taskId}: evidence path is outside the canonical evidence root`);
    return;
  }

  const bundlePath = path.join(root, record.evidencePath);
  const resultPath = path.join(bundlePath, "results.json");
  if (!existsSync(bundlePath) || !statSync(bundlePath).isDirectory()) {
    fail(`${taskId}: evidence directory does not exist: ${record.evidencePath}`);
    return;
  }
  if (!existsSync(resultPath)) {
    fail(`${taskId}: evidence bundle is missing results.json`);
    return;
  }

  let result;
  try {
    result = JSON.parse(readFileSync(resultPath, "utf8"));
  } catch (error) {
    fail(`${taskId}: results.json is invalid JSON: ${error.message}`);
    return;
  }

  if (result.taskId !== taskId) fail(`${taskId}: results.json taskId mismatch`);
  if (result.status !== "VERIFIED") fail(`${taskId}: results.json is not VERIFIED`);

  const evidenceCommit = result.commit ?? result.implementationCommit;
  if (evidenceCommit !== record.commit) {
    fail(`${taskId}: tracker and results.json implementation commits differ`);
  }

  const usesCurrentSchema = Object.hasOwn(result, "commit");
  if (usesCurrentSchema && (typeof result.branch !== "string" || result.branch.length === 0)) {
    fail(`${taskId}: current-schema results.json is missing branch`);
  }

  for (const key of ["automatedTestsPassed", "runtimeQaRequired", "runtimeQaPassed"]) {
    if (usesCurrentSchema && typeof result[key] !== "boolean") {
      fail(`${taskId}: current-schema results.json is missing boolean ${key}`);
    }
    if (Object.hasOwn(result, key) && typeof result[key] !== "boolean") {
      fail(`${taskId}: results.json ${key} must be boolean when present`);
    }
  }

  if (usesCurrentSchema && !Array.isArray(result.knownLimitations)) {
    fail(`${taskId}: current-schema results.json knownLimitations must be an array`);
  }
  if (Object.hasOwn(result, "knownLimitations") && !Array.isArray(result.knownLimitations)) {
    fail(`${taskId}: results.json knownLimitations must be an array when present`);
  }
  if (usesCurrentSchema && Number.isNaN(Date.parse(result.evidenceGeneratedAt))) {
    fail(`${taskId}: current-schema results.json evidenceGeneratedAt is invalid`);
  }
  if (Object.hasOwn(result, "evidenceGeneratedAt") && Number.isNaN(Date.parse(result.evidenceGeneratedAt))) {
    fail(`${taskId}: results.json evidenceGeneratedAt is invalid when present`);
  }

  if (!usesCurrentSchema) {
    if (!Array.isArray(result.commands) || result.commands.length === 0) {
      fail(`${taskId}: legacy results.json must retain command evidence`);
    } else if (result.commands.some((command) => command?.exitCode !== 0)) {
      fail(`${taskId}: legacy results.json contains a non-zero command result`);
    }
  }
}

const tracker = readRequired(trackerPath);
const evidenceIndex = readRequired(indexPath);
const handoff = readRequired(handoffPath);
const trackerRecords = collectVerifiedTrackerRecords(tracker);
const indexRecords = collectVerifiedIndexRecords(evidenceIndex);

if (trackerRecords.size === 0) fail("tracker contains no verified task records");

for (const [taskId, record] of trackerRecords) {
  validateResult(taskId, record);
  const indexed = indexRecords.get(taskId);
  if (!indexed) {
    fail(`${taskId}: verified tracker task is missing from RELEASE_EVIDENCE_INDEX.md`);
    continue;
  }
  if (indexed.commit !== record.commit || indexed.evidencePath !== record.evidencePath) {
    fail(`${taskId}: tracker and release evidence index disagree`);
  }
}

for (const taskId of indexRecords.keys()) {
  if (!trackerRecords.has(taskId)) {
    fail(`${taskId}: release evidence index marks a task VERIFIED but tracker does not`);
  }
}

if (!/## Next authorized task(?: after merge)?/.test(handoff)) {
  fail("CURRENT_HANDOFF.md is missing a next-authorized-task section");
}
if (!handoff.includes("## NEW THREAD START PROMPT")) {
  fail("CURRENT_HANDOFF.md is missing the new-thread prompt");
}
if (!handoff.includes("## Thread closure")) {
  fail("CURRENT_HANDOFF.md is missing the thread-closure section");
}

const resultFiles = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    if (entry.isFile() && entry.name === "results.json") resultFiles.push(fullPath);
  }
}
const evidenceRoot = path.join(root, "docs/implementation/evidence");
if (existsSync(evidenceRoot)) walk(evidenceRoot);
if (resultFiles.length < trackerRecords.size) {
  fail("fewer results.json files exist than verified tracker records");
}

if (errors.length > 0) {
  for (const error of errors) console.error(`Release evidence validation failed: ${error}`);
  process.exit(1);
}

console.log(
  `Release evidence verified: ${trackerRecords.size} tracker records agree with the evidence index and committed results.`,
);
