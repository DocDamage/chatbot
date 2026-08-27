import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workflowPath = path.join(repositoryRoot, ".github/workflows/ci.yml");
const workflow = readFileSync(workflowPath, "utf8");
const lines = workflow.split(/\r?\n/);

const requiredJobs = [
  "repository-integrity",
  "dependency-integrity",
  "dependency-security",
  "secrets-scan",
  "supply-chain",
  "server-type-check",
  "client-type-check",
  "test-type-check",
  "server-lint",
  "client-lint",
  "server-tests",
  "client-tests",
  "e2e-tests",
  "accessibility",
  "security",
  "coverage",
  "migration-tests",
  "container-smoke",
  "package-smoke",
  "documentation",
  "release-evidence",
];

const expectedCommands = new Map([
  [
    "repository-integrity",
    [
      "bash scripts/release/verify-repository-integrity.sh",
      "node scripts/release/verify-ci-graph.mjs",
    ],
  ],
  [
    "dependency-integrity",
    [
      "npm ci",
      "npm --prefix client ci",
      "git diff --exit-code -- package-lock.json client/package-lock.json",
      "npm run type-check",
    ],
  ],
  [
    "dependency-security",
    ["npm ci", "npm --prefix client ci", "npm run check:dependencies"],
  ],
  ["secrets-scan", ["npm run check:secrets:history"]],
  [
    "supply-chain",
    [
      "npm ci",
      "npm run generate:sbom && npm run generate:notices",
      "git diff --exit-code -- docs/architecture/generated/sbom.cyclonedx.json THIRD_PARTY_NOTICES.md",
    ],
  ],
  ["server-type-check", ["npm run type-check:server"]],
  ["client-type-check", ["npm run type-check:client"]],
  ["test-type-check", ["npm run type-check:tests"]],
  ["server-lint", ["npm run lint:server"]],
  ["client-lint", ["npm run lint:client"]],
  [
    "server-tests",
    [
      "npm run test:routes -- --runInBand",
      "npm run test:services -- --runInBand",
    ],
  ],
  ["client-tests", ["npm run test"]],
  ["e2e-tests", ["npm run test:e2e"]],
  ["accessibility", ["npm run a11y"]],
  ["security", ["npm run test:security -- --runInBand"]],
  [
    "coverage",
    [
      "npm run test:coverage -- --runInBand",
      "npm --prefix client run coverage",
    ],
  ],
  [
    "migration-tests",
    ["npx jest --runTestsByPath src/core/database/Database.test.ts --runInBand"],
  ],
  ["container-smoke", ["bash scripts/release/smoke-container.sh"]],
  ["package-smoke", ["npm run smoke:package"]],
  [
    "documentation",
    [
      "npm run test:release-tools",
      "npm run check:inventory",
      "npm run check:reachability",
      "npm run check:file-size",
      "npm run check:env",
      "npm run check:docs",
    ],
  ],
  ["release-evidence", ["node scripts/release/check-release-evidence.mjs"]],
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
    if (match) starts.push({ id: match[1], index });
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
  if (!sections.has(job)) fail(`missing required job "${job}"`);
}

for (const obsolete of ["type-check", "lint", "client-tests", "server-tests"]) {
  const section = sections.get(obsolete);
  if (section?.includes("matrix.target") || section?.includes("matrix.suite")) {
    fail(`legacy grouped matrix remains in job "${obsolete}"`);
  }
}

if (workflow.includes("continue-on-error")) {
  fail("continue-on-error is prohibited in the required CI workflow");
}

if (!workflow.includes('PRIMARY_NODE_VERSION: "24"')) {
  fail("primary CI runtime must use the current active LTS, Node 24");
}

const dependencySection = sections.get("dependency-integrity") ?? "";
if (!dependencySection.includes('node-version: ["22", "24"]')) {
  fail("dependency-integrity must test both supported Node LTS lines, 22 and 24");
}
if (!dependencySection.includes("fail-fast: false")) {
  fail("dependency-integrity matrix must set fail-fast: false");
}

for (const job of requiredJobs) {
  const section = sections.get(job);
  if (section && /^\s{4}needs:/m.test(section)) {
    fail(`independent job "${job}" must not depend on another required job`);
  }
}

for (const [job, commands] of expectedCommands) {
  const section = sections.get(job);
  if (!section) continue;
  for (const command of commands) {
    if (!section.includes(command)) {
      fail(`job "${job}" does not preserve command: ${command}`);
    }
  }
}

const e2eSection = sections.get("e2e-tests") ?? "";
for (const requiredText of [
  "name: Built-server browser E2E",
  "npm --prefix client ci",
  "client/playwright-report/browser/",
  "client/test-results/browser/",
]) {
  if (!e2eSection.includes(requiredText)) {
    fail(`browser E2E job is missing required configuration: ${requiredText}`);
  }
}
if (/current smoke harness/i.test(e2eSection)) {
  fail("browser E2E job must not be labeled as the legacy smoke harness");
}

for (const match of workflow.matchAll(/uses:\s*([^\s]+)/g)) {
  const reference = match[1];
  if (/@(?:main|master|HEAD)$/i.test(reference)) {
    fail(`action reference is not pinned to a trusted major or SHA: ${reference}`);
  }
}

for (const action of ["actions/checkout@v4", "actions/setup-node@v4"]) {
  if (!workflow.includes(action)) fail(`missing approved action reference: ${action}`);
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
    if (!gate.includes(`check_result "${job}"`)) {
      fail(`required-gate does not enforce "${job}" result`);
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
