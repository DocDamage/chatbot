# Phase 2 Evidence Closeout Plan

## Baseline

- Repository: `DocDamage/chatbot`
- Clean parent commit: `b246190e2498997f100fad845f6fb5811cc1715b`
- Working branch: `agent/phase-02-evidence-closeout`
- Phase 2 implementation commit: `a0d159dd0eff1991a9a7400664e2eef0286e77a2`
- Phase 2 integration commit: `6e1a019f8eccf5154c6a579d02abb188c6911a9e`
- Integration pull request: `#155`
- Green CI run: `31033387341`
- Consolidated evidence: `docs/implementation/evidence/PHASE-02/CONSOLIDATED/2026-08-05_a0d159dd/`

## Objective

Convert the consolidated Phase 2 implementation record into complete, task-specific evidence for P02-T01 through P02-T07 without changing implementation behavior or overstating verification.

## Required task bundles

Each task receives an evidence directory containing:

- `summary.md`;
- `commands.md`;
- `results.json`;
- `changed-files.txt`;
- `runtime-checklist.md`;
- focused test or workflow output where applicable.

## Task mapping

| Task | Primary implementation evidence |
|---|---|
| `P02-T01` | Generated repository inventory, route inventory, environment usage, feature flags, services, providers, tools, database objects, and external binaries |
| `P02-T02` | Reachability map, entrypoint traversal, reachable/unreachable classifications, and deterministic scanner tests |
| `P02-T03` | Production-boundary classifications, hosted-route filtering, legacy/duplicate review, and local-only isolation tests |
| `P02-T04` | 300-line policy checker, generated large-file register, registered exceptions, and no-regression behavior |
| `P02-T05` | Canonical `.env.example`, removal of duplicate template, complete environment contract, and undocumented-variable check |
| `P02-T06` | Typed environment definitions, profile-aware configuration validation, diagnostics, and focused configuration tests |
| `P02-T07` | Release-critical document registry, setup/hygiene documentation, generated-artifact currentness, and link/document validation |

## Verification sequence

1. Re-read PR `#155`, the exact implementation diff, and CI run `31033387341`.
2. Assign every changed file and verification command to one or more P02 tasks.
3. Create the seven task-specific evidence bundles against the exact implementation commit.
4. Run:
   - `npm run test:release-tools`;
   - `npm run check:inventory`;
   - `npm run check:reachability`;
   - `npm run check:file-size`;
   - `npm run check:env`;
   - `npm run check:docs`;
   - `npm run type-check:server`;
   - `npm run type-check:tests`;
   - relevant focused Jest suites;
   - `npm run smoke:package` when required by the task boundary.
5. Record exact commands, exit codes, results, branch, parent SHA, and closeout commit.
6. Update each tracker row only after its evidence is complete.
7. Append verified evidence-index rows only for tasks that satisfy their own exit criteria.
8. Replace and archive the handoff, authorizing exactly one next task.

## Status rule

Until task-specific evidence and applicable QA are complete, every Phase 2 task remains `IMPLEMENTED_NOT_VERIFIED`. The green integration CI proves the implementation passed its automated gates; it does not by itself satisfy the repository's per-task evidence policy.

## Scope exclusions

- No Phase 3 implementation.
- No branch-protection enforcement.
- No weakening, skipping, relabeling, or bypassing CI or release checks.
- No application behavior changes unless a closeout check exposes an actual defect that must be repaired before verification.
