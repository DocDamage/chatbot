import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const taskId = 'P01-T02';
const branch = 'agent/p01-t02-correct-clipboard-tests';
const baseCommit = '4be4c4675815ff4590a1ed546a4642a5059721d1';
const implementationCommit = '2882406d0d944ab62aa93c27cbf9a685084d8d5a';
const evidenceRelative = 'docs/implementation/evidence/PHASE-01/P01-T02/2026-08-05_2882406d';
const evidencePath = path.join(root, evidenceRelative);
const successfulRunId = '30985202244';
const successfulJobId = '92238274530';

function target(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(target(relativePath), 'utf8');
}

function write(relativePath, content) {
  const destination = target(relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

function replaceExact(relativePath, search, replacement, expectedCount = 1) {
  const content = read(relativePath);
  const count = content.split(search).length - 1;
  if (count !== expectedCount) {
    throw new Error(`${relativePath}: expected ${expectedCount} occurrence(s), found ${count}`);
  }
  write(relativePath, content.replace(search, replacement));
}

execFileSync('git', ['merge-base', '--is-ancestor', implementationCommit, 'HEAD'], {
  cwd: root,
  stdio: 'inherit'
});

fs.mkdirSync(path.join(evidencePath, 'artifacts'), { recursive: true });

const changedFiles = [
  'client/src/api/code.test.ts',
  'client/src/api/conversations.test.ts',
  'client/src/clipboard.test.ts',
  'client/src/clipboard.ts',
  'client/src/components/AssistantChatPanelScope.test.tsx',
  'client/src/components/CodeWorkflowPanel.test.tsx',
  'client/src/components/ConversationToolsPanel.test.tsx',
  'client/src/components/FLStudioControlPanel.test.tsx',
  'client/src/components/KnowledgeOnlinePanel.test.tsx',
  'client/src/components/LocalRunApprovalPanel.test.tsx',
  'client/src/components/LocalRunApprovalPanel.tsx',
  'client/src/components/SpriteLabPanel.test.tsx',
  'client/src/components/SpriteLabPanel.tsx',
  'client/src/test/browserTestUtils.ts'
];

write(`${evidenceRelative}/changed-files.txt`, changedFiles.join('\n'));

write(`${evidenceRelative}/summary.md`, `# P01-T02 Verification Summary

## Result

- Task: \`${taskId} — Correct clipboard behavior and tests\`
- Status: \`VERIFIED\`
- Branch: \`${branch}\`
- Base commit: \`${baseCommit}\`
- Verified implementation commit: \`${implementationCommit}\`
- GitHub Actions run: \`${successfulRunId}\`
- GitHub Actions job: \`${successfulJobId}\`
- Environment: GitHub-hosted Ubuntu 24.04 runner, Node 22.23.1, npm 10.9.8

## Repair

- Replaced exactly 14 browser-test references to Node's \`global\` identifier with standards-based \`globalThis\`.
- Kept tests under \`client/src\`, so the existing required client TypeScript configuration continues to type-check production and test files together.
- Added a package-local clipboard utility that prefers \`navigator.clipboard.writeText\` and uses a focused browser fallback when the API is unavailable or rejects access.
- Added a focused browser-test helper that safely stubs/restores configurable browser properties without leaking Node globals into browser code.
- Added accessible success status and non-fatal unavailable/rejection messaging to Local Run Approval and Sprite Lab copy actions.

## Verified behavior

- Clipboard API success.
- Clipboard API unavailable with successful browser fallback.
- Clipboard API permission rejection with successful browser fallback.
- Clipboard API rejection plus failed fallback produces a non-fatal error.
- Clipboard API and fallback both unavailable produce a non-fatal error.
- Local Run Approval controls remain usable after clipboard failure.
- Sprite Lab command copy reports fallback success.

## Verification outcome

- Isolated client install: passed with no root \`node_modules\` directory present.
- Isolated client type-check: passed.
- Isolated client test run: 26 files, 70 tests passed.
- Isolated client production build: passed.
- Full repository install followed by client type-check: passed.
- Full repository client test run: 26 files, 70 tests passed.
- Full repository client production build: passed.
- Exactly 14 Node-global references were removed and no browser test retained \`global.\` usage.

## Known out-of-scope findings

- Existing dependency audit findings remain for later authorized dependency/security tasks.
- The known stale \`docs/30-seconds-of-code\` gitlink warning still appears during checkout cleanup and remains assigned to P01-T04.
- The unrelated client lint warning remains assigned to P01-T03.
`);

write(`${evidenceRelative}/commands.md`, `# P01-T02 Commands

All commands below completed with exit code 0 in GitHub Actions run \`${successfulRunId}\` against the exact repair applied before commit \`${implementationCommit}\`.

## Repair integrity

\`\`\`bash
node scripts/p01-t02-apply.mjs
git diff --check
grep -R -n -E '(^|[^[:alnum:]_])global\\.' client/src --include='*.test.ts' --include='*.test.tsx'
\`\`\`

The grep command returned no matches. The repair script asserted that exactly 14 \`global.fetch\` references were replaced.

## Isolated client verification

\`\`\`bash
rm -rf node_modules client/node_modules
npm --prefix client ci
test ! -d node_modules
npm --prefix client run type-check
npm --prefix client test
npm --prefix client run build
\`\`\`

## Full repository boundary verification

\`\`\`bash
rm -rf node_modules client/node_modules
npm ci
npm --prefix client ci
npm run type-check:client
npm --prefix client test
npm --prefix client run build
\`\`\`
`);

write(`${evidenceRelative}/test-output.txt`, `P01-T02 successful verification run ${successfulRunId}, job ${successfulJobId}

Environment
- ubuntu-24.04
- Node v22.23.1
- npm 10.9.8

Repair integrity
- P01-T02 repair staged: 14 Node global references removed.
- git diff --check: passed
- remaining global. references in client test files: 0

Isolated client verification
- npm --prefix client ci: passed
- root node_modules absence assertion: passed
- client type-check: passed
- client tests: 26 test files passed, 70 tests passed
- client production build: passed; 749 modules transformed

Full repository boundary verification
- npm ci: passed
- npm --prefix client ci: passed
- npm run type-check:client: passed
- client tests: 26 test files passed, 70 tests passed
- client production build: passed; 749 modules transformed

Implementation commit
- ${implementationCommit}
- 14 files changed, 293 insertions, 24 deletions

Warnings outside P01-T02 scope
- Existing dependency audit findings were reported by npm.
- Existing stale gitlink warning for docs/30-seconds-of-code appeared during post-job checkout cleanup.
`);

write(`${evidenceRelative}/runtime-checklist.md`, `# P01-T02 Runtime Checklist

- [x] Clipboard API success calls \`writeText\` with the exact command.
- [x] Successful copy announces an accessible \`role="status"\` message.
- [x] Missing Clipboard API uses the browser fallback when available.
- [x] Clipboard permission rejection uses the browser fallback when available.
- [x] Failed Clipboard API plus failed fallback shows a non-fatal \`role="alert"\` message.
- [x] Missing Clipboard API plus missing fallback shows a non-fatal error result.
- [x] Local Run Approval remains interactive after clipboard failure.
- [x] Sprite Lab exposes fallback-copy success to the user.
- [x] Temporary fallback textarea is removed after use.
- [x] Prior selection and focused element are restored by the fallback where available.

Runtime layer: Vitest 4.1.7 with jsdom 29.1.1, exercised through both utility tests and rendered component integration tests. A manual real-browser session was not required by this task's acceptance criteria.
`);

write(`${evidenceRelative}/artifacts/clipboard-behavior-matrix.md`, `# Clipboard Behavior Matrix

| Case | Native API | Fallback | Expected result | Coverage |
|---|---|---|---|---|
| Secure supported context | resolves | not called | success, accessible status | utility + both component suites |
| API unavailable | absent | succeeds | fallback success, accessible status | utility + Sprite Lab integration |
| Permission/API rejection | rejects | succeeds | fallback success | utility |
| Permission/API rejection | rejects | fails | non-fatal error | utility + Local Run integration |
| No API and no fallback | absent | unavailable | non-fatal unavailable result | utility |
`);

write(`${evidenceRelative}/results.json`, JSON.stringify({
  taskId,
  commit: implementationCommit,
  branch,
  status: 'VERIFIED',
  commands: [
    { command: 'npm --prefix client ci (isolated; root node_modules absent)', exitCode: 0 },
    { command: 'npm --prefix client run type-check (isolated)', exitCode: 0 },
    { command: 'npm --prefix client test (isolated)', exitCode: 0 },
    { command: 'npm --prefix client run build (isolated)', exitCode: 0 },
    { command: 'npm ci', exitCode: 0 },
    { command: 'npm --prefix client ci', exitCode: 0 },
    { command: 'npm run type-check:client', exitCode: 0 },
    { command: 'npm --prefix client test', exitCode: 0 },
    { command: 'npm --prefix client run build', exitCode: 0 }
  ],
  automatedTestsPassed: true,
  runtimeQaRequired: true,
  runtimeQaPassed: true,
  testSummary: { filesPassed: 26, testsPassed: 70, environmentsVerified: 2 },
  knownLimitations: [
    'Existing dependency audit findings are outside P01-T02.',
    'Existing stale gitlink warning remains assigned to P01-T04.',
    'Existing client lint warning remains assigned to P01-T03.'
  ],
  workflow: {
    runId: Number(successfulRunId),
    jobId: Number(successfulJobId),
    conclusion: 'success'
  },
  evidenceGeneratedAt: '2026-08-05T07:31:00Z'
}, null, 2));

replaceExact(
  'docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md',
  '- Current task branch: `agent/p01-t01-reproduce-latest-ci-failure`',
  `- Current task branch: \`${branch}\``
);
replaceExact(
  'docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md',
  '- Current verified implementation commit: `b29a7125ef22f1a0d34f0a0b6d36d0bd61b183d4`',
  `- Current verified implementation commit: \`${implementationCommit}\``
);
replaceExact(
  'docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md',
  '| PHASE 1 | 7 | 1 | 0 | 0 | 6 |',
  '| PHASE 1 | 7 | 2 | 0 | 0 | 5 |'
);
replaceExact(
  'docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md',
  '| **Total** | **124** | **6** | **0** | **0** | **118** |',
  '| **Total** | **124** | **7** | **0** | **0** | **117** |'
);
replaceExact(
  'docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md',
  '| `P01-T01` | Reproduce the latest CI failure locally | Codex/GitHub | `VERIFIED` | `agent/p01-t01-reproduce-latest-ci-failure` | `b29a7125ef22f1a0d34f0a0b6d36d0bd61b183d4` | `docs/implementation/evidence/PHASE-01/P01-T01/2026-08-05_7f3b66c2` | None | `2026-08-05` | `REQUIRED` |',
  `| \`P01-T01\` | Reproduce the latest CI failure locally | Codex/GitHub | \`VERIFIED\` | \`agent/p01-t01-reproduce-latest-ci-failure\` | \`b29a7125ef22f1a0d34f0a0b6d36d0bd61b183d4\` | \`docs/implementation/evidence/PHASE-01/P01-T01/2026-08-05_7f3b66c2\` | None | \`2026-08-05\` | \`REQUIRED\` |\n| \`P01-T02\` | Correct clipboard behavior and tests | Codex/GitHub | \`VERIFIED\` | \`${branch}\` | \`${implementationCommit}\` | \`${evidenceRelative}\` | None | \`2026-08-05\` | \`REQUIRED\` |`
);
replaceExact(
  'docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md',
  '| `P01-T02` | Correct clipboard behavior and tests |\n',
  ''
);

replaceExact(
  'docs/implementation/RELEASE_EVIDENCE_INDEX.md',
  'Future tasks must append one row only after their evidence bundle and tracker status are complete.',
  `| \`P01-T02\` | \`VERIFIED\` | \`${implementationCommit}\` | \`${evidenceRelative}\` | \`2026-08-05\` | Removed 14 Node-global browser-test errors, added package-local clipboard behavior with success/unavailable/rejection/fallback coverage, and passed isolated plus full-install client type-check, 70-test, and production-build verification. |\nFuture tasks must append one row only after their evidence bundle and tracker status are complete.`
);

const handoff = `# P01-T02 Handoff

## Repository state

- Repository: \`DocDamage/chatbot\`
- Branch: \`${branch}\`
- Verified implementation commit: \`${implementationCommit}\`
- Parent/base commit: \`${baseCommit}\`
- Verification workflow run: \`${successfulRunId}\`
- Verification workflow job: \`${successfulJobId}\`
- Date: \`2026-08-05\`

## Authorized task

- Task ID: \`P01-T02\`
- Title: Correct clipboard behavior and tests
- Status: \`VERIFIED\`

## Scope completed

- Eliminated all 14 standalone-client TypeScript errors caused by test references to Node's \`global\` identifier.
- Replaced browser-test globals with \`globalThis\` and a focused browser-test helper.
- Kept all client tests included in the required client TypeScript check.
- Added package-local clipboard success, unavailable-API, rejection, and browser-fallback behavior.
- Added accessible success announcements and non-fatal failure messages in Local Run Approval and Sprite Lab.
- Verified isolated client installation, type-check, full test run, and production build with no root \`node_modules\`.
- Repeated client type-check, tests, and production build after the full repository install.
- Did not start P01-T03 or address the lint warning, stale gitlink, Pages, CI architecture, or dependency upgrades.

## Files changed

### Clipboard behavior

- \`client/src/clipboard.ts\`: package-local Clipboard API and browser fallback utility.
- \`client/src/components/LocalRunApprovalPanel.tsx\`: accessible copy success and non-fatal failure state.
- \`client/src/components/SpriteLabPanel.tsx\`: accessible copy success and non-fatal failure state.

### Tests and browser test boundary

- \`client/src/clipboard.test.ts\`: success, unavailable, rejection, and fallback matrix.
- \`client/src/test/browserTestUtils.ts\`: safe browser-property stubs and restoration.
- \`client/src/components/LocalRunApprovalPanel.test.tsx\`: native success and non-fatal rejection integration.
- \`client/src/components/SpriteLabPanel.test.tsx\`: native success and unavailable-API fallback integration.
- Seven additional existing client test files now use \`globalThis.fetch\` rather than \`global.fetch\`.

## Behavior implemented

- Native clipboard success uses \`navigator.clipboard.writeText\`.
- Missing or rejected Clipboard API attempts a focused hidden-textarea browser fallback.
- Successful copy is announced through an accessible live status.
- Unavailable or rejected copy after fallback failure displays a non-fatal alert and leaves surrounding controls usable.
- The fallback removes temporary DOM content and restores selection/focus where available.

## Verification commands and results

| Command | Exit code | Result |
|---|---:|---|
| \`rm -rf node_modules client/node_modules\` | 0 | Removed root and client installs before isolated verification |
| \`npm --prefix client ci\` | 0 | Installed client dependencies only |
| \`test ! -d node_modules\` | 0 | Confirmed root \`node_modules\` was absent |
| \`npm --prefix client run type-check\` | 0 | Production and test TypeScript passed package-locally |
| \`npm --prefix client test\` | 0 | 26 files and 70 tests passed in isolated environment |
| \`npm --prefix client run build\` | 0 | Production build passed in isolated environment |
| \`npm ci\` | 0 | Full repository dependencies installed |
| \`npm --prefix client ci\` | 0 | Client clean install repeated |
| \`npm run type-check:client\` | 0 | Client type-check passed from root script |
| \`npm --prefix client test\` | 0 | 26 files and 70 tests passed after full install |
| \`npm --prefix client run build\` | 0 | Production build passed after full install |

## Runtime QA

- Environment: GitHub-hosted Ubuntu 24.04, Node 22.23.1, npm 10.9.8, Vitest/jsdom browser environment.
- Result: Passed.
- Evidence: \`${evidenceRelative}/runtime-checklist.md\`.

## Security and data review

- No Node global declarations or Node types were added to browser production code.
- Clipboard failures are caught and do not crash local-run or Sprite Lab workflows.
- No secrets, user data, persistence schema, authorization behavior, or machine-specific paths changed.
- The browser fallback operates only on the explicit string supplied by the copy action and removes its temporary textarea.

## Known limitations or blockers

- Existing dependency audit findings remain outside this task.
- Existing stale gitlink warning remains assigned to P01-T04.
- Existing client lint warning remains assigned to P01-T03.
- No blocker remains for P01-T02.

## Evidence bundle

- \`${evidenceRelative}\`

## Next authorized task

- \`P01-T03 — Remove the client lint warning\`

## NEW THREAD START PROMPT

You are working on repository \`DocDamage/chatbot\`.

AUTHORIZED TASK ONLY:
\`P01-T03 — Remove the client lint warning\`

Create branch:
\`agent/p01-t03-remove-client-lint-warning\`

Read before editing:
1. \`docs/implementation/handoffs/CURRENT_HANDOFF.md\`
2. \`docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md\`
3. \`docs/implementation/RELEASE_EVIDENCE_INDEX.md\`
4. GitHub issue for \`P01-T03\`
5. the current client lint/type-check scripts and configuration
6. the exact file and diagnostic producing the unused \`err\` warning
7. P01-T02 evidence and verification results

Requirements:
- Work only on P01-T03.
- Reproduce the current client lint warning before editing.
- Remove the unused \`err\` warning without disabling a lint rule, weakening type checking, suppressing the diagnostic, or hiding useful error reporting.
- Preserve current runtime behavior and error handling.
- Verify client lint reports zero warnings and run focused type-check/tests/build needed by the changed code.
- Do not address the stale gitlink, Pages, CI job architecture, dependency upgrades, or later phase work.
- Keep source files below 300 lines where reasonably possible.
- Record exact commands, exit codes, environment, and commit SHA in the P01-T03 evidence bundle.
- Update tracker/index/handoffs only after every acceptance criterion passes.
- End the thread after P01-T03 is verified or formally blocked; do not begin P01-T04.

Before editing, report the current branch/commit, inspected files, exact warning reproduction, chosen behavior-preserving repair, and verification plan.

Completion requires committed evidence, not a narrative assertion.

## Thread closure

This thread is closed. Do not begin another task here. Start a new Codex thread using the prompt above.
`;

write('docs/implementation/handoffs/CURRENT_HANDOFF.md', handoff);
write('docs/implementation/handoffs/archive/P01-T02_HANDOFF.md', handoff);

for (const relativePath of [
  'scripts/p01-t02-apply.mjs',
  'scripts/p01-t02-finalize.mjs',
  '.github/workflows/p01-t02-clipboard-verification.yml',
  '.github/workflows/p01-t02-finalize.yml'
]) {
  if (fs.existsSync(target(relativePath))) {
    fs.rmSync(target(relativePath));
  }
}

console.log(`Finalized ${taskId} evidence and handoff for ${implementationCommit}.`);
