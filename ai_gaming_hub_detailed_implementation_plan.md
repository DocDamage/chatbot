# AI Gaming Hub — Detailed Implementation Plan (RAG + BMAD + Additions Sets 1–3)

**Context:** You already implemented **RAG** and **BMAD**.  
**Objective:** Turn the hub into an **AI-native, production-grade platform**: consistent world state, deterministic correctness, scalable orchestration, deep continuity, mod support, cost/latency control, provenance, drift control, and rollback safety.

This plan covers **three sets of additions**:

- **Set 1 — Core Runtime Upgrades:** Memory stratification, intent routing, world-state injection, rules engine, canonical enforcement, validation passes, latency/caching, player modeling.
- **Set 2 — Platform & Operations:** Governance, event bus, observability, testing harness, graceful degradation, cost controls, provider abstraction.
- **Set 3 — “Around the System” Survival Layer:** AI contracts, provenance/ownership, mod SDK & sandbox, economy guardrails, expectation management, narrative kill switches, drift control, exit strategy.

---

## 0) Non-Negotiable Principles

1. **Deterministic Core / Probabilistic Shell**
   - *Deterministic:* combat resolution, economy, quest validity, canon state transitions.
   - *Probabilistic:* dialogue, flavor text, optional side content, non-critical variations.
   - AI proposes; the deterministic core decides; AI narrates.

2. **Contracts Over Prompts**
   - Every AI action is bound by an explicit **AI Contract** enforced at the **tool level**.

3. **Graceful Degradation**
   - If AI is slow/down/over-quota, the hub still works (fallbacks, caches, static mirrors).

4. **Provenance & Canon Levels**
   - Every generated artifact is tagged: source, lineage, canon level, and rollback handle.

5. **Observability-First**
   - You must be able to answer: *“What happened, why, and how to reproduce it?”*

---

## 1) Reference Architecture (Service Map)

### 1.1 Request Path (High Level)
**Client → Gateway → Router/Orchestrator → Contract Gate → State Snapshot → (RAG + Memory) → Specialist Agent → Validators → (Rules Engine if needed) → Persist + Provenance → Event Emit → Response**

### 1.2 Core Services
- **Gateway/API**
  - auth, rate limits, quotas, request envelopes, streaming responses
- **Router/Orchestrator**
  - intent classification, agent selection, tool selection, fallback selection
- **Contract & Policy Gate**
  - capability gating, tool permissions, cost ceilings, required validators
- **World State Service**
  - canonical state + player state + timeline flags + scene context
- **Rules Engine**
  - deterministic validators + resolvers (combat/econ/quest transitions)
- **Memory Service**
  - session memory + episodic memory + canonical memory
- **RAG Service (existing)**
  - retrieval, chunking, citations/refs, hybrid retrieval (BM25 + vector)
- **BMAD Layer (existing)**
  - persona/behavior modulation, style/tone constraints

### 1.3 Supporting Services
- **Event Bus**
  - pub/sub of world events for AI triggers, memory writes, analytics
- **Provenance Ledger**
  - content lineage + canon tags + rollback & quarantine
- **Cache Layer**
  - retrieval cache, response cache, pregen pools
- **Testing Harness**
  - simulated players, regression suites, load tests
- **Observability**
  - logs, metrics, traces, audits, alerts
- **Provider Abstraction**
  - model adapters, embedding adapters, fallback stack

---

# SET 1 — Core Runtime Upgrades (Make It Feel “Alive” AND Correct)

## 2) Memory Stratification (Session / Episodic / Canon)

### 2.1 Data Model
- **Session Memory (ephemeral)**
  - last N turns, current scene entities, active goals
- **Episodic Memory (durable, vector)**
  - key decisions, relationship deltas, betrayals, milestones
- **Canonical Memory (durable, deterministic)**
  - world facts, immutable lore, official quest state

### 2.2 Write Pipeline
1. Capture events (from event bus) → `MemoryCandidate`
2. Summarize into:
   - facts summary
   - emotional summary
   - player-centric salience
3. Store:
   - episodic vector record
   - optional canonical update proposal (rules-gated)

### 2.3 Read Pipeline
- Build context bundle per request:
  - session memory slice
  - top-k episodic memories (with filters: timeframe, entities, salience)
  - canonical facts relevant to intent/entities

### 2.4 Acceptance Criteria
- 50+ hour playthrough maintains continuity without prompt bloat
- Repeated NPC interactions reflect relationship history

---

## 3) Intent Routing + Specialist Agents

### 3.1 Intent Taxonomy (Start With This)
- `LORE_QUERY`
- `NARRATIVE_DIALOGUE`
- `QUEST_SUGGESTION`
- `QUEST_VALIDATION`
- `COMBAT_EXPLANATION`
- `BUILD_OPTIMIZATION`
- `SYSTEMS_DESIGN`
- `MOD_VALIDATION`
- `PLAYER_SUPPORT`

### 3.2 Orchestrator Responsibilities
- classify intent
- attach contract
- choose state snapshot type
- choose retrieval strategy
- choose memory slices
- choose specialist agent prompt + toolset
- choose validators + retry policy
- select model + temperature + max tokens
- choose fallback strategy

### 3.3 Acceptance Criteria
- Lower hallucinations vs single-prompt approach
- Cost reduction via smaller, targeted context windows

---

## 4) World State Injection (Reality Discipline)

### 4.1 Snapshot Builder
Construct a minimal snapshot:
- scene id, region id
- quest flags & objectives
- NPC states: alive/dead, faction, disposition
- player reputation, inventory summary, build archetype
- timeline flags, world corruption level, etc.

### 4.2 Injection Rules
- Inject as structured JSON (or typed object) into the agent context
- Never let the agent “guess” state that exists deterministically

### 4.3 Acceptance Criteria
- AI cannot resurrect dead canon NPCs in canon mode
- AI never contradicts active quest flags

---

## 5) Deterministic Rules Engine (Combat/Econ/Quest)

### 5.1 Design
- `validate_action(action, state)` → allow/deny + reasons
- `resolve_action(action, state)` → deterministic outcome + state diff
- AI generates an **Action Proposal** object; rules engine resolves; AI narrates.

### 5.2 Start Small
- v1: quest transitions + basic economy guardrails
- v2: combat resolution + loot tables + cooldowns
- v3: faction rep & relationship deltas

### 5.3 Acceptance Criteria
- Combat, economy, and quest progress remain stable under randomness

---

## 6) Lore Locking & Canon Enforcement

### 6.1 Canon Levels
- `IMMUTABLE` (never changes)
- `CANON` (official, rules-gated changes)
- `PLAYER_CANON` (persists per save/user)
- `NONCANON` (sandbox content)
- `QUARANTINED` (hidden until reviewed)

### 6.2 Validation
- entity existence and identity
- timeline consistency
- faction constraints
- “no new gods” type policies (per contract)

### 6.3 Failure Behavior
- reject & regenerate
- degrade to non-canon mode (if contract allows)
- or respond with uncertainty in-world (“records conflict”)

### 6.4 Acceptance Criteria
- Canon mode blocks unauthorized lore creation

---

## 7) Self-Critique / Validation Pass (Quality Gate)

### 7.1 Validators
- rules validator (calls rules engine)
- lore validator (canon rules)
- tone/voice validator (BMAD compliance)
- safety/permissions validator (contract gate)
- output schema validator (JSON outputs)

### 7.2 Retry Policy
- `max_retries` per intent
- retry with stricter constraints on each attempt
- last fallback: safe template response

### 7.3 Acceptance Criteria
- High-value outputs are checked before being shown to user

---

## 8) Latency + Caching + Pre-Generation

### 8.1 Caches
- retrieval cache (query→chunks)
- response cache (intent+persona+state_hash → response)
- artifact cache (prebuilt banter, hints, lore blurbs)

### 8.2 Pre-Generation Pools
- NPC banter packs per region
- ambient rumors
- short quest hooks
- item flavor descriptions

### 8.3 Streaming
- fast “first paint” reply within target ms
- follow-up enrichment (optional)

### 8.4 Acceptance Criteria
- No immersion-killing stalls for core loops

---

## 9) Player Modeling (Adaptation Without Cheating)

### 9.1 What to Track
- aggression vs diplomacy
- explorer vs rusher
- humor tolerance
- complexity tolerance
- moral boundaries
- exploit tendencies (simulation spamming)

### 9.2 How It’s Used
- dialog length and tone
- quest suggestions and pacing
- difficulty tuning (rules-controlled)
- NPC deception probability (if supported)

### 9.3 Acceptance Criteria
- Hub feels personalized, not random

---

# SET 2 — Platform & Operations (Make It Shippable)

## 10) AI Governance Layer (Capabilities, Flags, Permissions)

### 10.1 Capabilities
Examples:
- `DIALOGUE_GENERATE`
- `QUEST_PROPOSE`
- `QUEST_WRITE_CANON`
- `SIMULATE_OUTCOMES`
- `MOD_SUBMIT`
- `MOD_VALIDATE`
- `EXPORT_CONTENT`

### 10.2 Feature Flags
- per environment (dev/stage/prod)
- per tenant/game mode
- per user tier

### 10.3 Acceptance Criteria
- You can disable risky features instantly without deploy

---

## 11) Event Bus (Make It Event-Driven, Not Polling)

### 11.1 Event Types
- `PLAYER_ENTER_REGION`
- `QUEST_STATE_CHANGED`
- `NPC_RELATIONSHIP_CHANGED`
- `NPC_DIED`
- `ITEM_ACQUIRED`
- `EXPLOIT_DETECTED`
- `CONTENT_QUARANTINED`

### 11.2 Subscriptions
- memory writer service
- analytics
- NPC background sim (optional)
- content pregen

### 11.3 Acceptance Criteria
- AI “reacts” to world changes without reloading everything

---

## 12) Observability & Auditing (Tracing Every Output)

### 12.1 Logs
- request envelope (intent, user, contract version)
- routing decision
- retrieval refs
- memory refs
- tool calls attempted/blocked
- validator results
- final outcome id (artifact/provenance id)

### 12.2 Metrics
- latency p50/p95/p99
- cost/request and cost/user/day
- regen rate
- lore violation rate
- cache hit %
- fallback usage rate
- error rates by provider/model

### 12.3 Acceptance Criteria
- You can answer “why did it do that?” from data, not vibes

---

## 13) AI Testing & Simulation Harness

### 13.1 Test Player Types
- speedrunner
- completionist
- chaos gremlin
- moral saint
- exploit hunter
- lore lawyer

### 13.2 Test Categories
- lore drift regression
- rules compliance regression
- toxicity/tone regression
- load tests (latency & cost)
- cache correctness

### 13.3 Acceptance Criteria
- You catch drift/bugs before players do

---

## 14) Graceful Degradation (Always Playable)

### 14.1 Fallback Stack
- primary model → cheaper model → templates/static mirror
- offline packs for lore + banter + help

### 14.2 In-World Explanations
- archives corrupted
- signal interference
- memory fog

### 14.3 Acceptance Criteria
- Hub remains usable during outages/quotas

---

## 15) Provider Abstraction & Model Adapters (Don’t Get Trapped)

### 15.1 Adapter Interfaces
- `LLMAdapter.generate()`
- `EmbeddingAdapter.embed()`
- `RerankerAdapter.rank()`

### 15.2 Dual-Index Migration Plan
- run new embeddings alongside old
- gradual cutover
- rebuild background tasks

### 15.3 Acceptance Criteria
- You can swap providers without a rewrite

---

# SET 3 — “Around the System” Survival Layer (Control, Ownership, Longevity)

## 16) AI Contract System (The Control Plane)

### 16.1 Contract Schema
- `contract_id`, `version`
- allowed capabilities
- allowed tools
- canon write policy: `NONE | SUGGEST_ONLY | CONFIRM_REQUIRED | DIRECT`
- required validators
- max cost per request
- max latency
- fallback strategy
- content persistence: `NO_PERSIST | EPISODIC_ONLY | CANON_ALLOWED`

### 16.2 Enforcement Points
- gateway (quota/cost caps)
- orchestrator (tool gating)
- validator pass (canon/rules checks)
- persistence layer (provenance tags)

### 16.3 Acceptance Criteria
- Every response and artifact is traceable to a contract version

---

## 17) Provenance Ledger & Content Ownership

### 17.1 What You Store Per Artifact
- `artifact_id`, type
- canon level
- source model + parameters
- prompt hash
- retrieval refs
- memory refs
- contract version
- author: system/user/mod
- status: `ACTIVE | QUARANTINED | DEPRECATED`
- rollback pointer: state snapshot id or diff chain id

### 17.2 Core Operations
- “show lineage”
- “promote to canon”
- “quarantine”
- “rollback batch”

### 17.3 Acceptance Criteria
- You can undo a bad content run safely

---

## 18) Mod & Creator SDK + Sandbox

### 18.1 Key Rule
Mods never access core tools directly.  
They submit through a **Mod Gateway** with strict validation.

### 18.2 Interfaces
- read-only queries (safe)
- submit content proposals
- validate content
- preview sandbox runs
- publish/rollback

### 18.3 Validation
- schema validation
- lore compliance (optional)
- performance/cost bounds
- sandbox execution

### 18.4 Acceptance Criteria
- A malicious mod cannot corrupt canon or spike costs

---

## 19) Economic Guardrails (Anti-Exploit)

### 19.1 Controls
- rate limits per intent
- daily budgets per user tier
- simulation costs (credits/tokens)
- anti-spam detection via telemetry

### 19.2 Design “Sinks”
- costly simulations require spend
- premium generation per day
- limits on loot optimization requests

### 19.3 Acceptance Criteria
- AI features don’t collapse your progression economy

---

## 20) Player Expectation Management (Prevent Betrayal)

### 20.1 UI/UX Signals
- “Authoritative” vs “Speculative” tags
- canon vs sandbox indicators
- confidence meters (optional)
- “requires confirmation” modals for canon writes

### 20.2 Acceptance Criteria
- Players understand what’s real, what’s improv, and why

---

## 21) Narrative Kill Switches & Rollbacks (Emergency Brakes)

### 21.1 Switches
- lock arcs
- freeze NPC evolution
- disable world mutation
- disable mod publishing
- force non-canon mode temporarily

### 21.2 Rollback System
- restore last known good snapshot
- revert by provenance batch id
- quarantine content automatically on high violation rate

### 21.3 Acceptance Criteria
- You can stop a lore infection in minutes

---

## 22) Cultural Drift Control (Tone Regression)

### 22.1 Style Anchors
- canonical voice samples
- banned phrases/patterns
- tone rubric per faction/NPC archetype

### 22.2 Regression Tests
- scheduled prompt suites
- compare outputs to benchmarks
- track “voice similarity” scores

### 22.3 Acceptance Criteria
- NPCs don’t homogenize over time

---

## 23) Exit Strategy (Long-Term Survivability)

### 23.1 Vendor Independence Checklist
- adapters for LLM/embeddings/rerankers
- config-based provider switching
- caching to reduce vendor exposure
- offline mirrors for critical content

### 23.2 Acceptance Criteria
- Provider outage doesn’t kill the hub

---

# 24) Build Plan (Phased Timeline You Can Actually Execute)

## Phase A — Ship-Safe Backbone (Sprint 1–2)
- AI Contract schema + versioning
- Policy Gate middleware for all tool calls
- Observability baseline (logs + metrics)
- World State Snapshot Builder (minimal)
- Validator pass (lore + rules + tone, with retry/fallback)

**Deliverable:** You can run the hub in production without losing control.

---

## Phase B — Reality & Continuity (Sprint 3–4)
- Rules engine v1 (quest transitions + economy)
- Canon levels + lore locking
- Memory stratification (session + episodic v1)
- Narrative compression pipeline v1

**Deliverable:** Long playthrough continuity with stable canon.

---

## Phase C — Quality/Speed/Cost (Sprint 5–6)
- Intent routing + 3–5 specialist agents
- Caching + pregen pools + streaming responses
- Player modeling v1 (behavior metrics)

**Deliverable:** Faster, cheaper, higher quality interactions.

---

## Phase D — Platformization (Sprint 7+)
- Provenance ledger + rollback tooling
- Mod gateway + sandbox + validation
- Economy guardrails & quotas
- Kill switches + drift regression tests
- Provider adapters + migration plan

**Deliverable:** Durable platform that survives scale and chaos.

---

# 25) Definition of Done (Production-Grade Hub)
- ✅ Contract required for every request
- ✅ Tool calls enforced by policy gate
- ✅ Deterministic core validates outcomes
- ✅ Canon enforcement works (no lore drift in canon mode)
- ✅ Memory layers + summarization keep context bounded
- ✅ Latency managed (cache + pregen + fallback)
- ✅ Provenance for every artifact
- ✅ Mods sandboxed + validated
- ✅ Full observability (why/what/how)
- ✅ Kill switches + rollback paths exist
- ✅ Provider exit strategy implemented

---

# 26) Immediate Next Steps (Your “Do This Next” List)
1. Implement **AI Contracts** + policy gate enforcement
2. Add **World State Snapshot Builder** + injection
3. Stand up **Rules Engine v1** (quest + economy)
4. Add **Lore Locking** with canon levels
5. Add **Validator Pass** with retry + fallback
6. Implement **Episodic Memory** write pipeline from event bus
7. Add **Intent Router** + 3 specialist agents
8. Add **Caching + Pregen Pools** for low-latency immersion
9. Implement **Provenance Ledger** + quarantine + rollback
10. Add **Kill Switches** + drift regression tests + provider adapters

---

**End of Plan**
