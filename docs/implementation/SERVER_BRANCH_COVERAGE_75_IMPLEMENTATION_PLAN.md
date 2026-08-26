# Server Branch Coverage 75% Implementation Plan

## Status and authority

- Plan status: `IMPLEMENTED_NOT_VERIFIED`
- Planning date: `2026-08-26`
- Integration branch: `codex/cf04-cf10-integration`
- Measured implementation checkpoint: `ab7bd45d414dab94a0f5709e69aa3ca9687c2cd5`
- Coverage report generated: `2026-08-26T22:02:16.993Z`
- Scope: server TypeScript under `src/**/*.ts`, using the existing repository coverage policy and exclusions.
- Objective: raise measured global server branch coverage to at least 75% without weakening coverage scope, deleting legitimate branches, or using ignore directives to manipulate the result.

This document now records both the implementation plan and its local execution result. No task becomes `VERIFIED` until Required CI passes on the exact commit and the remaining runtime/manual certification evidence is retained.

## Implementation checkpoint and result

The branch-coverage implementation is committed at `ab7bd45d414dab94a0f5709e69aa3ca9687c2cd5`. A complete exact-commit run of `npm run test:coverage -- --runInBand` exited normally without `--forceExit` and produced:

| Metric | Starting point | Exact-commit result | Change |
|---|---:|---:|---:|
| Branches | 13,077/20,531 (63.6939%) | 15,432/20,531 (75.1644%) | +2,355 covered arms; denominator unchanged |
| Lines | 29,328/37,435 (78.3438%) | 33,103/37,436 (88.4256%) | +3,775 covered lines; +1 total line |
| Functions | 5,789/7,773 (74.4757%) | 6,640/7,773 (85.4240%) | +851 covered functions; denominator unchanged |
| Statements | 31,442/40,780 (77.1015%) | 35,566/40,783 (87.2084%) | +4,124 covered statements; +3 total statements |

The run passed 406 active suites and 2,202 active tests, with one suite and two tests intentionally skipped. The final denominator requires 15,399 covered branch arms for 75%; this checkpoint clears it by 33 arms. The `branch-75` policy stage is active, all 19 Tier A files remain enforced, and the policy passed.

### Implemented package ledger

| Package | Implemented result |
|---|---|
| `B75-00` | Added a deterministic LCOV/summary branch-gap reporter, unit coverage for its parsing/arithmetic, an npm entry point, machine-readable evidence, and synchronized policy documentation. |
| `B75-01` | Added entrypoint lifecycle/failure matrices and made bootstrap execution depend on `require.main === module`; API-version and conversation-manager seams are exported for behavioral testing. |
| `B75-02` | Added decision matrices across legacy chat, capabilities, knowledge OS, files, local tools, specialist routes, workspace persistence, health/audio/story, game/media, and studio routes. |
| `B75-03` | Added source, ranking, reasoning, importer, ingestion, local-answer, and knowledge-flow matrices across the knowledge subsystem. |
| `B75-04` | Added RAG store, router, retriever, reranker, extractor, trust, audio, and video branch suites, including temporary SQLite and filesystem isolation. |
| `B75-05` | Added tool execution/composition, provider, GIS, safety, SEC, browser, orchestration, capability, and supporting service matrices. |
| `B75-06` | Added website, study, gaming, sprite, media, accessibility, audio, creative, document, and engine-adapter matrices. |
| `B75-07` | Added deterministic long-tail coverage across remaining production-reachable services. The contractual 75% target passed, but the aspirational 76% operating buffer was not reached; the exact report needs 172 more covered arms for 76% at the current denominator. |
| `B75-08` | Added and activated the `branch-75` policy milestone only after the candidate passed it; policy tests cover below-threshold failure, exact-threshold success, and continued Tier A enforcement. |

Local verification also passed `npm run type-check`, `npm run lint`, the complete `npm run release:check` candidate sequence, and `npm run check:phase2`. Release check included server/client coverage enforcement, 7 browser E2E tests, accessibility unit and Chromium/Axe workflows, both production builds, and package smoke. The implementation arrived as one large inherited, quota-exhausted work batch rather than the preferred package-sized commits; it was audited, repaired, verified locally, and checkpointed without rewriting that history.

Required CI has not yet reproduced the result on the exact checkpoint, and the external/native/manual gates in the current handoff remain open. The correct overall status is therefore `IMPLEMENTED_NOT_VERIFIED`.

## Measured starting point

| Metric | Covered | Total | Current | Required by this plan |
|---|---:|---:|---:|---:|
| Branches | 13,077 | 20,531 | 63.6939% | 75.0000% |
| Lines | 29,328 | 37,435 | 78.3438% | At least 75%; no regression |
| Functions | 5,789 | 7,773 | 74.4757% | No regression |
| Statements | 31,442 | 40,780 | 77.1015% | No regression |

At the current denominator, 75% requires at least 15,399 covered branch arms. The mathematical minimum is therefore 2,322 newly covered branch arms. The delivery budget is 2,600 branch arms, which would produce approximately 76.3577% if the denominator remains unchanged. That buffer is intentional: adding small amounts of legitimate production code must not push the candidate back below 75%.

The current enforced policy is Stage 3 (65% lines and 55% branches). All 19 Tier A files currently meet their documented 90% line and 85% branch targets. The existing final global policy target is 75% lines and 65% branches; this plan goes beyond it for branches.

## Non-negotiable rules

1. Do not reduce or replace the locked coverage baseline.
2. Do not add broad coverage exclusions, `istanbul ignore` directives, or test-only production branches.
3. Do not remove reachable production behavior solely to reduce the denominator. Legitimate simplification is allowed only when independently justified and behavior-preserving.
4. Prefer observable behavioral assertions over invoking code merely to mark it covered.
5. Mock external boundaries—HTTP, child processes, time, native runtimes, databases—not the decision logic being tested.
6. Every timer, interval, socket, server, child process, temporary directory, mock, and environment mutation must be restored or closed in `afterEach`/`afterAll`.
7. Do not reintroduce `--forceExit`. A coverage run that prints passing tests but does not exit is a failed gate.
8. Run targeted tests during development, but use only the complete `npm run test:coverage -- --runInBand` report for global progress claims.
9. Recompute the required branch count after every full run because production changes can alter the denominator.
10. Ratchet policy thresholds only after the exact candidate already passes them.

## Measurement and evidence contract

Each work package must capture:

- exact commit SHA;
- exact command and exit code;
- suite/test pass counts;
- global branch covered/total/percentage;
- changed denominator, if any;
- covered-branch gain versus the preceding accepted checkpoint;
- the top remaining uncovered files from `coverage/coverage-summary.json`;
- confirmation that the Jest process exited normally;
- any intentionally deferred branches and the reason they require integration, native, or manual evidence.

The canonical commands are:

```bash
npm run type-check
npm run lint
npm run test:coverage -- --runInBand
npm run check:server-coverage
npm run check:phase2
git diff --check
```

Targeted Jest commands may use `--runInBand` and `--detectOpenHandles`. They must not use `--forceExit` as evidence.

## Coverage opportunity map

The current report contains 7,454 uncovered branch arms. The largest opportunity areas are:

| Area | Total branches | Covered | Uncovered | Current branch coverage |
|---|---:|---:|---:|---:|
| `src/server/routes` | 2,142 | 1,184 | 958 | 55.28% |
| `src/core/knowledge` | 1,694 | 856 | 838 | 50.53% |
| `src/core/tools` | 1,330 | 627 | 703 | 47.14% |
| `src/core/rag` | 1,022 | 602 | 420 | 58.90% |
| `src/core/agents` | 1,229 | 935 | 294 | 76.08% |
| `src/core/capabilities` | 968 | 680 | 288 | 70.25% |
| `src/server` outside routes | 319 | 89 | 230 | 27.90% |
| `src/core/gaming` | 683 | 477 | 206 | 69.84% |
| `src/core/gis` | 390 | 190 | 200 | 48.72% |
| `src/core/website` | 525 | 338 | 187 | 64.38% |
| `src/core/providers` | 675 | 502 | 173 | 74.37% |
| `src/core/study` | 322 | 176 | 146 | 54.66% |

There are 162 measured source files with zero covered branches, representing 1,484 branch arms. They are useful for broadening behavioral coverage, but work should prioritize reachable, deterministic code with meaningful assertions instead of maximizing easy file counts.

## Delivery sequence and branch budget

Branch gains below are minimum planning budgets, not claims of coverage. A package is accepted only from the measured full report.

| Package | Focus | Minimum newly covered branches | Planned cumulative covered branches | Approximate cumulative percentage on current denominator |
|---|---|---:|---:|---:|
| `B75-00` | Measurement tooling and policy synchronization | 0 | 13,077 | 63.6939% |
| `B75-01` | Server entrypoint lifecycle | 150 | 13,227 | 64.4245% |
| `B75-02` | HTTP route decision matrices | 500 | 13,727 | 66.8599% |
| `B75-03` | Knowledge sources, ranking, and answer flow | 450 | 14,177 | 69.0517% |
| `B75-04` | RAG persistence, retrieval, and ingestion | 300 | 14,477 | 70.5129% |
| `B75-05` | Tools, providers, GIS, and safety | 650 | 15,127 | 73.6788% |
| `B75-06` | Website, study, gaming, sprite, and media | 450 | 15,577 | 75.8706% |
| `B75-07` | Long-tail closure and churn buffer | 100 | 15,677 | 76.3577% |
| `B75-08` | Policy ratchet and exact-commit certification | 0 | At least 75% measured | At least 75.0000% |

If a package misses its budget, the deficit carries forward explicitly. Do not declare the package complete based on the number of tests added.

## B75-00 — Measurement tooling and policy synchronization

### Implementation

1. Add a release utility that reads `coverage/coverage-summary.json` and `coverage/lcov.info` and emits a deterministic uncovered-branch report containing:
   - repository-relative path;
   - branch arms covered, total, and uncovered;
   - branch percentage;
   - uncovered branch-arm counts grouped by source line;
   - area rollups such as `server/routes`, `core/knowledge`, and `core/tools`;
   - exact additional covered count needed for 65%, 70%, 75%, and 76% at the current denominator.
2. Add unit tests for Windows and POSIX paths, zero-total files, partial branch arms, missing LCOV records, malformed data, and ceiling arithmetic.
3. Correct `docs/implementation/SERVER_COVERAGE_POLICY.md`, whose narrative still describes Stage 2 even though `config/server-coverage-policy.json` is at Stage 3.
4. Add an npm script such as `report:server-branch-gaps` without changing the existing release command.
5. Store machine-readable progress artifacts under the task evidence directory, not in source-controlled `coverage/` output.

### Acceptance

- Reporter output is deterministic across two runs against the same artifacts.
- Reporter totals exactly equal 13,077/20,531 for the planning baseline.
- Release-tool unit tests and Phase 2 documentation checks pass.

## B75-01 — Server entrypoint lifecycle

### Primary target

`src/server/index.ts` currently has 45/265 covered branches, leaving 220 uncovered. LCOV clusters occur around startup readiness, route registration, endpoint fallback handling, static serving, error handling, and shutdown paths.

### Implementation

1. Extend the existing server index tests to cover:
   - configuration validation success and failure;
   - WebSocket enabled and disabled;
   - service initialization success and rejected initialization;
   - readiness states `initializing`, `ready`, and `failed`;
   - readiness timeout and preserved initialization error message;
   - cached service router reuse and recreation after service reinitialization;
   - API version from header, URL, and default;
   - service-backed endpoints when a service is present and when it is unavailable;
   - API documentation present and missing;
   - upload missing file, missing document manager, processor success, and processor rejection;
   - feedback submission and lookup success/error paths;
   - client distribution present/absent and development/production behavior;
   - server listen success/error and graceful shutdown paths.
2. If module side effects make these paths unsafe to test, extract a dependency-injected app/server factory while retaining the exported `app` and `startServer` contract. Keep the production bootstrap as a thin wrapper.
3. Use fake timers only around bounded readiness tests and always restore real timers.
4. Mock `process.exit` as an assertion target; never allow the test process to terminate.

### Acceptance

- Close at least 150 previously uncovered branch arms in `src/server/index.ts` and adjacent server bootstrap code.
- Server tests exit with `--detectOpenHandles` and without forced termination.
- No route or security middleware is bypassed to make app construction easier.

## B75-02 — HTTP route decision matrices

### Priority files

| File or route family | Current uncovered branches | Required cases |
|---|---:|---|
| `src/server/routes/legacy-chat.ts` | 42 | readiness errors, validation, stream/non-stream, conversation creation/reuse, provider failures, optional metadata |
| `src/server/routes/knowledge-os.ts` | 35 | missing services, invalid identifiers/options, empty results, success, downstream errors |
| `src/server/routes/gaming.ts` | 30 | invalid action/payload, provider unavailable, success and error mappings |
| `src/server/routes/local-tools.ts` | 30 | approval absent/expired/mismatched, scope denial, unavailable runner, success |
| `src/server/routes/capabilities.ts` | 29 | filters, unknown capability, disabled/unready states, dispatch success/failure |
| `src/server/routes/files.ts` | 28 | missing/invalid path, outside-workspace path, absent file, valid result, filesystem error |
| `src/server/routes/health.ts` and `story.ts` | 56 combined | service missing, malformed input, deterministic success, agent failure |
| `src/server/routes/music.ts` | 26 | mode selection, missing provider, invalid inputs, available/unavailable results |
| `src/server/routes/game-studio/gameStudioRoutes.ts` | 26 | caller binding, approval digest mismatch, hosted denial, local success, adapter failure |
| `src/server/routes/settings.ts` | 25 | read/update/reset, invalid values, reinitialize success/failure, auth/CSRF matrix |
| Media accessibility routes | 25 | backend absent, invalid media/options, deterministic fallback, successful backend |
| Engineering/language/security thin routes | 69 combined | missing request fields, valid dispatch, unavailable service, thrown domain error |

### Implementation pattern

For every endpoint, build a compact table-driven matrix covering authentication/role, request validation, dependency readiness, domain outcome, and error mapping. Use `supertest` against the real router with boundary services injected or mocked. Assert response status, schema, meaningful payload fields, and that forbidden domain calls did not occur.

### Acceptance

- Close at least 500 route branch arms.
- Every modified route has success, invalid-input, unavailable-dependency, and thrown-error coverage where those branches exist.
- Security middleware remains active in integration-level route tests.

## B75-03 — Knowledge sources, ranking, and answer flow

### High-value files

- `LocalKnowledgeAnswerer.ts`: 42 uncovered branches.
- `WikipediaSource.ts`: 34 uncovered branches and currently 0% branch coverage.
- `ResultRanker.ts`: 33 uncovered branches.
- `OnlineKnowledgeIngestionService.ts`: 33 uncovered branches.
- `LibraryOfCongressSource.ts`: 32 uncovered branches and currently 0%.
- `ScientificPapersSource.ts`: 32 uncovered branches.
- `EntertainmentSource.ts`: 32 uncovered branches.
- `KnowledgeOnlineFlowService.ts`: 30 uncovered branches.
- `YouTubeSource.ts`: 29 uncovered branches and currently 0%.
- `BookSource.ts`: 27 uncovered branches.
- `ReasoningEngine.ts`, `DocumentationSource.ts`, `KnowledgeFusion.ts`, `MediumSource.ts`, and `BaseKnowledgeSource.ts`: 129 uncovered branches combined and currently 0%.

### Test matrices

1. Source adapters:
   - availability success/failure;
   - default and explicit limit/options;
   - empty, partial, and malformed provider payloads;
   - absolute and relative URLs;
   - optional title/content/author/date/format fields;
   - per-item fetch failure while other results succeed;
   - total provider failure returning the documented safe result;
   - `getById` success and failure.
2. Wikipedia enhanced flow:
   - cache hit, expired cache, and cache miss;
   - query enhancer present/absent/success/failure;
   - ranker present/absent/success/failure;
   - duplicate keys selected from URL, ID, and normalized title;
   - default versus explicit result limits.
3. Ranking/fusion:
   - missing embeddings and zero similarity;
   - ties and deterministic ordering;
   - duplicate source identity;
   - confidence present/absent/out-of-range normalization;
   - empty candidate sets and partial source failures.
4. Answer flow:
   - local-only answer, online fallback, mixed evidence, and no evidence;
   - citation present/missing/duplicate;
   - provider unavailable or throwing;
   - confidence and truncation boundaries.

### Acceptance

- Close at least 450 knowledge branch arms.
- No live network requests occur in unit tests.
- Provider fallback tests assert both the returned contract and the logged/recorded failure classification where exposed.

## B75-04 — RAG persistence, retrieval, and ingestion

### Priority files

- `RAGDocumentStore.ts`: 84 uncovered branches.
- `RAGRouter.ts`: 32 uncovered branches.
- `CorrectiveRetriever.ts`: 31 uncovered branches.
- `VideoRAG.ts`: 27 uncovered branches.
- `EpubExtractor.ts`: 26 uncovered branches.
- `HybridRetriever.ts`: 25 uncovered branches.
- `TrustRAG.ts`: 24 uncovered branches.
- `OfficeExtractor.ts`: 23 uncovered branches.
- `AudioRAG.ts`: 21 uncovered branches.
- `ReRanker.ts`: 19 uncovered branches.

### RAGDocumentStore cases

1. Empty chunk save and one/multiple source groups.
2. Caller-provided and generated run IDs.
3. Chunk with/without embedding and configured persistence batch sizes.
4. SQLite and PostgreSQL query construction and retrieval behavior.
5. Keyword search: empty tokens, FTS success, FTS failure with LIKE fallback, filters accepted/rejected.
6. Vector search: empty vector, SQLite, PostgreSQL, and malformed/absent stored vectors.
7. Hybrid search: keyword-only, candidate-scoped vector search, enabled full scan, disabled full scan, duplicate result merge, and top-K truncation.
8. Source listing: search/no search, OCR filter, duplicate filter, post-filter pagination, empty counts, and metadata stored as JSON/string/null.
9. Source record normalization: title/author/date fallbacks, warning formats, extensions, citation labels, duplicate keys/counts, and incomplete latest-run fields.
10. OCR classification: non-PDF, explicit flags, blocked/failed OCR status, matching warnings, and clean PDF.

### Remaining RAG cases

- router validation, dependency absent, success, and retriever errors;
- corrective retrieval sufficient/insufficient confidence and retry exhaustion;
- hybrid score combinations and deterministic ties;
- extractor valid, empty, malformed, encrypted/unsupported, backend-missing, and thrown-parser paths;
- audio/video unavailable backend contracts without fabricated output.

### Acceptance

- Close at least 300 RAG branch arms.
- Exercise both database dialects without requiring an external database.
- Preserve all safe unavailable/error contracts for optional native backends.

## B75-05 — Tools, providers, GIS, and safety

### Tools

Prioritize `WebSearcher.ts` (29 uncovered), `CodeExecutor.ts` (23), `RepoTools.ts` (20), `FitnessPlanTool.ts` (15), `SymPyTool.ts` (14), `ValuationTool.ts` (14), `ToolComposer.ts` (14), `ToolRegistry.ts` (14), and `FunctionCaller.ts` (14).

- Test WebSearcher provider selection, no-key behavior, timeouts, malformed results, deduplication, filtering, and all-provider failure.
- Test CodeExecutor disallowed/unsupported languages, every security-pattern family through representative cases, filesystem-operation denial, Python/JavaScript process success, nonzero exit, spawn error, timeout, stderr-only output, and cleanup failure. Mock process spawning for branch tests; retain a separate constrained smoke if required.
- Test repository path allow/deny, missing files, binary/text handling, result limits, and command capability denial.
- Use table-driven tests for tool schemas, optional/default parameters, numeric boundaries, invalid enum values, result formatting, and thrown handler errors.

### Providers

Prioritize `UniversalLLM.ts` (30 uncovered), `StableDiffusionAdapter.ts` (30 and currently 0%), `OllamaAdapter.ts` (18 and 0%), `HuggingFaceAdapter.ts` (16 and 0%), `VisionAdapter.ts` (14), and `DeviceAdapter.ts` (12).

- Cover backend absent, unsupported capability, health-check success/failure, normal response, empty/malformed response, timeout, cancellation, and provider error normalization.
- Cover default options separately from explicit zero/false/empty values so truthiness fallbacks cannot mask caller intent.
- Assert that unavailable image/vision/model backends never fabricate success artifacts.

### GIS

Prioritize `GISService.ts` (33 uncovered), `CensusGeocoder.ts` (31 and 0%), `GeoJSONValidator.ts` (27), `OSRMRoutingProvider.ts` (22 and 0%), `ArcGISFeatureServiceProvider.ts` (21 and 0%), `SpatialAnalysisService.ts` (18), and `LayerImportService.ts` (17).

- Cover provider registry hit/miss, cache hit/miss/expiry, privacy rounding, valid/invalid coordinate ranges, all GeoJSON geometry types, malformed nesting, route/geocode empty and error responses, pagination, optional query parameters, and import size/type failures.

### Safety

Prioritize `ApprovalPolicy.ts` (24 uncovered), `UncertaintyQuantifier.ts` (21), `SandboxController.ts` (16), and `SelfCheckSafety.ts` (12).

- Cover every approval decision class, expired/missing/mismatched identity and digest, hosted/local differences, exact path containment including sibling-prefix attacks, evidence absent/present, uncertainty boundaries, and fail-closed exception paths.

### Acceptance

- Close at least 650 branch arms across these four areas.
- Safety and execution tests include negative assertions proving denied work was not executed.
- All spawned-process and timeout mocks are cleaned up; targeted suites pass with `--detectOpenHandles`.

## B75-06 — Website, study, gaming, sprite, and media

### Website work

Target `WebsiteWorkspaceService.ts` (34 uncovered), `BlockEditorEngine.ts` (29), `WebsiteProjectModel.ts` (29), `SourceLinkInspectionService.ts` (17), `ElementInspectorService.ts` (16), and `WebAccessibilityAuditor.ts` (12).

Cover workspace create/open/missing/conflict, path confinement, malformed manifests, empty/duplicate blocks, breakpoint selection, source-link allow/deny and fetch failures, element lookup ambiguity, undo/redo boundaries, import/export collisions, and accessibility rule pass/fail/not-applicable outcomes.

### Study work

Target `StudyStudioService.ts` (34 uncovered), `QuizEngine.ts` (22), `SocraticDebateEngine.ts` (16), `StructuredNotesEngine.ts` (16), `ExamSimulationEngine.ts` (12), and `MasteryModelEngine.ts` (11).

Cover empty and populated collections, invalid IDs, defaults versus explicit options, question-type branches, scoring boundaries, retry/mastery transitions, educator approval required/absent, audio backend unavailable/success, and downstream error propagation.

### Gaming and sprite work

Target `GodotSceneMutator.ts` (23 uncovered), `GodotProjectInspector.ts` (19), Unity/Unreal adapters (36 combined), `LatticeVisualizer.ts` (17), `GodotProjectManifest.ts` (15), `SpriteLabPlanService.ts` (31 and currently 0%), and sprite pipeline finishers.

Cover hosted denial, workspace confinement, missing/corrupt project files, version differences, dry-run versus approved mutation, digest mismatch, adapter unavailable, partial output, collision/overlap, undo/redo boundaries, empty sprite inputs, slicing modes, and deterministic export metadata.

### Media work

Target `VideoProcessor.ts`, `AudioLibraryService.ts`, voice/media adapters, and accessibility pipelines. Cover backend availability, unsupported formats, empty streams, metadata defaults, cancellation, timeout, partial progress, safe cleanup, and non-fabricated unavailable responses.

### Acceptance

- Close at least 450 branch arms across these areas.
- Native applications are mocked only at the adapter boundary; contract tests still validate commands, payloads, and failure classification.
- Workspace mutation tests use temporary directories and verify cleanup.

## B75-07 — Long-tail closure and churn buffer

1. Regenerate the uncovered-branch ranking after B75-06.
2. Select deterministic files from the remaining zero-coverage and low-coverage list, favoring production-reachable modules and branch-dense files.
3. Add focused behavioral matrices until at least 100 additional branch arms are covered and the full report is at or above 76% on the then-current denominator.
4. If the denominator has grown, calculate the new count required for both 75% acceptance and the 1-point operating buffer.
5. Do not use barrel-file imports merely to mark module initialization branches; assert exported behavior.

### Acceptance

- Full server branch coverage is at least 76.0% before the policy-ratchet package begins.
- No file that previously met a locked Tier A baseline regresses.

## B75-08 — Policy ratchet and exact-commit certification

### Implementation

1. Add a new global milestone after the existing `final` milestone, named `branch-75` or an equivalently explicit stable identifier, with minimum 75% lines and 75% branches.
2. Extend policy unit tests to prove:
   - 74.9999% branches fails;
   - 75.0000% branches passes when uncovered-count and all other requirements pass;
   - the milestone cannot bypass Tier A enforcement;
   - an unknown or reordered milestone is rejected where ordering matters.
3. Only after a candidate report passes the new threshold, set `activeStage` to the new milestone and update the locked candidate evidence. Do not set the stage in a preparatory commit that is still below target.
4. Update `SERVER_COVERAGE_POLICY.md`, the current handoff, and release evidence with the exact implementation commit and CI run.
5. Run the entire release sequence, not only Jest coverage.

### Required final commands

```bash
npm run release:check
npm run check:phase2
git diff --exit-code -- docs/architecture/generated/
```

Required CI must run the same effective gates against the exact commit. Local success alone keeps the status `IMPLEMENTED_NOT_VERIFIED`.

### Definition of done

- Global server branches are at least 75.0000% in the complete report.
- Covered branch count is at least `ceil(total branches × 0.75)` using the final denominator.
- Lines remain at least 75%.
- All four global metrics and every Tier A file satisfy no-regression checks.
- All 19 Tier A files satisfy 90% lines and 85% branches under enforced final-stage behavior.
- Tests, type-check, lint, release tooling, client/release gates, packaging, and Phase 2 checks pass.
- Jest exits normally with no live coverage child process.
- The policy is ratcheted to 75% branches only after the measured candidate passes it.
- Exact-commit Required CI and immutable evidence are attached before any `VERIFIED` promotion.

## Review checkpoints

At the end of every package, reviewers must answer:

1. Which user-visible or safety-relevant decisions are now asserted?
2. How many newly covered branch arms did the full report measure?
3. Did the branch denominator change, and why?
4. Are any new tests coupled to private implementation details unnecessarily?
5. Did any test leave open handles, mutate global environment state, or depend on network/native availability?
6. Did any production refactor alter behavior beyond testability? If yes, where is that behavior reviewed and tested?
7. What are the next ten largest uncovered files after this checkpoint?

## Expected implementation shape

The work should be delivered as small, reviewable commits by package or coherent sub-package. Each commit should contain the relevant tests, any narrowly required testability refactor, and evidence updates. Avoid one final multi-thousand-line test commit: branch-coverage regressions and weak assertions are substantially harder to review when unrelated domains are combined.

The project remains `IMPLEMENTED_NOT_VERIFIED` throughout this plan until B75-08 completes against an exact commit in Required CI and the independent runtime/manual certification gates in the current handoff are also satisfied.
