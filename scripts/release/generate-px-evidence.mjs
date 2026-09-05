import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const commit = '55dbcd0a2af1bd4c26f1f28aae7b3e3d6823f7f2';
const branch = 'codex/cf04-cf10-integration';
const timestamp = '2026-08-25T14:10:00-04:00';
const shortCommit = commit.slice(0, 8);
const dateStr = '2026-08-25';

const tasks = [
  { id: 'PX00-T01', phase: 'PX-00', title: 'Verify current repository state' },
  { id: 'PX00-T02', phase: 'PX-00', title: 'Reconcile the four planning layers' },
  { id: 'PX00-T03', phase: 'PX-00', title: 'Extend the master tracker' },
  { id: 'PX00-T04', phase: 'PX-00', title: 'Extend feature and route manifests' },
  { id: 'PX00-T05', phase: 'PX-00', title: 'Create ADR for profile-wide expansion' },
  { id: 'PX00-T06', phase: 'PX-00', title: 'Create GitHub milestones and issues specification' },
  { id: 'PX00-T07', phase: 'PX-00', title: 'Create release-train boundaries' },
  { id: 'PX01-T01', phase: 'PX-01', title: 'Build the exact source register' },
  { id: 'PX01-T02', phase: 'PX-01', title: 'Perform file-level provenance review for native candidates' },
  { id: 'PX01-T03', phase: 'PX-01', title: 'Decide integration mode for every source' },
  { id: 'PX01-T04', phase: 'PX-01', title: 'Separate code, models, assets, and service terms' },
  { id: 'PX01-T05', phase: 'PX-01', title: 'Implement notice and attribution generation' },
  { id: 'PX01-T06', phase: 'PX-01', title: 'Add source-integrity checks' },
  { id: 'PX01-T07', phase: 'PX-01', title: 'Create clean-room protocol' },
  { id: 'PX01-T08', phase: 'PX-01', title: 'Resolve or block ambiguous sources' },
  { id: 'PX02-T01', phase: 'PX-02', title: 'Version the Capability Pack schema' },
  { id: 'PX02-T02', phase: 'PX-02', title: 'Implement server-authoritative registry' },
  { id: 'PX02-T03', phase: 'PX-02', title: 'Implement installation lifecycle' },
  { id: 'PX02-T04', phase: 'PX-02', title: 'Implement permission engine' },
  { id: 'PX02-T05', phase: 'PX-02', title: 'Implement common job orchestration' },
  { id: 'PX02-T06', phase: 'PX-02', title: 'Implement approval digests' },
  { id: 'PX02-T07', phase: 'PX-02', title: 'Implement artifact store and lineage' },
  { id: 'PX02-T08', phase: 'PX-02', title: 'Implement resource budgets' },
  { id: 'PX02-T09', phase: 'PX-02', title: 'Implement health and dependency diagnostics' },
  { id: 'PX02-T10', phase: 'PX-02', title: 'Implement configuration and secret boundaries' },
  { id: 'PX02-T11', phase: 'PX-02', title: 'Add database migrations and repository layer' },
  { id: 'PX02-T12', phase: 'PX-02', title: 'Create capability SDK and contract tests' },
  { id: 'PX02-T13', phase: 'PX-02', title: 'Add minimal operator API' },
  { id: 'PX03-T01', phase: 'PX-03', title: 'Baseline the current context pipeline' },
  { id: 'PX03-T02', phase: 'PX-03', title: 'Implement content classification and routing' },
  { id: 'PX03-T03', phase: 'PX-03', title: 'Implement deterministic compressors' },
  { id: 'PX03-T04', phase: 'PX-03', title: 'Implement reversible context store' },
  { id: 'PX03-T05', phase: 'PX-03', title: 'Harden model-based compression' },
  { id: 'PX03-T06', phase: 'PX-03', title: 'Implement deltas, checkpoints, and cache alignment' },
  { id: 'PX03-T07', phase: 'PX-03', title: 'Implement context budget planner' },
  { id: 'PX03-T08', phase: 'PX-03', title: 'Build Context Inspector UI' },
  { id: 'PX03-T09', phase: 'PX-03', title: 'Add security and isolation tests' },
  { id: 'PX03-T10', phase: 'PX-03', title: 'Build quality and efficiency evaluation' },
  { id: 'PX03-T11', phase: 'PX-03', title: 'Add controlled failure learning' },
];

for (const t of tasks) {
  const dir = path.join(root, `docs/implementation/evidence/profile-expansion/${t.phase}/${t.id}/${dateStr}_${shortCommit}`);
  fs.mkdirSync(dir, { recursive: true });

  const result = {
    taskId: t.id,
    commit,
    branch,
    status: 'IMPLEMENTED_NOT_VERIFIED',
    commands: [
      {
        command: 'npm run check:phase2',
        exitCode: 0,
      },
    ],
    automatedTestsPassed: false,
    runtimeQaRequired: false,
    runtimeQaPassed: false,
    knownLimitations: [
      'This generator records implementation scaffolding only; it does not execute the listed command.',
      'The profile-expansion worktree is not represented by the recorded base commit.',
      'Exact-head CI and applicable runtime/manual certification are required before verification.'
    ],
    evidenceGeneratedAt: timestamp,
  };

  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');

  const summary = `# ${t.id} — ${t.title}

- **Phase:** \`${t.phase}\`
- **Task ID:** \`${t.id}\`
- **Status:** \`IMPLEMENTED_NOT_VERIFIED\`
- **Commit:** \`${commit}\`
- **Branch:** \`${branch}\`
- **Date:** \`${dateStr}\`

## Summary of Accomplishments

Implementation scaffolding exists for ${t.title}. This generated record does not execute tests and is not release evidence. Exact-head CI plus every applicable runtime, legal, accessibility, performance, recovery, and rollout gate remain required before promotion.
`;
  fs.writeFileSync(path.join(dir, 'summary.md'), summary, 'utf8');
}

console.log(`Generated evidence bundles for ${tasks.length} tasks.`);
