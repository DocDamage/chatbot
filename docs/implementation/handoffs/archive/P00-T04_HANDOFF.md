# P00-T04 Handoff

## Repository state

- Repository: `DocDamage/chatbot`
- Branch: `agent/p00-t04-establish-release-decisions`
- Decision implementation commit: `923d3a14de0c1b6b9b5aab31cd14663869b3dda7`
- Parent commit: `4b10a434f5b60216608da74303d4193bc289e372`
- Date: `2026-08-05`

## Authorized task

- Task ID: `P00-T04`
- Title: Establish release decisions
- Status: `VERIFIED`

## Scope completed

- Added ten accepted ADRs covering every decision required by P00-T04.
- Added an indexed ADR catalog and governance rules.
- Reconciled `docs/DEPLOYMENT_MODES.md` with the accepted decisions.
- Recorded deterministic validation against the exact implementation commit.
- Updated the master tracker and release evidence index.
- Did not start `P00-T05`.

## Files changed

### Decision implementation

- `docs/implementation/decisions/ADR-0001-production-database.md`
- `docs/implementation/decisions/ADR-0002-hosted-and-local-product-boundaries.md`
- `docs/implementation/decisions/ADR-0003-github-pages-purpose.md`
- `docs/implementation/decisions/ADR-0004-supported-llm-provider-boundary.md`
- `docs/implementation/decisions/ADR-0005-supported-file-formats.md`
- `docs/implementation/decisions/ADR-0006-supported-operating-systems.md`
- `docs/implementation/decisions/ADR-0007-redis-deployment-model.md`
- `docs/implementation/decisions/ADR-0008-production-hosting-target.md`
- `docs/implementation/decisions/ADR-0009-experimental-module-support-policy.md`
- `docs/implementation/decisions/ADR-0010-telemetry-and-privacy-policy.md`
- `docs/implementation/decisions/README.md`
- `docs/DEPLOYMENT_MODES.md`

### Evidence and closure

- `docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md`
- `docs/implementation/RELEASE_EVIDENCE_INDEX.md`
- `docs/implementation/evidence/PHASE-00/P00-T04/2026-08-05_923d3a14/`
- `docs/implementation/handoffs/CURRENT_HANDOFF.md`
- `docs/implementation/handoffs/archive/P00-T04_HANDOFF.md`

## Behavior implemented

This task changes governance, not runtime behavior. It establishes these binding release targets:

- PostgreSQL hosted and SQLite trusted-local.
- `HOSTED` and `LOCAL_TRUSTED` product profiles.
- Pages as a static demo only.
- OpenAI hosted and Ollama local as the initial provider targets.
- A narrow file-format target matrix.
- Windows 11 x64 local and Linux x86_64 hosted OS support.
- Private authenticated Redis that is not a system of record.
- A managed Linux OCI hosting architecture.
- Manifest-controlled experimental module lifecycle.
- Data-minimized telemetry and no content analytics by default.

No current feature was promoted to `PRODUCTION_SUPPORTED`.

## Tests added or changed

- Added `docs/implementation/evidence/PHASE-00/P00-T04/2026-08-05_923d3a14/artifacts/validate_decisions.py`.
- Added the committed JSON validation report and decision matrix.
- No application tests were changed because no executable code changed.

## Verification commands and results

| Command or operation | Exit code | Result |
|---|---:|---|
| `python3 docs/implementation/evidence/PHASE-00/P00-T04/2026-08-05_923d3a14/artifacts/validate_decisions.py --repo-root . --json-output docs/implementation/evidence/PHASE-00/P00-T04/2026-08-05_923d3a14/artifacts/validation-report.json` | 0 | 10/10 ADRs passed required-section, metadata, line-count, index-link, and cross-document consistency checks |
| `GitHub.compare_commits(base=4b10a434f5b60216608da74303d4193bc289e372, head=923d3a14de0c1b6b9b5aab31cd14663869b3dda7)` | 0 | One commit ahead; 12 documentation files changed |
| Local Git-blob hash calculation compared with `GitHub.create_blob` results | 0 | All twelve blob IDs matched |

## Runtime QA

- Environment: documentation validation workspace plus connected GitHub repository.
- Required: No.
- Result: Not applicable; executable behavior was not changed.
- Evidence: `docs/implementation/evidence/PHASE-00/P00-T04/2026-08-05_923d3a14/runtime-checklist.md`

## Security and data review

- No secrets, credentials, user data, or machine-specific paths were added.
- The ADRs explicitly default hosted local-tool registration off, require private PostgreSQL/Redis, prohibit content telemetry by default, and require later verification rather than claiming present compliance.

## Known limitations or blockers

- Accepted decisions are not executable enforcement.
- Hosting vendor/region/budget remain for `P11-T01`.
- Provider/model versions and live canaries remain for Phase 6.
- Current Compose, Pages, route registration, logging, analytics, and parser code may not yet comply.
- Existing repository-wide CI and production blockers remain open for later authorized tasks.

## Evidence bundle

- `docs/implementation/evidence/PHASE-00/P00-T04/2026-08-05_923d3a14`

## Next authorized task

- `P00-T05 — Create GitHub milestones and issues`

## NEW THREAD START PROMPT

You are working on repository DocDamage/chatbot.

AUTHORIZED TASK ONLY:
P00-T05 — Create GitHub milestones and issues

Read these files before making changes:
1. docs/implementation/handoffs/CURRENT_HANDOFF.md
2. docs/implementation/MASTER_PRODUCTION_COMPLETION_TRACKER.md
3. docs/implementation/PRODUCTION_FEATURE_MANIFEST.md
4. docs/implementation/decisions/README.md
5. the P00-T05 section of the authoritative production-completion plan

Rules:
- Work only on P00-T05.
- Inspect existing milestones and issues before creating anything.
- Create one milestone per phase and one issue per task without duplicates.
- Use the exact task IDs and titles from the master tracker.
- Every issue body must include objective, permitted scope, dependencies, acceptance criteria, evidence requirements, handoff requirement, file-size rule, and an explicit prohibition against weakening gates.
- Do not alter task definitions or begin implementation work.
- Do not weaken, skip, delete, or bypass tests or release gates.
- Keep generated documentation below 300 lines where reasonably possible.
- Never commit secrets or machine-specific paths.
- Record exact GitHub operations, IDs/URLs, results, and commit SHA.
- Update the master tracker only as required by P00-T05.
- Create the task evidence bundle.
- Replace docs/implementation/handoffs/CURRENT_HANDOFF.md and archive a task-specific handoff.
- End the thread after P00-T05 is verified or formally blocked.
- Do not begin the next task in this thread.

Before writing or creating GitHub objects, report:
1. current branch and commit;
2. files and GitHub objects inspected;
3. existing milestone/issue collision analysis;
4. exact creation/update plan;
5. verification operations.


## Thread closure

This thread is closed. Do not begin another task here. Start a new Codex thread using the prompt above.
