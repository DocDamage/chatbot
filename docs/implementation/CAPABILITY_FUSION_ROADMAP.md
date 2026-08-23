# AI Chatbot Hub — Capability Fusion Roadmap

## Purpose

This workstream adds selected capabilities from ten external repositories without turning AI Chatbot Hub into an unsafe monolith or importing incompatible source code.

The repositories are inputs to a capability program, not a bulk merge queue:

- `DocDamage/gitgalaxy`
- `DocDamage/RepoDNA`
- `DocDamage/dev-house`
- `DocDamage/lattice`
- `DocDamage/guaardvark`
- `DocDamage/pydoll`
- `DocDamage/warpdrv`
- `DocDamage/video-dubbing-translator`
- `DocDamage/SearchEngineSuite`
- `DocDamage/RepoRelay`

This roadmap is subordinate to:

- `MASTER_PRODUCTION_COMPLETION_TRACKER.md`
- `PRODUCTION_FEATURE_MANIFEST.md`
- `decisions/ADR-0011-external-capability-integration-boundaries.md`
- the one-task/one-thread/evidence rules in the production-completion plan

Nothing in this document promotes a feature to production support.

## Baseline

At the start of this workstream, AI Chatbot Hub already contains:

- provider abstraction and local/hosted deployment profiles;
- repository language, manifest, build-system, symbol, and relationship analysis;
- structural retrieval and adaptive context allocation;
- coding plan, review, structured patch, verification, and repair stages;
- allowlisted local command execution behind mode and approval controls;
- file, document, audio, image, video, RAG, browser E2E, and specialist-mode foundations;
- feature-manifest, route-policy, coverage, accessibility, and evidence gates.

The highest-value move is therefore to strengthen common boundaries and add replaceable providers. Duplicating entire UIs, servers, agent frameworks, or databases would reduce quality.

## Source assessment

License observations were made from the reviewed repository state on 2026-08-23 and must be rechecked against the exact revision used by an implementation task.

| Repository | Capability family | License boundary | Recommended use | Initial status |
|---|---|---|---|---|
| RepoRelay | Approved-root repository inspection and fixed handoffs | MIT | Adapt its bounded-access model into the existing coding stack | First foundation |
| RepoDNA | Deterministic repository architecture maps | MIT | Add a schema-versioned native architecture graph provider | High priority |
| SearchEngineSuite | TF-IDF, BM25, phrase, and proximity retrieval | No repository license located | Independently implement algorithms; do not copy source | High priority, clean room |
| GitGalaxy | Repository graph, SAST signals, SARIF, SBOM, risk visualization | PolyForm Noncommercial | Optional external noncommercial adapter or clean-room product concepts | Medium priority |
| Guaardvark | Local routing, worktree swarms, resource scheduling, RAG/media operations | MIT | Select narrow components and contracts; do not merge the whole application | High priority |
| Warpdrv | llama.cpp server management, OpenAI-compatible proxy, local voice/RAG/tools | AGPL-3.0 | Connect to a separately installed OpenAI-compatible service | High priority adapter |
| dev-house | Role-based multi-agent development teams | PolyForm Noncommercial | Clean-room role/capability workflow design or external noncommercial adapter | Medium priority |
| Pydoll | Chrome DevTools Protocol browser automation | MIT | Transparent allowlisted QA and user-approved browser jobs only | Medium priority, restricted |
| Video Dubbing Translator | Transcription, translation, reference voice, reconstruction, optional lip-sync | MIT code plus dependency/model terms | Local staged media job with consent and data-egress controls | Medium priority |
| Lattice | Deterministic agentic isometric game kit | MIT | Optional game-development capability package | Later specialist integration |

## Target architecture

### Capability registry

Every optional capability is represented by a registry record rather than hard-coded UI assumptions.

Minimum record:

```ts
interface CapabilityDescriptor {
  id: string;
  displayName: string;
  version: string;
  source: {
    repository: string;
    revision?: string;
    license: string;
    integration: 'native' | 'external_service' | 'clean_room';
  };
  profile: 'HOSTED' | 'LOCAL_TRUSTED';
  maturity: 'disabled' | 'experimental' | 'preview' | 'supported';
  risk: 'low' | 'medium' | 'high' | 'critical';
  permissions: string[];
  requirements: string[];
  health: CapabilityHealth;
}
```

The server decides availability. The client only renders capabilities returned by the authenticated registry.

### Native modules

Use native TypeScript modules when:

- the source is permissively licensed or independently implemented;
- the behavior belongs in the existing server process;
- resource and security limits are enforceable;
- dependency weight is reasonable;
- tests can run in normal CI.

Initial native candidates:

- approved repository gateway;
- repository architecture graph;
- lexical BM25/phrase/proximity retrieval;
- capability registry;
- provider health and resource-budget contracts;
- typed agent roles and task envelopes.

### External service adapters

Use adapters when:

- the source has strong copyleft or noncommercial terms;
- the service owns native binaries, GPUs, Python environments, or large models;
- process isolation improves recovery and packaging;
- the service already exposes a stable HTTP, OpenAI-compatible, MCP, or CLI boundary.

Every adapter must implement:

- explicit configuration;
- health and capability discovery;
- connect and total timeouts;
- cancellation;
- bounded request and response sizes;
- structured errors;
- version reporting;
- audit events;
- disabled-by-default registration;
- no automatic download or install in the first release.

### Background jobs

Long-running browser, media, indexing, and agent-team tasks use a common job model:

```ts
interface CapabilityJob {
  id: string;
  capabilityId: string;
  ownerId: string;
  state: 'queued' | 'running' | 'awaiting_approval' | 'succeeded' | 'failed' | 'cancelled';
  stage: string;
  progress?: number;
  inputDigest: string;
  approvalDigest?: string;
  resourceBudget: ResourceBudget;
  artifacts: JobArtifact[];
  error?: SafeJobError;
}
```

Approval is invalidated whenever approved inputs or actions change.

## Workstream CF-00 — Governance and approved repository boundary

### Objective

Create the common legal and filesystem boundary before importing richer repository intelligence.

### Deliverables

- Accepted ADR-0011.
- Capability source/license register.
- `ApprovedRepositoryGateway` with one canonical root.
- Agent-facing list/read/search/reference/import/symbol tools routed through the gateway.
- Traversal, absolute-path, null-byte, secret, symlink/junction, binary, and resource-limit tests.
- No added command, Git mutation, or arbitrary write authority.

### Production-plan mapping

- P04-T05 — Harden file browsing and workspace access.
- P07-T05 — Coding workflow.
- P07-T06 — File Explorer, when the same boundary is adopted there.

### Exit gate

- Focused and full CI pass.
- Generated inventory is updated.
- A clean Linux CI test proves symlink containment.
- Windows junction behavior is verified before local-support promotion.
- Feature remains `LOCAL_ONLY_EXPERIMENTAL`.

## Workstream CF-01 — RepoDNA architecture graph

### Objective

Turn the current symbol and relationship data into a deterministic, queryable repository architecture model.

### Native contract

```ts
interface RepositoryArchitectureSnapshot {
  schemaVersion: string;
  repositoryVersion: string;
  generatedAt: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  evidence: ArchitectureEvidence[];
  parserHealth: ParserHealth[];
  limits: AppliedResourceLimits;
  warnings: ArchitectureWarning[];
}
```

### Required node types

- repository;
- project root;
- package/module;
- file;
- symbol;
- API route;
- database table/migration;
- test;
- build target;
- external dependency.

### Required edge types

- contains;
- imports;
- calls/references;
- implements/extends;
- tests;
- registers route;
- reads/writes table;
- builds;
- depends on.

### Deliverables

- Schema-versioned JSON snapshot.
- Stable IDs derived from normalized repository paths and symbol locations.
- Incremental cache keyed by file digest and parser version.
- Query API for neighborhood, reverse dependencies, test impact, and entrypoint reachability.
- Export suitable for a future 2D/3D graph UI without coupling analysis to rendering.
- Golden fixtures for TypeScript, JavaScript, Python, C/C++, Go, Rust, Lua, Svelte, CSS/Tailwind, and mixed monorepos.

### Limits

- maximum files, bytes, symbols, and edges;
- cycle-safe traversal;
- no code execution during analysis;
- generated/vendor exclusion with explicit override;
- deterministic output for identical input.

### Exit gate

- Snapshot determinism test passes across repeated runs.
- Path and user/project isolation tests pass.
- Parser confidence and fallback state are visible.
- Large-repository stress fixture remains within the documented budget.

## Workstream CF-02 — Clean-room lexical and hybrid retrieval

### Objective

Add independently implemented BM25, phrase, and proximity retrieval to complement vector and structural retrieval.

### Design

- Do not copy SearchEngineSuite source without permission or a license.
- Implement from published algorithm definitions and project-owned tests.
- Store token positions only when proximity search is enabled.
- Use immutable index generations and atomic activation.
- Preserve source path, line range, digest, repository version, and access scope.

### Retrieval fusion

Candidate results are normalized and fused from:

1. exact path and symbol match;
2. BM25 lexical score;
3. phrase/proximity score;
4. structural-neighborhood score;
5. vector similarity;
6. test/diagnostic relevance;
7. authority and freshness policy.

The model receives individual evidence scores and reasons; it does not receive an unexplained aggregate only.

### Deliverables

- `LexicalRetrievalProvider` interface.
- TypeScript reference implementation.
- Incremental index updates.
- phrase and configurable proximity queries;
- hybrid rank fusion;
- query explain output;
- deleted/renamed file handling;
- performance benchmark against the existing repository search.

### Exit gate

- Golden ranking thresholds pass.
- No cross-repository or cross-user result leakage.
- Index corruption has a rebuild path.
- Search cancellation and resource caps pass.

## Workstream CF-03 — Repository risk, SARIF, SBOM, and visualization data

### Objective

Add security and architecture outputs inspired by GitGalaxy without copying noncommercial source.

### Deliverables

- Provider-neutral finding schema with evidence and confidence.
- Semgrep/SARIF ingestion adapter rather than a homegrown claim of vulnerability proof.
- CycloneDX SBOM generation through approved tooling.
- secret, dependency, route-policy, and dangerous-capability findings.
- graph overlays for hotspots, ownership, churn, test gaps, and trust boundaries.
- explicit distinction among signal, suspected weakness, confirmed defect, and accepted risk.

### UI direction

Start with an accessible 2D graph/table pair. A 3D galaxy view is optional and cannot be the only way to inspect findings.

### Exit gate

- Findings link to exact evidence.
- False-positive suppression is scoped and audited.
- SARIF/SBOM schemas validate.
- No noncommercial source enters the MIT tree.

## Workstream CF-04 — Local model and resource adapter layer

### Objective

Connect to Warpdrv and selected Guaardvark-style local routing capabilities without embedding either full application.

### Deliverables

- Generic OpenAI-compatible local endpoint adapter.
- Endpoint allowlist limited to loopback/private configured hosts in `LOCAL_TRUSTED`.
- model discovery and capability probing;
- per-model context, tool, vision, embedding, and streaming metadata;
- health, startup-unavailable, overloaded, and version-mismatch states;
- resource budget schema for VRAM, RAM, CPU, concurrency, and queue length;
- routing policy for quality, privacy, latency, and resource fit;
- visible fallback reason and provider identity.

### Warpdrv boundary

- User installs and operates Warpdrv separately.
- AI Chatbot Hub talks to its OpenAI-compatible endpoint.
- No Warpdrv source is copied into the MIT repository.
- No silent llama.cpp compilation, binary download, or server process launch.

### Guaardvark boundary

Selected MIT concepts/modules may be adapted only after a file-level provenance review. Prefer project-owned provider contracts over importing its application shell, databases, or UI.

### Exit gate

- Adapter contract tests pass.
- Real local canary passes on documented hardware.
- Cancellation and overload behavior pass.
- Hosted mode rejects local endpoint and process-management controls.

## Workstream CF-05 — Typed agent teams and isolated worktrees

### Objective

Add controlled parallel development teams using selected Guaardvark patterns and clean-room dev-house concepts.

### Roles

Initial roles are capabilities, not personalities:

- repository analyst;
- planner;
- implementer;
- test author;
- reviewer;
- security reviewer;
- integration supervisor.

### Controls

- explicit task envelope and success criteria;
- minimum tool set per role;
- one branch/worktree per mutation worker;
- no shared uncommitted workspace;
- maximum agents, tokens, time, commands, and disk;
- immutable approval digest for mutations;
- stop-all control;
- failure propagation and partial-result reporting;
- supervisor cannot bypass merge review;
- deterministic handoff artifacts.

### Deliverables

- `AgentTeamCoordinator` interface.
- task graph and dependency scheduler;
- worktree lifecycle service;
- conflict detection;
- result/review bundle;
- budget and cancellation UI;
- single-agent fallback.

### Exit gate

- Concurrent workers cannot write outside their worktrees.
- Cancellation terminates child process trees.
- Conflicting patches remain unmerged.
- Every merged change records reviewer and verification evidence.

## Workstream CF-06 — Transparent browser jobs

### Objective

Use safe CDP automation patterns for browser QA and user-authorized workflows.

### Explicit exclusions

The product will not provide CAPTCHA bypass, fingerprint spoofing, stealth/anti-detection, proxy rotation for evasion, or access-control bypass.

### Deliverables

- `AuthorizedBrowserJob` contract;
- target-origin allowlist;
- separate browser profile and download directory;
- navigation, redirect, response-size, and download limits;
- screenshot/DOM/network evidence for test runs;
- approval before form submission, upload, purchase, post, or account mutation;
- cancellation and browser-tree cleanup;
- Playwright remains the default release-test runner;
- optional Pydoll adapter is local-only and disabled by default.

### Exit gate

- Disallowed origins and schemes fail closed.
- State-changing action approval is digest-bound.
- Credentials and browser storage are redacted from evidence.
- No stealth capability is registered.

## Workstream CF-07 — Local media localization and dubbing

### Objective

Expose an inspectable, consent-aware video localization job.

### Stages

1. preflight and consent confirmation;
2. media validation and safe workspace creation;
3. audio extraction;
4. optional source separation;
5. transcription and alignment;
6. transcript review;
7. translation with explicit local/remote provider label;
8. reference-voice synthesis with consent record;
9. timing fit;
10. reconstruction;
11. optional lip-sync in a separate worker;
12. output review and cleanup.

### Deliverables

- Python worker adapter with versioned JSON messages;
- progress, pause where supported, cancellation, and resumable stages;
- duration, pixel, audio, disk, model, and GPU limits;
- explicit Google-translation data-egress warning for the reviewed upstream path;
- optional local translation provider before broader support;
- multi-speaker limitation surfaced;
- third-party model/checkpoint notices;
- synthetic-media disclosure metadata and user-facing reminder;
- no public unauthenticated endpoint.

### Exit gate

- Short licensed fixture completes on Windows NVIDIA and CPU fallback targets where claimed.
- Temporary files are cleaned after success, error, cancellation, and restart recovery.
- Voice/media consent is stored without retaining unnecessary biometric data.
- Output and external requests are auditable.

## Workstream CF-08 — Lattice game-development capability

### Objective

Add an optional specialist package for deterministic isometric game design and agentic simulation workflows.

### Deliverables

- capability adapter around selected MIT packages;
- scenario/world schema import and export;
- deterministic seed/replay controls;
- simulation budget and pause/step controls;
- visual verification artifacts;
- prompts and playbooks integrated into the existing gaming mode;
- no mandatory coupling between the chatbot core and a game renderer.

### Exit gate

- Deterministic replay fixtures pass.
- Browser rendering remains optional to non-gaming users.
- Package notices and revisions are recorded.
- UI is keyboard accessible and offers nonvisual state inspection.

## Workstream CF-09 — Capability Hub UI

### Objective

Replace scattered hidden integrations with one understandable, role-aware capability surface.

### Sections

- available now;
- needs setup;
- local-only;
- preview;
- disabled by policy;
- unhealthy/degraded.

Each card shows:

- what the capability does;
- where processing happens;
- required software/models/hardware;
- permissions and data egress;
- current health and version;
- estimated resource/cost impact;
- setup/test/disable actions;
- support status and limitations.

Dangerous actions use exact-scope confirmation, not generic consent.

### Exit gate

- Server-side role/profile enforcement matches the UI.
- Setup can be completed without source-code inspection.
- Missing dependencies produce actionable diagnostics.
- Keyboard, screen-reader, zoom, and narrow-viewport checks pass.

## Workstream CF-10 — Evaluation and release certification

### Required evaluation suites

- path containment and secret denial;
- architecture graph determinism and recall;
- lexical/hybrid retrieval ranking;
- provider routing and resource exhaustion;
- agent-team isolation and merge conflict handling;
- browser origin and state-change policy;
- media consent, egress, cancellation, and cleanup;
- deterministic game replay;
- hosted-mode denial of local capabilities;
- sanitized logs and support bundles.

### Promotion rules

A capability may move:

- from disabled to local experimental after focused tests and a local canary;
- from local experimental to preview after complete UI, docs, recovery, and cross-platform evidence;
- to production supported only after all applicable production-plan gates pass on one release candidate commit.

## Recommended implementation order

1. CF-00 approved repository gateway and ADR.
2. CF-01 RepoDNA-style architecture graph.
3. CF-02 clean-room lexical/hybrid retrieval.
4. CF-03 repository findings, SARIF, SBOM, and accessible visualization data.
5. CF-04 external local-model/resource adapters.
6. CF-05 typed agent teams and isolated worktrees.
7. CF-06 transparent browser jobs.
8. CF-07 media localization.
9. CF-08 Lattice game-development adapter.
10. CF-09 Capability Hub UI.
11. CF-10 full evaluation and promotion.

This order puts repository understanding and safety ahead of autonomy. Better context and containment improve every later agent, browser, media, and game-development workflow.

## Definition of done for a fusion task

A fusion task is not complete until it records:

- exact source repository and revision;
- license path and retained notices, or clean-room declaration;
- architecture contract and product profile;
- feature-manifest and route-policy state;
- security and privacy review;
- bounded-resource behavior;
- unit, integration, negative, and runtime tests;
- exact commands and exit codes;
- evidence path and commit SHA;
- known limitations;
- rollback/disable procedure;
- updated handoff with exactly one next authorized task.
