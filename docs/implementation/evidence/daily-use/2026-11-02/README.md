# Daily-use setup and local model comparison — November 2, 2026

The personal Windows installation now uses hidden sign-in startup, daily online SQLite
backups at 20:00 America/New_York plus sign-in, bounded retention, integrity manifests,
and temporary restore verification. Registered tasks run as the current user with
limited privileges. A kill-on-close Windows Job Object prevents orphaned Node
processes when a task is stopped. PowerShell 7 is preferred when installed.

The initial fresh-database check exceeded its startup budget while schema statements
committed separately. SQLite schema creation now uses one transaction, with tests for
rollback and successful retry after failed initialization. Startup deadlines and
coverage gates were not raised. Context7 receives one bounded initialization retry;
repeated initialization failures and tool errors are still surfaced.

## Observed local results

| Model | Coding integration cases | Median measured decode rate |
| --- | --- | --- |
| qwen3:8b | 8/9 passed | 59.81 tokens/second |
| qwen3-coder:30b | 9/9 passed | 21.14 tokens/second |

The 8B model produced no file changes in the property-test generation case; the
application correctly refused to claim a successful patch. The 30B model passed
that case, including execution and mutation checks. Ordinary chat remains on 8B;
this PC's ignored `.env` selects 30B for coding. These are fixture outcomes, not a
claim of general autonomous coding correctness.

A separate throughput run used the same three prompts with thinking disabled,
16K context, temperature 0 and seed 42, in reverse model order with other tests
and downloads finished. Generation probes were token-limited and do not score
correctness. Integration timings include tool startup and network lookups.

The live chat suite passed five checks, including actual online backup restoration
into a separate database, restarted application history/document answers, versioned
routes, citations and intentional provider failure. Measured readiness was 5.156 s
on first startup and 2.061 s on restart in the final run. Native process-tree
termination, scheduled backup completion, and the running app's coding model were
checked directly. Future physical Windows sign-in is not claimed as tested.

[Structured evidence](verification.json) includes individual cases, model digests,
source hashes, setup details and limitations. Raw fixtures/logs remain ignored under
`data/coding-tools/daily-use-comparison-final`, `data/coding-tools/daily-use-throughput-idle`
and `data/local-runtime/evaluations`. Backups and private configuration are not committed.

See [daily-use instructions](../../../../DAILY_USE.md) for setup, status, retention,
recovery and removal. Required CI remains a separate check on the exact PR head.
