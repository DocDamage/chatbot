# Production Completion Implementation Records

This directory is the authoritative workspace for production-completion governance.

For a user-facing summary, read [`docs/PROJECT_STATUS.md`](../PROJECT_STATUS.md). The repository is locally implementation-complete for its current scope but is not certified for hosted production or public launch.

## Contents

- `MASTER_PRODUCTION_COMPLETION_TRACKER.md` — one row for every authorized task.
- `RELEASE_EVIDENCE_INDEX.md` — verified-task evidence lookup.
- `decisions/` — architecture and release decision records.
- `handoffs/` — current and archived one-task Codex handoffs.
- `evidence/` — exact-commit task evidence bundles.
- `qa/` — reusable manual and automated QA procedures.
- `runbooks/` — operational recovery procedures.
- `threat-models/` — security trust-boundary and abuse-case analysis.

## Task rule

One task ID is authorized per Codex thread. The thread ends after the task is verified or formally blocked, the tracker and evidence are updated, and a fresh handoff authorizes exactly one next task.

Historical release documents do not override this directory's tracker or evidence index.
