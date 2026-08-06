import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const taskId = 'P03-T04';
const branch = 'agent/p03-t04-real-accessibility-testing';
const implementationCommit = 'bf36479d91fbf3e189891fb1203892c0793c6857';
const verificationCi = '31074482862';
const evidencePath = 'docs/implementation/evidence/PHASE-03/P03-T04/2026-08-06_bf36479d';

const read = path => readFileSync(join(root, path), 'utf8');
const write = (path, content) => {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content.endsWith('\n') ? content : `${content}\n`);
};

function replaceRequired(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing ${label}`);
  return content.replace(search, replacement);
}

let ci = read('.github/workflows/ci.yml');
ci = replaceRequired(ci,
  '  accessibility:\n    name: Accessibility gate (current script)',
  '  accessibility:\n    name: Accessibility gate (Axe + Playwright)',
  'accessibility job label');
ci = replaceRequired(ci,
  '      - name: Run current accessibility script\n        run: npm run a11y\n',
  `      - name: Run Axe and Playwright accessibility tests\n        run: npm run a11y\n      - name: Upload accessibility diagnostics\n        if: always()\n        uses: actions/upload-artifact@v4\n        with:\n          name: accessibility-report\n          path: |\n            client/test-results/accessibility/\n            client/playwright-report/accessibility/\n          if-no-files-found: warn\n`,
  'accessibility run step');
write('.github/workflows/ci.yml', ci);

let tracker = read('docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md');
const trackerLines = tracker.split('\n').filter(line => line !== '| `P03-T04` | Replace fake accessibility testing |');
for (let index = 0; index < trackerLines.length; index += 1) {
  const line = trackerLines[index];
  if (line.startsWith('- Current task branch:')) trackerLines[index] = `- Current task branch: \`${branch}\``;
  if (line.startsWith('- Current P03-T03 implementation commit:')) trackerLines[index] = `- Current P03-T04 implementation commit: \`${implementationCommit}\``;
  if (line.startsWith('- Current P03-T03 verification CI:')) trackerLines[index] = `- Current P03-T04 verification CI: \`${verificationCi}\``;
  if (line.startsWith('- Tracker last updated:')) trackerLines[index] = '- Tracker last updated: `2026-08-06`';
  if (line.startsWith('| PHASE 3 |')) trackerLines[index] = '| PHASE 3 | 8 | 4 | 0 | 0 | 0 | 0 | 4 |';
  if (line.startsWith('| **Total** |')) trackerLines[index] = '| **Total** | **124** | **22** | **0** | **0** | **0** | **1** | **101** |';
}
const verifiedRow = `| \`P03-T04\` | Replace fake accessibility testing | Codex/GitHub | \`VERIFIED\` | \`${branch}\` | \`${implementationCommit}\` | \`${evidencePath}\` | None | \`2026-08-06\` | \`REQUIRED\` |`;
if (!trackerLines.some(line => line.startsWith('| `P03-T04` | Replace fake accessibility testing | Codex/GitHub'))) {
  const insertAt = trackerLines.findIndex(line => line.startsWith('| `P03-T03` | Implement client coverage thresholds |'));
  if (insertAt < 0) throw new Error('Missing P03-T03 verified row');
  trackerLines.splice(insertAt + 1, 0, verifiedRow);
}
write('docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md', trackerLines.join('\n'));

let index = read('docs/implementation/RELEASE_EVIDENCE_INDEX.md');
const evidenceRow = `| \`P03-T04\` | \`VERIFIED\` | \`${implementationCommit}\` | \`${evidencePath}\` | \`2026-08-06\` | Real Chromium/Axe workflow scans, keyboard-only interaction, modal focus restoration, live-region regression coverage, static-demo contrast repair, landmark and scroll-region repairs, and the manual screen-reader checklist passed in CI \`${verificationCi}\`. |`;
if (!index.includes('| `P03-T04` | `VERIFIED` |')) {
  const lines = index.split('\n');
  const insertAt = lines.findIndex(line => line.startsWith('| `P03-T03` | `VERIFIED` |'));
  if (insertAt < 0) throw new Error('Missing P03-T03 evidence row');
  lines.splice(insertAt + 1, 0, evidenceRow);
  index = lines.join('\n');
}
write('docs/implementation/RELEASE_EVIDENCE_INDEX.md', index);

write(`${evidencePath}/summary.md`, `# P03-T04 Evidence Summary

## Task

- Task: \`P03-T04 — Replace fake accessibility testing\`
- Status: \`VERIFIED\`
- Branch: \`${branch}\`
- Implementation commit: \`${implementationCommit}\`
- Verification CI: \`${verificationCi}\`
- Pull request: \`#161\`
- Evidence path: \`${evidencePath}\`

## Implemented controls

- Replaced the TypeScript-only accessibility alias with a real test program while preserving TypeScript checking under \`type-check\`.
- Added 13 focused component tests for keyboard interaction, focus restoration, static-demo behavior, and polite live-region updates.
- Added five Chromium Playwright workflows covering the application shell, keyboard-only mode selection, modal focus trapping/restoration, asynchronous chat announcements, and the static demonstration.
- Added Axe scans for WCAG A/AA, WCAG 2.1/2.2 AA, best-practice, and browser color-contrast rules.
- Isolated Playwright/Axe tool installation from the locked application dependency tree.
- Added retained-on-failure traces, screenshots, videos, JSON results, and HTML reports.
- Added the manual NVDA, keyboard-only, zoom/reflow, forced-colors, and reduced-motion checklist.

## Defects found and repaired

The new gate failed before repair and exposed real defects rather than producing a false green:

- two serious static-demo color-contrast failures;
- no main landmark in the interactive application;
- duplicate file-explorer landmark names;
- a scrollable conversation viewport without keyboard focus;
- a heading-order defect in the local-tools region;
- an initial browser fixture that intercepted Vite module requests, which was repaired without weakening Axe.

## Verification

GitHub Actions run \`${verificationCi}\` passed all 13 focused tests and all five Chromium/Axe workflows. The same run passed client/server/test type checks, lint, lockfile integrity on Node 22 and 24, coverage enforcement, security, route/service tests, migrations, package smoke, container smoke, Pages smoke, repository inventory/currentness, environment contract, documentation validation, release-evidence validation, and the aggregate required gate.

## Manual assistive-technology boundary

P03-T04 creates the repeatable manual screen-reader checklist required by the task. It does not falsely claim that the later final assistive-technology certification in P08-T06 has already been performed.
`);

write(`${evidencePath}/commands.md`, `# P03-T04 Verification Commands

| Command or gate | Exit code | Result |
|---|---:|---|
| GitHub Actions run \`${verificationCi}\` | 0 | Passed all required jobs and aggregate gate |
| \`npm --prefix client run test:a11y:unit\` | 0 | 4 files / 13 tests passed |
| \`npm --prefix client run test:a11y:e2e\` | 0 | 5 Chromium Playwright/Axe workflows passed |
| Client/server/test type checks and lint | 0 | Passed |
| Node 22/24 dependency and lockfile integrity | 0 | Passed |
| Server and client coverage enforcement | 0 | Passed |
| Security, route, service, and existing E2E smoke | 0 | Passed |
| Package, container, migration, Pages, repository, environment, docs, and evidence gates | 0 | Passed |
| Aggregate required gate | 0 | Passed |
`);

write(`${evidencePath}/runtime-qa.md`, `# P03-T04 Runtime QA

- Chromium application shell loaded with mocked backend boundaries and passed Axe.
- Keyboard-only mode selection moved focus through the listbox and committed Plan mode.
- Settings opened from the keyboard, trapped focus, closed with Escape, and restored the trigger.
- Asynchronous chat progress and completion updated the polite status region.
- Static-demo contrast rules passed after the two real contrast defects were repaired.
- Failure diagnostics retain screenshots, video, trace, JSON, and HTML output.
- Manual NVDA and broader assistive-technology certification remains explicitly scheduled for P08-T06; the committed P03-T04 checklist defines that human run.
`);

write(`${evidencePath}/results.json`, JSON.stringify({
  taskId,
  status: 'VERIFIED',
  branch,
  implementationCommit,
  verificationCi,
  pullRequest: 161,
  focusedTests: { files: 4, tests: 13, passed: true },
  browserAccessibility: { workflows: 5, passed: true, engine: 'Chromium', scanner: 'Axe' },
  automatedTestsPassed: true,
  runtimeQaRequired: true,
  runtimeQaPassed: true,
  manualChecklistCreated: true,
  manualScreenReaderCertificationDeferredTo: 'P08-T06',
  evidenceGeneratedAt: '2026-08-06T05:40:00Z'
}, null, 2));

write(`${evidencePath}/changed-files.txt`, `.github/workflows/ci.yml
.gitignore
client/package.json
client/playwright.a11y.config.mjs
client/scripts/prepare-a11y-tools.mjs
client/src/App.tsx
client/src/components/AssistantChat.tsx
client/src/components/FileExplorerPanel.tsx
client/src/components/LocalToolsWorkspace.css
client/src/components/LocalToolsWorkspace.tsx
client/src/components/StaticDemo.css
client/src/components/StatusBar.test.tsx
client/tests/accessibility/accessibility-helpers.mjs
client/tests/accessibility/application.a11y.pw.mjs
client/tests/accessibility/static-demo.a11y.pw.mjs
docs/implementation/qa/P03-T04_MANUAL_SCREEN_READER_CHECKLIST.md
docs/architecture/generated/*
docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md
docs/implementation/RELEASE_EVIDENCE_INDEX.md
docs/implementation/evidence/PHASE-03/P03-T04/2026-08-06_bf36479d/*
docs/implementation/handoffs/archive/P03-T04_HANDOFF.md
docs/implementation/handoffs/CURRENT_HANDOFF.md
`);

const handoff = `# P03-T04 Handoff

## Repository state

- Repository: \`DocDamage/chatbot\`
- Branch: \`${branch}\`
- Parent \`main\` commit: \`2545c058b7fea64db529feb0b468f21b63d8aaac\`
- Tested implementation commit: \`${implementationCommit}\`
- Pull request: \`#161\`
- Verification CI: \`${verificationCi}\` — success
- Date: \`2026-08-06\`

## Authorized task

- Task ID: \`P03-T04\`
- Title: Replace fake accessibility testing
- Status: \`VERIFIED\`

## Scope completed

- Replaced the TypeScript-only accessibility alias with a real accessibility test program.
- Added focused keyboard, focus-restoration, live-region, and static-demo tests.
- Added five browser-backed Playwright/Axe workflows for application and static-demo runtime modes.
- Added WCAG, best-practice, and color-contrast scanning.
- Added isolated accessibility tooling and retained failure diagnostics.
- Added the manual NVDA and keyboard verification checklist.
- Repaired the contrast, landmark, heading-order, duplicate-label, and keyboard-scroll defects exposed by the new gate.

## Verification results

- 13 focused accessibility tests passed.
- 5 Chromium Playwright/Axe workflows passed.
- CI \`${verificationCi}\` passed all required jobs and the aggregate gate.
- No gate, threshold, or scanner rule was weakened to obtain the green result.

## Evidence bundle

- \`${evidencePath}\`

## Known boundary

- The manual checklist is committed and repeatable.
- Final human screen-reader certification remains the separate P08-T06 task and is not falsely claimed complete here.

## Next authorized task after merge

- \`P03-T05 — Add real browser E2E testing\`
- GitHub issue: \`#47\`

## NEW THREAD START PROMPT

\`\`\`text
You are working on repository DocDamage/chatbot.

AUTHORIZED TASK ONLY:
P03-T05 — Add real browser E2E testing

Read these files before making changes:
1. docs/implementation/handoffs/CURRENT_HANDOFF.md
2. docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md
3. docs/implementation/PRODUCTION_FEATURE_MANIFEST.md
4. the P03-T05 GitHub issue
5. all current E2E, Playwright, runtime-mode, CI, deployment, API-fixture, and browser-smoke files directly relevant to this task

Rules:
- Work only on P03-T05.
- Confirm PR #161 is merged and inspect the exact current main commit before editing.
- Replace the current smoke-only E2E harness with real browser E2E coverage for production-critical workflows.
- Reuse the P03-T04 Playwright installation and diagnostics where appropriate without weakening accessibility coverage.
- Cover success, failure, recovery, persistence, authorization, and degraded/offline behavior wherever applicable.
- Keep TypeScript, accessibility, coverage, security, migration, package, container, and documentation gates intact.
- Do not begin P03-T06 or any later task.
- Record exact commands, exit codes, workflow runs, artifacts, and commit SHAs.
- Create the P03-T05 evidence bundle, update tracker/index, archive/replace the handoff, and end the thread.

Completion requires committed evidence. End the thread after P03-T05 is verified or formally blocked.
\`\`\`

## Thread closure

This thread is closed. Do not begin P03-T05 here. After PR #161 is merged, start a new thread using the prompt above.
`;
write('docs/implementation/handoffs/archive/P03-T04_HANDOFF.md', handoff);
write('docs/implementation/handoffs/CURRENT_HANDOFF.md', handoff);

const originalPages = execFileSync('git', ['show', 'origin/main:.github/workflows/pages.yml'], { encoding: 'utf8' });
write('.github/workflows/pages.yml', originalPages);
rmSync(join(root, '.github/workflows/p03-t04-finalize-ci.yml'), { force: true });
rmSync(join(root, 'scripts/release/finalize-p03-t04.mjs'), { force: true });
execFileSync('npm', ['run', 'inventory:generate'], { cwd: root, stdio: 'inherit' });
console.log('P03-T04 closeout files generated.');
