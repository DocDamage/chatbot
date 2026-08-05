import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflowPath = path.join(repositoryRoot, ".github/workflows/ci.yml");
const workflow = readFileSync(workflowPath, "utf8");
const lines = workflow.split(/\r?\n/);

const requiredJobs = [
  "repository-integrity",
  "type-check",
  "lint",
  "security",
  "server-tests",
  "client-tests",
  "accessibility",
  "packaging",
];
const matrixJobs = ["type-check", "lint", "server-tests", "client-tests"];
const expectedCommands = new Map([
  [
    "repository-integrity",
    [
      "bash scripts/release/verify-repository-integrity.sh",
      "node scripts/release/verify-ci-graph.mjs",
    ],
  ],
  [
    "type-check",
    [
      "npm run type-check:server",
      "npm run type-check:tests",
      "npm run type-check:client",
    ],
  ],
  ["lint", ["npm run lint:server", "npm run lint:client"]],
  ["security", ["npm run test:security -- --runInBand"]],
  [
    "server-tests",
    [
      "npm run test:routes -- --runInBand",
      "npm run test:services -- --runInBand",
      "npm run test:e2e -- --runInBand",
      "npm run test:coverage -- --runInBand",
    ],
  ],
  ["client-tests", ["npm run test", "npm run coverage"]],
  ["accessibility", ["npm run a11y"]],
  ["packaging", ["npm run smoke:package"]],
]);

function fail(message) {
  console.error(`CI graph verification failed: ${message}`);
  process.exitCode = 1;
}

function collectJobSections() {
  const jobsLine = lines.findIndex((line) => line === "jobs:");
  if (jobsLine === -1) {
    fail("missing top-level jobs section");
    return new Map();
  }

  const starts = [];
  for (let index = jobsLine + 1; index < lines.length; index += 1) {
    const match = /^  ([a-z0-9-]+):\s*$/.exec(lines[index]);
    if (match) {
      starts.push({ id: match[1], index });
    }
  }

  const sections = new Map();
  starts.forEach((entry, position) => {
    const next = starts[position + 1]?.index ?? lines.length;
    sections.set(entry.id, lines.slice(entry.index, next).join("\n"));
  });
  return sections;
}

const sections = collectJobSections();

for (const job of [...requiredJobs, "required-gate"]) {
  if (!sections.has(job)) {
    fail(`missing required job "${job}"`);
  }
}

if (workflow.includes("continue-on-error")) {
  fail("continue-on-error is prohibited in the required CI workflow");
}

for (const job of requiredJobs) {
  const section = sections.get(job);
  if (section && /^\s{4}needs:/m.test(section)) {
    fail(`independent job "${job}" must not depend on another required job`);
  }
}

for (const job of matrixJobs) {
  const section = sections.get(job);
  if (section && !section.includes("fail-fast: false")) {
    fail(`matrix job "${job}" must set fail-fast: false`);
  }
}

for (const [job, commands] of expectedCommands) {
  const section = sections.get(job);
  if (!section) {
    continue;
  }

  for (const command of commands) {
    if (!section.includes(command)) {
      fail(`job "${job}" does not preserve command: ${command}`);
    }
  }
}

const gate = sections.get("required-gate");
if (gate) {
  if (!gate.includes('if: ${{ always() }}')) {
    fail("required-gate must use if: ${{ always() }}");
  }

  for (const job of requiredJobs) {
    if (!gate.includes(`      - ${job}`)) {
      fail(`required-gate does not need "${job}"`);
    }
    if (!gate.includes(`needs.${job}.result`)) {
      fail(`required-gate does not inspect "${job}" result`);
    }
  }

  if (!gate.includes('[[ "$result" != "success" ]]')) {
    fail("required-gate does not reject non-success results");
  }
}

if (!process.exitCode) {
  console.log(
    `CI graph verified: ${requiredJobs.length} independent required jobs plus an aggregate gate.`,
  );
}
