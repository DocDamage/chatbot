# ADR-0011 — External Capability Integration Boundaries

## Status

Accepted

## Date

2026-08-23

## Decision owners

- Repository owner: DocDamage
- Implementation owner: AI Chatbot Hub engineering

## Context

The project will evaluate capabilities from these repositories:

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

They cover repository intelligence, code security, role-based agent teams, game-development tooling, local AI orchestration, browser automation, llama.cpp server management, video localization, lexical search, and bounded repository access. They do not share one license, trust model, runtime, or production maturity level. Treating them as one bulk merge would create license, security, deployment, and maintainability failures.

The AI Chatbot Hub already has provider abstraction, coding workflows, repository inspection, structural retrieval, local tools, media processing, RAG, browser E2E, and feature-manifest controls. New work must strengthen those existing boundaries rather than register duplicate applications or bypass the production-completion plan.

## Decision

### 1. Integrate capabilities, not repositories

No source repository is merged wholesale into AI Chatbot Hub. Each capability receives a narrow contract, feature-manifest record, threat model, tests, runtime boundary, and rollback path.

The preferred order is:

1. extend an existing native service when the source license is permissive and the architecture fits;
2. use a separately installed adapter when process isolation or license separation is preferable;
3. perform a clean-room implementation from public concepts and specifications when source reuse is not permitted;
4. reject the capability when it cannot satisfy the product's security, consent, or support rules.

### 2. Source-license policy

| Source | Observed repository license | Allowed integration path |
|---|---|---|
| RepoRelay | MIT | Native adaptation with retained notices, or optional external MCP adapter |
| RepoDNA | MIT | Native architecture-analysis modules with retained notices |
| Lattice | MIT | Optional game-development capability package with retained notices |
| Guaardvark | MIT | Selected native modules or adapters; no bulk application merge |
| Pydoll | MIT | Transparent, allowlisted browser QA/automation only |
| Video Dubbing Translator | MIT project code; separate dependency/model terms | Local job adapter or selected native orchestration with full third-party notices |
| GitGalaxy | PolyForm Noncommercial 1.0.0 | Optional separately installed noncommercial adapter, or clean-room concepts only |
| dev-house | PolyForm Noncommercial 1.0.0 | Optional separately installed noncommercial adapter, or clean-room role/workflow concepts only |
| Warpdrv | AGPL-3.0 | External OpenAI-compatible service adapter by default; no copied source in the MIT codebase |
| SearchEngineSuite | No repository license located during this review | No source copying; obtain permission or implement BM25/proximity search independently |

Fork ownership does not replace upstream copyright or license obligations. Every copied or adapted permissive source must be entered in the project's third-party notices with repository, revision, files, license, and modifications.

### 3. Product-profile boundary

New capabilities default to `LOCAL_ONLY_EXPERIMENTAL` unless their complete hosted threat model and production verification are finished.

Hosted mode must never start or expose:

- local repository execution;
- arbitrary browser control;
- model-server process management;
- worktree agent swarms;
- voice cloning or media inference workers;
- desktop/game-engine control;
- unrestricted filesystem search.

A hosted-safe read-only service may be promoted only through the production feature manifest and route-policy gates.

### 4. Repository-access foundation

All agent-facing local repository reads and searches use one approved repository root and one shared gateway. The gateway must:

- accept repository-relative paths only;
- reject traversal, absolute paths, null bytes, secret paths, and unsupported file types;
- canonicalize existing paths;
- reject symlink and junction traversal;
- bound files scanned, bytes read, result count, and returned line length;
- distinguish denial, binary content, wrong type, and resource-limit errors;
- expose no shell, Git mutation, or arbitrary write ability;
- keep code execution and patch application behind their existing independent approval gates.

Fixed handoff writers may be added later, but arbitrary source writes must not be smuggled into the read/search gateway.

### 5. Browser-automation boundary

Pydoll-derived work is limited to transparent automation for user-authorized sites and test environments. The product will not implement or expose:

- CAPTCHA bypass;
- stealth or anti-detection modes;
- browser fingerprint spoofing;
- proxy rotation intended to evade controls;
- authentication or paywall bypass;
- scraping that violates authorization or site restrictions.

Browser jobs require an origin allowlist, visible audit trail, bounded navigation/downloads, timeout/cancellation, and explicit approval for state-changing actions.

### 6. Voice and media boundary

Video dubbing and reference-voice synthesis remain local-only until a separate production decision is accepted. The workflow must require the user to confirm rights and consent for uploaded media and voices, identify external text translation before data leaves the machine, preserve synthetic-media disclosure metadata where practical, and enforce upload, duration, storage, cleanup, and GPU limits.

No public unauthenticated dubbing endpoint is permitted.

### 7. Agent-team and worktree boundary

Agent teams use typed roles, capability manifests, isolated worktrees or equivalent sandboxes, bounded concurrency, explicit budgets, cancellation, audit logs, and merge review. A role name is not a security boundary. Every worker receives the minimum tool set required for its task.

Noncommercial source code from dev-house must not be copied into the MIT application. Its public role/workflow ideas may inform an independently implemented design.

### 8. Local-model boundary

Warpdrv may be connected through its OpenAI-compatible endpoint as a separately installed service. The chatbot owns provider configuration, health checks, timeouts, model capability discovery, and user-visible degraded states. It does not silently install, compile, update, or manage third-party model-server binaries in this phase.

Future native llama.cpp process management requires a separate ADR, packaging review, binary provenance verification, resource scheduler, and Windows lifecycle tests.

### 9. Search boundary

The project may add a native bounded lexical retrieval layer using independently implemented BM25, phrase, and proximity algorithms. SearchEngineSuite code cannot be copied without a license or explicit permission. Lexical retrieval supplements, rather than replaces, vector and structural retrieval, and must preserve source provenance and user/project isolation.

### 10. No false support claims

Presence of an adapter, route, or source file does not make a capability production-supported. Each capability remains preview, local-only experimental, or disabled until its vertical-slice, security, accessibility, recovery, and runtime evidence are complete.

## Initial capability contracts

The implementation program will introduce these boundaries incrementally:

1. `ApprovedRepositoryGateway` — bounded repository list/read/search and canonical path enforcement.
2. `RepositoryArchitectureGraph` — deterministic nodes, edges, evidence, schema version, and resource limits.
3. `LexicalRetrievalProvider` — BM25/phrase/proximity results with provenance.
4. `ExternalLocalModelProvider` — OpenAI-compatible local endpoint health and capability contract.
5. `AgentTeamCoordinator` — roles, worktree isolation, budgets, approvals, and merge review.
6. `AuthorizedBrowserJob` — allowlisted transparent browser workflows.
7. `MediaLocalizationJob` — staged transcription, translation, synthesis, reconstruction, and cleanup.
8. `GameDevelopmentCapability` — optional Lattice-backed or adapted game-development services.

Each contract must be provider-neutral so an implementation can be replaced without changing the user-facing product model.

## Alternatives considered

### Bulk merge all ten repositories

Rejected. It would duplicate applications and introduce incompatible licenses, runtimes, trust models, UI systems, and deployment assumptions.

### Copy only the most useful files and address licenses later

Rejected. License provenance and security review must precede source reuse.

### Run every repository as an unrestricted local subprocess

Rejected. This would turn the chatbot into a general process launcher and bypass existing local-tool approvals.

### Reimplement every feature from scratch immediately

Rejected. Permissive modules and stable external APIs can be reused or adapted, while high-risk and incompatible components require isolation or clean-room work.

## Consequences

### Positive

- The chatbot gains capabilities without becoming a collection of inseparable applications.
- License-incompatible source is prevented from silently entering the MIT tree.
- Local-only powers remain unavailable in hosted mode by default.
- Repository, browser, agent, model, and media operations have explicit trust boundaries.
- Providers can be tested, replaced, disabled, or rolled back independently.

### Negative

- Integration takes longer than a direct copy.
- Some source projects can only be used as separately installed tools.
- Clean-room implementations require independent tests and benchmarks.
- Several capabilities remain experimental until hardware and end-to-end evidence exist.

## Security and data impact

This decision reduces path traversal, symlink escape, arbitrary execution, data-egress ambiguity, secret exposure, browser abuse, voice impersonation, and cross-profile registration risk. It does not itself certify any adapter or implementation.

## Verification obligations

Every capability pull request must include, as applicable:

- exact upstream repository and revision;
- license and notice review;
- feature-manifest and hosted/local classification;
- threat model and route policy;
- negative authorization and containment tests;
- bounded resource and cancellation tests;
- dependency-outage and malformed-output tests;
- real local runtime evidence for external services;
- sanitized logs and support diagnostics;
- rollback or feature-disable procedure.

## Unresolved assumptions

- Commercial distribution intent and final legal review are not yet recorded.
- GitGalaxy and dev-house may later offer alternative licensing.
- SearchEngineSuite may later add a license or explicit permission.
- The final local desktop packaging model is not yet selected.
- Hardware-specific media and model-server support remains unverified.

## Superseded decisions

None.
