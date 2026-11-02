# AI Chatbot Hub â€” Current Project Status

Updated: 2026-11-02 (America/New_York)

## Daily-use automation checkpoint — November 2

Consolidation PR #172 merged into main and obsolete branches were pruned. The daily-use
follow-up adds current-user Windows sign-in startup, daily/sign-in online SQLite backups,
bounded retention, integrity/restore verification and doctor checks. A real restored
backup was reopened by the application and preserved conversation history, document
answers and citations. Windows task stop now owns and terminates the full Node tree.

On the recorded i5-14600K / 48 GB / RTX 3060 12 GB machine, the full local coding comparison
passed 9/9 cases with Qwen3-Coder 30B and 8/9 with qwen3:8b. The selected coding model is
30B; ordinary chat stays on 8B. Idle median decode rates were 21.14 and 59.81 tokens/s.
Review and project verification remain required. See the [daily-use evidence](implementation/evidence/daily-use/2026-11-02/README.md).

The sections below preserve earlier checkpoints. Their old branch names and deferred
evaluation statements describe those dates; the November 2 evidence supersedes them.

## Remaining-work checkpoint

Local work continues on `codex/coding-alias-context`. All five shipped Node dependency trees audit clean. Jest 30 and ESLint 10 remove the original 31 development-tool findings; the full root scan now reports only five low-severity nodes from one deepmerge advisory. Its actual source/CJS code is locally patched and exploit-tested while the scanner count remains visible. Plain clean development/production installs and six native grammar compatibility checks pass. See the [dependency evidence](implementation/evidence/dependency-security/2026-11-01.md).

Implemented locally: transactional versioned SQLite knowledge-bundle install/update; recorded shadow-comparison reports; seven-day coding-job retention, owner-scoped history, and JSON downloads; PDFium/RapidOCR extraction; typography headings; structured EPUB Book Graph input; optional Docling tables/formulas; and a hash-verified Axolotl handoff plus bounded CPU training lifecycle. See [knowledge operations](KNOWLEDGE_OPERATIONS.md) and [document ingestion](DOCUMENT_INGESTION.md). Useful-model fine-tuning and persistent serving registration remain future work.

The previous follow-up checkpoint passed 3,215 server tests (five skipped), 89.1672% lines and 76.2857% branches, all 19 critical-file checks, and 338 DABOOK tests (one skipped). Package build/smoke, repository gates, 24 release-tool tests, and the optional Python dependency audit passed. Jest 30 changes the branch-instrumentation denominator; its percentages are not a direct comparison with the earlier run. The unchanged client production code retains the [original checkpoint's](implementation/evidence/remaining-work/2026-11-01/README.md) historical 206 client tests, eight browser workflows, and six accessibility checks; shared ESLint 10 client lint and the client production build also pass in the follow-up.

Native-PDF geometry and bounded ink crops recover the previously missed equation and produce correct LaTeX for three separate display-math equations. Both tables survive and prose/code controls produce no false positives. Docling conversion runs once per book, with a multi-shard replanning regression. Independent review accepted the renderer/crop fixes. REA passes all eight real isolated API workflows on the existing Node 24.22.1 runtime, including managed analysis, native inventory, actual decompiler output, evidence export, and the chat command. Validation does not change the user's `.env` or private REA job storage. See the [follow-up record](implementation/evidence/remaining-work/2026-11-01/follow-up/README.md).

The earlier deferral of live Ollama evaluation ended with the November 2 daily-use request. That run is recorded separately in the daily-use evidence above.

Current milestone: published-book Docling validation and CPU training integration. Seven selected pages from two published books pass eight target equations, four headings, and two upright table checks; two sideways tables fail. A native-angle warning lowers confidence and blocks their default unreviewed training export; an explicit rotation diagnostic recovers both. All 346 Python tests pass (one skipped). CPU optimization/evaluation and inactive registration pass on explicit fixtures; the actual bridge/review/exporter codepath also runs with a mocked sentence-copying generator, which is protocol proof rather than non-heuristic data-generation proof. Independent review fixes protect candidate identity, rollback, promotion eligibility and base-model provenance. Final packaging/smoke, server/test type checks and lint pass. The isolated full server run passes 3,243 tests (five skipped), 89.1329% lines, 76.3025% branches and all 19 critical-file checks. Native assertions run in a clean Node process. Tracing the HTTP failures found 12.7 seconds of unrelated lazy-router construction; prefix-scoped dispatch fixes the production cold path and passes 90 focused server tests without raising request deadlines. Final repository gates, 24 release-tool tests and the secret scan pass. No useful domain model is claimed. See the [current evidence](implementation/evidence/dabook-validation/2026-11-01/README.md).

## Local coding checkpoint

The alias-context follow-up is on `codex/coding-alias-context`. Automatic JavaScript/TypeScript context selection follows static `tsconfig.json` path aliases and base URLs for dependencies and importing callers/tests. Supporting files remain read-only, and repository access restrictions and context budgets still apply. This is a local coding-context improvement; it does not promote the coding feature to production-supported status.

The server build, test type check, server lint and 45 targeted tests passed at the original alias checkpoint. Two repair tests timed out during the initial broader run; the complete repair suite passed in an isolated rerun. Focused coverage is 97.72% lines / 90.38% branches across context selection and alias resolution. See the [alias-context verification record](implementation/evidence/coding-alias-context/2026-11-01/verification.json) for commands, logs, hashes and scope. Its original 52-finding dependency audit has been superseded by the remaining-work checkpoint above; full release certification remains separate.

The compiler/context upgrade adds automatic task-based source selection, read-only dependencies/callers/tests, TypeScript and fixed ESLint diagnostics before approval, and fast-check test guidance plus seeded regression properties. See the [validation record](implementation/evidence/coding-validation/2026-10-31/verification.json) for the live Ollama, compiler, property-test and browser evidence. Scope remains local JavaScript/TypeScript workflows; full configured verification is separate.

The compiler/context checkpoint originated on `codex/coding-reliability`, extending the daily-use and REA checkpoints. Serena, Aider, ast-grep and Context7 are installed as optional external runtimes and exposed in **Coding workspace**. Aider drafts use local Ollama; Context7 queries its external documentation service. Reviewed application, fresh scoped repair and actual project verification are separate steps.

Reference lookup now follows TypeScript aliases rather than matching text, stale patches are rechecked before application, Node assertion/runtime details reach repair, and absent/skipped checks cannot become a passing result. The [coding verification record](implementation/evidence/coding-tools/2026-10-31/verification.json) includes live model outcomes and intermediate failures. Local 8B model output still requires review and testing; this checkpoint does not establish general autonomous coding correctness. See [setup, workflow and limits](CODING_TOOLS.md).

## Personal daily-use checkpoint

The daily-use checkpoint originated on `codex/daily-use-readiness`, based on `feat/dabook-integration` at `e19cfea`. It prepares the app for a personal local daily-use trial with Ollama. This is a local-use checkpoint, not hosted-production certification.

Implemented changes:

- Normal browser chat and versioned chat use the canonical runtime with the real configured provider.
- Bounded conversation history, attachment content, and persistent conversation variables reach the model prompt.
- Conversation state uses the existing SQLite/PostgreSQL abstraction. The application reports persistence failures instead of silently claiming durable storage.
- History is available in the main UI; reopening a conversation restores its original session ID. New chat creates a separate session.
- Explicit local mode provides short-lived local browser authentication, restricted to the loopback application origin. Other deployment profiles retain their existing authentication requirements.
- Document retrieval does not generate a second answer. SQLite search has a bounded, ranked fallback for natural questions whose framing words are absent from a source.
- Citations resolve to evidence actually supplied to the model and cited in its response. Saved replies preserve source cards and warnings.
- Provider failures return HTTP 503 rather than placeholder answers. Readiness reflects unavailable Ollama models.
- Operational CLI commands run actual checks or inspect the local database. Local bundle installation/update and recorded shadow-report handlers have since been implemented; see the remaining-work checkpoint.
- `setup:local`, `start:local`, `doctor:local`, and `verify:local` provide a repeatable local workflow.

## Verification

Real Ollama verification passed generation, multi-turn recall, document upload/retrieval/citations, actual server restart, versioned APIs, history persistence, and provider-failure behavior using an isolated temporary database. The browser also reopened a conversation after restarting the main server and correctly recalled its project name.

Server/client/test type checks, server/client lint, 198 client tests, six browser accessibility checks, operational CLI smoke, packaging smoke, database backup, and repository policy checks passed. The broad server run passed 2,957 tests and found two outdated test-fixture failures. Both were corrected and their complete suites passed a 25-test rerun with open-handle detection; two additional operational database checks also passed. Seven built-server browser regression tests passed. See [the verification record](implementation/evidence/daily-use/2026-10-30/verification.json) for the exact scope and results.

## Start and maintain

Run `npm run start:local`, then open <http://127.0.0.1:3001>. Use `npm run doctor:local` to inspect readiness and `npm run kb:backup` for a consistent database backup. See [Daily local use](DAILY_USE.md) for configuration, rollback, and limitations.

## Remaining boundaries

DABOOK Phase 5 has local extraction, trainer-handoff and CPU training lifecycle validation. Automatic sideways-table correction, broader book quality, useful pretrained-model training, persistent serving registration and promotion remain separate gates. External editors, voice, media workflows, and other specialist capabilities need separate setup and validation. Hosted deployment and public commercial release remain uncertified. The September handoff's program-completion statement does not establish end-to-end production readiness.

The master production tracker and feature manifest retain their production-release authority; this daily-use work does not promote experimental capabilities or close unrelated production tasks. The earlier Capability Fusion integration remains associated with GitHub PR #171.
