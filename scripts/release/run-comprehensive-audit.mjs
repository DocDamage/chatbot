import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const quick = process.argv.includes('--quick');
const strict = process.argv.includes('--strict');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

const commit = git(['rev-parse', 'HEAD']);
const branch = git(['branch', '--show-current']) || 'detached';
const worktreeStatus = git(['status', '--short']);
const evidenceRoot = path.join(root, 'release-evidence', `${timestamp}_${commit.slice(0, 12)}`);
fs.mkdirSync(evidenceRoot, { recursive: true });

const groups = [
  {
    id: 'repository-integrity',
    name: 'Repository Integrity',
    directory: 'repository-integrity',
    commands: ['npm run check:phase2', 'node scripts/release/verify-ci-graph.mjs', 'git diff --check'],
  },
  {
    id: 'build',
    name: 'Build & Compilation',
    directory: 'build-report',
    commands: quick ? [] : ['npm run build'],
  },
  {
    id: 'static-analysis',
    name: 'Static Analysis',
    directory: 'static-analysis',
    commands: ['npm run lint'],
  },
  {
    id: 'type-safety',
    name: 'Type Safety',
    directory: 'type-safety',
    commands: ['npm run type-check'],
  },
  {
    id: 'tests-coverage',
    name: 'Tests & Coverage',
    directory: 'test-results',
    commands: quick
      ? ['npm run test:release-tools']
      : [
          'npm run test:routes -- --runInBand',
          'npm run test:services -- --runInBand',
          'npm --prefix client test',
          'npm run test:coverage -- --runInBand',
          'npm --prefix client run coverage',
        ],
  },
  {
    id: 'security',
    name: 'Security',
    directory: 'security-scan',
    commands: ['npm run test:security -- --runInBand'],
  },
  {
    id: 'secrets',
    name: 'Secrets',
    directory: 'secrets-scan',
    commands: [`node scripts/release/check-secrets.mjs${quick ? '' : ' --history'}`],
  },
  {
    id: 'dependencies',
    name: 'Dependencies',
    directory: 'dependency-scan',
    commands: ['node scripts/release/check-dependency-vulnerabilities.mjs'],
  },
  {
    id: 'supply-chain',
    name: 'Software Supply Chain',
    directory: 'sbom',
    commands: ['npm run generate:sbom'],
  },
  {
    id: 'licensing',
    name: 'Licensing & Attribution',
    directory: 'license-report',
    commands: ['npm run generate:notices'],
  },
  {
    id: 'architecture',
    name: 'Architecture & Maintainability',
    directory: 'architecture',
    commands: ['npm run check:inventory', 'npm run check:reachability', 'npm run check:file-size'],
  },
  {
    id: 'performance',
    name: 'Performance & Resource Usage',
    directory: 'benchmarks',
    commands: quick ? [] : ['npm run certify:production-like'],
  },
  {
    id: 'reliability',
    name: 'Reliability & Recovery',
    directory: 'reliability',
    commands: quick ? [] : ['npm run test:e2e'],
  },
  {
    id: 'ux-accessibility',
    name: 'UX & Accessibility',
    directory: 'accessibility',
    commands: quick ? [] : ['npm --prefix client run a11y'],
  },
  {
    id: 'data-persistence',
    name: 'Data & Persistence',
    directory: 'data-persistence',
    commands: [
      'npx jest --runTestsByPath src/core/database/Database.test.ts --runInBand',
    ],
  },
  {
    id: 'ci-release',
    name: 'CI/CD & Release Engineering',
    directory: 'ci-release',
    commands: ['node scripts/release/verify-ci-graph.mjs'],
  },
  {
    id: 'documentation',
    name: 'Documentation & Repository Policy',
    directory: 'documentation',
    commands: ['npm run check:docs', 'node scripts/release/check-release-evidence.mjs'],
  },
  {
    id: 'artifact-installation',
    name: 'Release Artifact & Installation Validation',
    directory: 'artifact',
    commands: quick ? [] : ['npm run smoke:package', 'node scripts/release/build-release-artifact.mjs'],
  },
];

function run(command) {
  const startedAt = new Date().toISOString();
  const started = process.hrtime.bigint();
  const result = spawnSync(command, {
    cwd: root,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
    maxBuffer: 256 * 1024 * 1024,
  });
  const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  return {
    command,
    startedAt,
    durationMs: Math.round(durationMs),
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

const results = [];
for (const group of groups) {
  console.log(`\n[${group.name}]`);
  const directory = path.join(evidenceRoot, group.directory);
  fs.mkdirSync(directory, { recursive: true });
  const commandResults = [];
  for (const command of group.commands) {
    console.log(`> ${command}`);
    const result = run(command);
    commandResults.push(result);
    fs.writeFileSync(
      path.join(directory, `${String(commandResults.length).padStart(2, '0')}.log`),
      `$ ${command}\nexit=${result.exitCode}\ndurationMs=${result.durationMs}\n\nSTDOUT\n${result.stdout}\nSTDERR\n${result.stderr}`,
      'utf8',
    );
    console.log(result.exitCode === 0 ? 'PASS' : `FAIL (${result.exitCode})`);
    if (result.exitCode !== 0) break;
  }
  const status = group.commands.length === 0
    ? 'NOT RUN'
    : commandResults.every((result) => result.exitCode === 0)
      ? 'PASS'
      : 'FAIL';
  results.push({ id: group.id, name: group.name, status, commands: commandResults });
}

const attestations = [
  ['clean-machine installation', 'AUDIT_INSTALLATION_VERIFIED'],
  ['upgrade and rollback', 'AUDIT_UPGRADE_VERIFIED'],
  ['uninstallation and user-data policy', 'AUDIT_UNINSTALL_VERIFIED'],
  ['manual accessibility and supported-browser review', 'AUDIT_MANUAL_ACCESSIBILITY_VERIFIED'],
  ['artifact signing or approved unsigned-release exception', 'AUDIT_SIGNING_VERIFIED'],
].map(([name, variable]) => ({ name, variable, verified: process.env[variable] === '1' }));

const failures = results.filter((result) => result.status === 'FAIL');
const notRun = results.filter((result) => result.status === 'NOT RUN');
const missingAttestations = attestations.filter((attestation) => !attestation.verified);
const releaseDecision = failures.length === 0 && notRun.length === 0 && !worktreeStatus && missingAttestations.length === 0
  ? 'GO'
  : 'NO-GO';

const summaryRows = results
  .map((result) => `| ${result.name} | ${result.status} | ${result.status === 'FAIL' ? 'See group logs' : ''} |`)
  .join('\n');
const auditSummary = `# Release Audit Summary

## Release Information

- Version: ${JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version}
- Commit: \`${commit}\`
- Branch: \`${branch}\`
- Date: ${new Date().toISOString()}
- Mode: ${quick ? 'quick' : 'full'}
- Worktree: ${worktreeStatus ? 'dirty' : 'clean'}

## Result

Overall Status: **${releaseDecision}**

| Audit | Status | Notes |
|---|---|---|
${summaryRows}

## Findings

- Automated failures: ${failures.length}
- Audits not run: ${notRun.length}
- Missing lifecycle/manual attestations: ${missingAttestations.length}
- Uncommitted paths: ${worktreeStatus ? worktreeStatus.split(/\r?\n/).length : 0}

## Release Decision

${releaseDecision}
`;
fs.writeFileSync(path.join(evidenceRoot, 'audit-summary.md'), auditSummary, 'utf8');

const knownIssues = `# Known Issues

${failures.length ? failures.map((failure) => `- P1: ${failure.name} failed; inspect its evidence logs.`).join('\n') : '- No automated P0/P1 findings remain in the executed checks.'}
${notRun.length ? notRun.map((item) => `- P1: ${item.name} was not run in ${quick ? 'quick' : 'full'} mode.`).join('\n') : ''}
${worktreeStatus ? '- P1: The worktree is dirty, so the evidence cannot be attributed solely to the recorded commit.' : ''}
${missingAttestations.map((item) => `- P1: Missing ${item.name} attestation (${item.variable}=1).`).join('\n')}
- P3: Repository-wide Prettier conformance is not yet baselined; correctness lint remains enforced.
`;
fs.writeFileSync(path.join(evidenceRoot, 'known-issues.md'), knownIssues, 'utf8');
fs.writeFileSync(
  path.join(evidenceRoot, 'release-decision.md'),
  `# Release Decision\n\n**${releaseDecision}**\n\nSee [audit-summary.md](audit-summary.md) and [known-issues.md](known-issues.md).\n`,
  'utf8',
);

for (const [filename, content] of [
  ['installation-test.md', '# Installation Test\n\nRequires AUDIT_INSTALLATION_VERIFIED=1 after clean-machine execution.\n'],
  ['upgrade-test.md', '# Upgrade Test\n\nRequires AUDIT_UPGRADE_VERIFIED=1 after a supported upgrade and rollback exercise.\n'],
]) {
  fs.writeFileSync(path.join(evidenceRoot, filename), content, 'utf8');
}

for (const [source, destination] of [
  ['docs/architecture/generated/sbom.cyclonedx.json', 'sbom/sbom.cyclonedx.json'],
  ['release-artifacts/checksums.sha256', 'checksums.sha256'],
  ['release-artifacts/artifact-inventory.json', 'artifact-inventory.json'],
]) {
  const absoluteSource = path.join(root, source);
  const absoluteDestination = path.join(evidenceRoot, destination);
  if (fs.existsSync(absoluteSource)) {
    fs.mkdirSync(path.dirname(absoluteDestination), { recursive: true });
    fs.copyFileSync(absoluteSource, absoluteDestination);
  }
}

const machineResult = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version,
  commit,
  branch,
  mode: quick ? 'quick' : 'full',
  worktreeClean: !worktreeStatus,
  decision: releaseDecision,
  groups: results.map((result) => ({
    id: result.id,
    name: result.name,
    status: result.status,
    commands: result.commands.map(({ command, startedAt, durationMs, exitCode }) => ({
      command,
      startedAt,
      durationMs,
      exitCode,
    })),
  })),
  attestations,
};
fs.writeFileSync(path.join(evidenceRoot, 'results.json'), `${JSON.stringify(machineResult, null, 2)}\n`, 'utf8');

console.log(`\nEvidence: ${path.relative(root, evidenceRoot)}`);
console.log(`Decision: ${releaseDecision}`);
if (strict && releaseDecision !== 'GO') process.exit(1);
if (failures.length > 0) process.exit(1);
