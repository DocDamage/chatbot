# Dead Code, Supersession, and Legacy Path Audit

Audit date: 2026-08-27
Branch: `codex/cf04-cf10-integration`
Baseline commit: `c6ee81d`

## Purpose and deletion rule

This audit distinguishes code that has lost all responsibility from code that was implemented but never connected. An unreachable module is not a deletion candidate merely because the static graph cannot reach it. Where current plans, feature manifests, or implementation audits establish a runtime intention, the recommended action is to connect the implementation or retain it with an explicit blocker.

Automatic deletion is limited to `SAFE_DELETE`, `SUPERSEDED_DELETE`, and `TEST_ONLY_DELETE` findings with no production, dynamic, compatibility, migration, CLI, certification, or public-package responsibility.

## Baseline production reachability

The repository inventory scanned 1,650 source records and classified 1,108 non-test production modules:

| Measure | Count |
| --- | ---: |
| Production-reachable modules | 817 |
| Unreachable/classified production modules | 291 |
| Unreachable modules with no source importer | 108 |
| Unreachable modules imported only by tests | 43 |
| Unreachable modules sustained only by other unreachable production code | 24 |
| Reachable route declarations | 492 |
| Unreachable route declarations | 10 |

The reachability policy passes because `config/production-boundary.json` has an `unreachable-production-source` catch-all for `src/**` and `client/src/**`. That rule is useful as quarantine, but it is not evidence that the 291 modules are intentionally dormant.

Dynamic use checks covered literal `import()`, `require()`, route-manifest registration, registry construction, provider selection, worker/process spawning, filesystem discovery, package scripts, CI references, evaluation scripts, and historical/release documentation. No general filesystem plugin loader was found for the unreachable agent/tool stubs.

## Findings and dispositions

| Path | Symbol/system | Classification | Current callers | Production reachable? | Test reachable? | Indirect/dynamic use checked? | Old/new relationship or replacement | Risk | Recommended action | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `src/core/providers/local/ExternalLocalModelAdapter.ts` and local provider support | CF-04 external local model | `ACTIVE` | `ServiceInitializer`, `ModelRouter`, `UniversalLLM`, Capability Hub diagnostic, tests | Yes, when `LOCAL_MODEL_ENABLED=true` | Yes | Yes | Intended local provider now uses the normal provider bootstrap and can be selected with `LLM_PROVIDER=local` | Low | **CONNECTED**; retain | `ServiceInitializer` registers a bounded adapter using the existing allowlist, timeout, concurrency, and queue configuration |
| `src/core/gaming/lattice/**` | CF-08 deterministic Lattice engine | `ACTIVE` | `GamingPlaybookService`, mounted gaming router, Gaming Playbook UI, diagnostics, tests | Yes, local mode | Yes | Yes | Deterministic engine is now part of the normal gaming service instead of being diagnostic-only | Low | **CONNECTED**; retain | Mounted `POST /api/gaming/lattice` rejects hosted mode and the client renders the generated playbook |
| `client/src/api/localTools.ts` | Local executable detection/registration/run planning API | `ACTIVE` | `LocalToolDiscoveryPanel`, tests | Yes, local workspace UI | Yes | Yes | Mounted server routes now have a client consumer; planning deliberately stops before process execution/approval | Low | **CONNECTED**; retain | Advanced Workspace exposes discovery, registration, and non-executing run planning |
| `src/core/repository-intelligence/**` | PX-04 repository intelligence facade | `ACTIVE` (unregistered vertical slice) | tests and dead barrels | No | Yes | Yes | Rich PX-04 facade exists beside the simpler live `src/core/project/ProjectIntelligenceService.ts` | Medium | `UNCERTAIN_REVIEW`: retain; connect only with bounded ingestion and response contracts, without replacing the working route blindly | Tracker says `IMPLEMENTED_NOT_VERIFIED`; facade requires callers to supply file contents |
| `src/core/project-memory/**` | PX-05 branch-aware memory | `ACTIVE` (incomplete persistence integration) | tests and dead barrels | No | Yes | Yes | Intended successor to live `.remembrandt` `ProjectMemoryService`; current `ProjectMemoryStore` is in-memory despite “durable” naming | High | `UNCERTAIN_REVIEW`: retain and do not replace the durable live path until persistence/migration semantics are implemented | Tracker requires database ownership/retention; current store has only an in-memory `Map` |
| `src/core/coding/teams/**`, `src/core/browser/**`, `src/core/multimodal/localization/**` | CF-05/06/07 runtime engines | `ACTIVE` / `UNCERTAIN_REVIEW` | contract diagnostics, canaries, tests, some evaluation code | Partial/diagnostic only | Yes | Yes | Intended capability implementations, but authenticated author/approve/resume/cancel UI/API and real process/media adapters remain incomplete | High | **RETAIN** and finish as explicit vertical slices; do not delete or falsely promote contract checks as working runtimes | Authoritative CF audit lists the missing runtime, cancellation, evidence, and safety gates |
| `src/core/capabilities/{evaluation,maintenance,observability,release,reliability,security}/**` | Certification, release, resilience, and security support | `HISTORICAL_RETAIN` / `ACTIVE` | evaluation suites, release evidence tests, capability barrels | Mostly no | Yes | Yes | These are certification/operations infrastructure rather than ordinary request handlers | Medium | **RETAIN** while their implementation tracker is active; do not count them as production features | `MASTER_PRODUCTION_COMPLETION_TRACKER.md` records them as `IMPLEMENTED_NOT_VERIFIED` |
| `src/core/agents/{business,engineering,geography,health,language,legal,music,philosophy,security,story}/` (91 unimported micro-agent/tool files listed below), plus cascading `WikidataEntityTool` | Thin advisor and data-tool stubs | `SUPERSEDED_DELETE` | None | No | No | Yes | Their responsibilities are implemented by the live `*GeniusAgent` classes and deterministic tools constructed in `ServiceInitializer` | Low | **DELETED** after connected feature work and focused tests passed | Reverse graph had zero importers; class-name/string searches found no registry; the only caller of `WikidataEntityTool` was among the deleted stubs |
| `src/core/agents/specialists/WorkflowComponent.ts` and its test | Base class used only by deleted stubs | `TEST_ONLY_DELETE` | Its own test after stub removal | No | Yes | Yes | Live agents do not extend or register this abstraction | Low | **DELETED** with its obsolete test | Recursive caller tracing left no production caller after the stub group was removed |
| `src/server/routes/setup.ts`; `src/core/config/APIKeyManager.ts` | Unmounted provider setup wizard and credential store | `TEST_ONLY` / `SUPERSEDED` | tests and dead `src/core/index.ts` barrel | No | Yes | Yes | Mounted `/api/settings` is the active admin provider configuration path; historical audit explicitly says `/api/setup` remains unmounted | Medium | `UNCERTAIN_REVIEW`: retain during this pass because credential migration/compatibility policy is not documented well enough for deletion | Ten route declarations are unreachable; no client or server mount exists |
| `src/middleware/apiKeyAuth.ts`; `src/core/auth/ApiKeyService.ts` | In-memory API-key authentication generation | `TEST_ONLY` | security tests | No | Yes | Yes | Production routes use JWT/role middleware; no management/bootstrap path can create persistent keys for this middleware | Medium | `UNCERTAIN_REVIEW`: retain until public API compatibility intent is decided; do not wire an in-memory credential authority into production | Only test imports; no route attachment |
| `src/core/index.ts` and dormant subsystem barrels | Package-style core facade | `TEST_ONLY` / `UNCERTAIN_REVIEW` | `CoreExports.test.ts`; path strings in architecture fixtures | No | Yes | Yes | Package `main` is the server and no `exports`/types entry advertises this facade | Medium | **RETAIN** for now; decide whether this repository promises a library API before removing the facade | `ts-prune` reports the facade exports unused, but public-package compatibility cannot be disproven from imports alone |
| `.env.example`; `EnvironmentDefinitions.ts` | `ENABLE_CONTRACTS`, `ENABLE_MEMORY`, `ENABLE_PROVENANCE`, `ENABLE_CACHING` | `SAFE_DELETE` | Definitions/example only | No behavioral checks | Tests cover generated contract generally | Yes | No implementation reads the flags; the represented systems are always constructed through other configuration | Low | **DELETED** | Exact-name search found no runtime read; environment contract validation passes after removal |
| `.env.example`; `EnvironmentDefinitions.ts` | `EUROPEANA_API_KEY`, `SMITHSONIAN_API_KEY`, `SIXSIGMA_ANALYSIS_API_KEY` | `SAFE_DELETE` | Definitions/example and deleted placeholders only | No | Contract validation only | Yes | Configuration remnants of the removed zero-import tools; no active integration reads them | Low | **DELETED** | Exact-name search after cleanup found no runtime, script, or documented integration consumer |
| `MODEL_ROUTING_ENABLED`, `ENSEMBLE_ENABLED` | Deprecated environment aliases | `COMPATIBILITY_RETAIN` | `ConfigValidator` deprecation warnings | Indirectly | Yes | Yes | Deprecated by `ENABLE_MODEL_ROUTING` / `ENABLE_ENSEMBLE` | Low | **RETAIN** warning-only compatibility entries | Explicit `deprecatedBy` metadata |
| `scripts/import-{wikimedia-history,uspto-patents,tmdb-popculture,openlibrary,openalex-science,musicbrainz,loc-history,europeana}.ts` | One-line import placeholders | `SAFE_DELETE` | None | N/A | No | Yes | No implementation; each only printed a future-work message | Low | **DELETED** | Not in package scripts, CI, docs, or another script |
| `scripts/import-wikidata-chrono.ts` and encyclopedia extractors | One-off content generation/migration tools | `HISTORICAL_RETAIN` | Manual only | N/A | No | Yes | Produce committed knowledge artifacts; no evidence proves safe removal from upgrade/rebuild workflows | Medium | **RETAIN** as historical tooling pending owner review | Not package/CI referenced, but performs real file generation |
| `scripts/release/generate-px-evidence.mjs` | Hard-coded evidence generator | `HISTORICAL_RETAIN` | None | N/A | No | Yes | One-off generator tied to a historical commit/branch | Medium | **RETAIN** because release evidence must not be deleted casually | Contains fixed evidence metadata; evidence bundles are governed historical records |
| `scripts/release/check-evidence-schema.mjs` | Standalone evidence validator | `UNCERTAIN_REVIEW` | None found | N/A | No | Yes | Overlaps `check-release-evidence.mjs` but exports a reusable validator | Medium | Retain until the release-evidence owner confirms supersession | No package or CI reference |
| `client/src/**` panels/components other than the local-tools wrapper | React production UI | `ACTIVE` | `App.tsx` -> `LocalToolsWorkspace` -> panels | Yes | Yes | Yes | Navigation is state-based, not URL-router based | Low | **RETAIN** | Every non-test component is reachable from `client/src/main.tsx` after static-build guards |
| `src/server/routes/legacy-chat.ts`, `src/server/routes/v1/**`, `src/server/routes/v2/**` | Parallel chat API generations | `COMPATIBILITY_RETAIN` | Server mount and external clients | Yes | Yes | Yes | Compatibility endpoint plus versioned contracts | High | **RETAIN** | Existing architecture decision assigns removal to P07-T01 |
| Database migrations and migration loaders | Historical schema chain | `HISTORICAL_RETAIN` | Database startup/migration tests | Yes/indirect | Yes | Yes | Old migrations remain required for upgrades | High | **RETAIN** | No migration was classified dead solely from current-schema use |
| Current zero-import production set (17 files listed below) | Dormant leaf modules, public barrels, and build typing | `UNCERTAIN_REVIEW` / `COMPATIBILITY_RETAIN` | None in the static source graph | No | Mixed | Yes | Mixture of build declarations, possible package facades, and incomplete/supersession candidates whose intended replacement is not uniform | Medium | **RETAIN** in quarantine pending owner-specific connection or compatibility decisions | Post-cleanup reverse graph; no dynamic discovery found, but absence of imports alone is insufficient for deletion |
| Current test-only production set (43 files summarized below) | Certification/security helpers, dormant services, compatibility APIs, and utility candidates | `UNCERTAIN_REVIEW` / `HISTORICAL_RETAIN` / `COMPATIBILITY_RETAIN` | Tests only | No | Yes | Yes | Several tests expose missing vertical-slice registration; others protect public or safety contracts | Medium to high | **RETAIN** unless the owning vertical slice is connected or a separate compatibility decision authorizes deletion | Post-cleanup reverse graph reports 43 test-only production modules |
| Remaining unreachable closure (22 dead-only and 114 mixed-import modules) | Incomplete feature slices, evaluation/release infrastructure, and dormant barrels | `UNCERTAIN_REVIEW` / `HISTORICAL_RETAIN` | Other quarantined modules, tests, scripts, or barrels | No request-entrypoint path | Mixed | Yes | Not one uniform obsolete generation; authoritative trackers still require several of these systems | Medium to high | **RETAIN** under quarantine and finish by vertical slice | Recursive reverse graph was checked after deletions; no catch-all boundary classification was treated as proof of legitimacy |

### Exact superseded stub scope

The 91 zero-import stubs are confined to these paths:

- `src/core/agents/business/{FinancialModelBuilder,MarketResearchPlanner,OperationsAdvisor,PricingAdvisor,ProductStrategist}.ts`
- `src/core/agents/engineering/{CadDesignCoach,ElectronicsAdvisor,MechanicalAdvisor,RoboticsPlanner,SafetyChecklist}.ts`
- `src/core/agents/geography/{CultureProfileBuilder,DemographicsAnalyzer,GeopoliticalContextAdvisor,MapContextAdvisor}.ts`
- `src/core/agents/health/{AnatomyTutor,FitnessPlanner,MedicationSafetyAdvisor,NutritionCoach,SymptomTriageGuardrails}.ts`
- `src/core/agents/language/{GrammarExplainer,RhetoricCoach,SpeechCoach,ToneRewriter,Translator}.ts`
- `src/core/agents/legal/{CivicProcessAdvisor,ContractExplainer,LegalGuardrails,LegalIntentClassifier,RightsAndObligationsAnalyzer}.ts`
- `src/core/agents/music/{BeatArrangementCoach,GenreTimelineMapper,MixMasteringAdvisor,MusicPromptEngineer,MusicTheoryAdvisor,SampleWorkflowAdvisor}.ts`
- `src/core/agents/music/{flstudio,logic,protools}/*Coach.ts` and `*Advisor.ts` (18 files)
- `src/core/agents/philosophy/{ArgumentMapper,DebateCoach,EthicsAdvisor,FallacyDetector,PhilosophyTimelineTool}.ts`
- `src/core/agents/security/{DependencyRiskAdvisor,PrivacyRiskAnalyzer,SecureCodeReviewer,SecurityGuardrails,ThreatModeler}.ts`
- `src/core/agents/story/{CharacterDesigner,DialogueCoach,LoreContinuityChecker,PlotArchitect,WorldbuildingEngine}.ts`
- `src/core/tools/audio/StemAnalyzerTool.ts`
- `src/core/tools/culture/{AwardLookupTool,MusicBrainzTool,OpenLibraryTool,TMDBTool}.ts`
- `src/core/tools/flstudio/{FLMixerControlTool,FLPluginParamTool,FLRenderTool,FLTransportTool}.ts`
- `src/core/tools/history/{ChronologyTool,EuropeanaTool,LibraryOfCongressTool,MapContextTool,SmithsonianTool,SourceCriticismTool,WikidataHistoryTool}.ts`
- `src/core/tools/market/{FundamentalsTool,NewsEventTool,TechnicalIndicatorTool}.ts`
- `src/core/tools/science/{GBIFTool,NasaDataTool,WikidataScienceTool}.ts`
- `src/core/tools/sixsigma/AnalysisApiTool.ts`

These files total approximately 900 lines. They were thin wrappers or placeholders, had no importer in the complete baseline 1,650-record source graph, were not named by a string registry, and were not loaded by filesystem discovery. Their live replacements are the domain `*GeniusAgent` implementations and the tool classes those agents instantiate. All 91 were deleted; recursive analysis then identified and removed `WikidataEntityTool`, whose only importers had been in this group.

### Retained zero-import and test-only scope

The 17 current no-import files are: `client/src/vite-env.d.ts`; `src/core/agents/history/HistoricalSourceRanker.ts`; `src/core/agents/index.ts`; `src/core/agents/market/PortfolioAnalyzer.ts`; `src/core/audio/AudioMetadataService.ts`; `src/core/browser/index.ts`; `src/core/chrono/ClaimVerifier.ts`; `src/core/coding/index.ts`; `src/core/gaming/index.ts`; `src/core/knowledge/SmartSourceFactory.ts`; `src/core/learning/ABTester.ts`; `src/core/memory/ForgettingMechanism.ts`; `src/core/memory/MemoryConsolidator.ts`; `src/core/multimodal/VisualSearch.ts`; `src/core/notifications/index.ts`; `src/core/optimization/index.ts`; and `src/core/scheduler/index.ts`. The declaration file and barrels have build/public-facade implications; the concrete classes need owner-level supersession or connection decisions. They were not deleted merely because they have no importer.

The 43 current test-only production modules fall into these reviewed groups:

- capability certification/security infrastructure (16 modules under `src/core/capabilities/**` and `src/core/security/**`);
- creative workspace services (four), personalization/RL/quality services (seven), and other intended vertical slices such as StemDeck and process-failure testing;
- compatibility-sensitive setup/API-key middleware and the `src/core/index.ts`/capability facades;
- standalone utilities/tools (`ToolComposer`, `ValuationTool`, mesh helpers, observability helpers, and `memoize`) whose production intent is not safely resolved by static imports alone.

The exact machine-readable current list and import graph are in `docs/architecture/generated/reachability-map.json`. None of these 43 was automatically removed.

## Route and client trace conclusions

- All manifest router factories are constructed from `registerManifestRoutes`; hosted mode filters local-only entries before construction.
- No exact duplicate method/path declaration exists within a reachable route module.
- The ten unreachable route declarations all belong to the unmounted setup router.
- The client uses state-based Advanced Workspace navigation. All non-test panels are render-reachable; static Pages builds intentionally hide local workspaces.
- Server endpoints may be public/compatibility surfaces even without a current client caller. Such routes were retained unless the router itself is unmounted.

## Feature flags and environment

The generated inventory detects 18 flags that are actually read. Four additional advertised feature flags were inert and were removed. Deployment/security variables were retained unless their complete runtime and compatibility path was disproven. `EUROPEANA_API_KEY`, `SMITHSONIAN_API_KEY`, and `SIXSIGMA_ANALYSIS_API_KEY` were removed after their only tool/script consumers were classified and deleted. `TMDB_API_KEY` remains active through `EntertainmentSource`.

## Dependencies

No dependency is removed solely from a depcheck-style result. Dynamic loads were confirmed for optional media, OCR, browser, scheduling, notification, NLP, and serialization packages. `node-cron`, `twilio`, and `@toon-format/toon` currently support test-only/dormant modules, but those modules have unresolved compatibility or public-facade status in this pass, so the dependencies remain `UNCERTAIN_REVIEW`.

## Baseline gate results

- `inventory:generate`: pass
- `check:inventory`: pass
- `check:reachability`: pass (817 reachable, 291 classified unreachable)
- `check:source-integrity`: pass
- `test:release-tools`: pass (19/19)
- `check:phase2`: blocked at `check:file-size` because `docs/architecture/large-file-register.md` was already stale relative to the current tree. The register was not rewritten before source decisions were made.

## Implemented cleanup and integration results

| Result | Count |
| --- | ---: |
| Repository files initially enumerated | 2,880 |
| Baseline source records inspected by the inventory graph | 1,650 |
| Final source records | 1,549 |
| Confirmed superseded/dead production modules removed | 93 |
| Obsolete production-code tests removed | 1 |
| Dead placeholder scripts removed | 8 |
| Files removed in total | 102 |
| Tracked lines removed | 1,847 |
| Inert feature flags removed | 4 |
| Dead environment variables removed | 3 |
| Intended runtime paths connected | 3 |
| Dependencies removed | 0 |
| Final production-reachable modules | 820 |
| Final isolated/classified production modules retained | 196 |

The 93 removed production modules comprise the 91 original zero-import stubs, the cascading `WikidataEntityTool` orphan, and the test-only `WorkflowComponent`. The three connected paths are external local-model bootstrap/routing, Lattice gaming service/API/UI integration, and local-tool discovery/registration/planning UI integration. No public route, database migration, release evidence, compatibility API, active UI component, active service, or dependency was deleted.

`ts-prune` reports 1,774 remaining unused-export candidates. That output includes type-only exports, public facades, compatibility surfaces, and exports inside intentionally retained quarantined systems; it is recorded as audit input, not a deletion list. The cleanup removed 93 confirmed dead exported production classes.

## Final gate results

- `type-check`, `lint`, `inventory:generate`, `check:inventory`, `check:reachability`, `check:file-size`, `check:env`, `check:docs`, `check:source-integrity`, and `check:phase2`: pass.
- Release tools: 19/19 pass.
- Server release/coverage suite: 405 suites passed, 2,228 tests passed, two skipped; line coverage 89.286%, branch coverage 75.4641%; policy passed.
- Client unit/coverage suite: 52 files and 168 tests passed; line coverage 81.1869%, branch coverage 75.8456%; policy passed.
- Built-server browser suite: 7/7 desktop/mobile scenarios passed.
- Accessibility: 17 unit checks and 6/6 Playwright/Axe scenarios passed.
- Production builds and package smoke: pass.
