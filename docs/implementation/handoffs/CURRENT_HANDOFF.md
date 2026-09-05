# AI Chatbot Hub — Implementation Handoff

## Status

- Repository: `DocDamage/chatbot`
- Branch: `codex/cf04-cf10-integration`
- Active Program: Canonical Chat Runtime & Knowledge Platform (`AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md`)
- Current Status: **`CRK PHASES 00 THROUGH 26 & SPECIFICATIONS 31 THROUGH 63` COMPLETED & CERTIFIED — 100% PROGRAM COMPLETION**
- Last Completed Task: `CRK-SPEC-56-63` — Program Completion, Definition of Done, Commands, Evidence, Auditor, Template, Handoff & Prohibited Shortcuts (`VERIFIED & CERTIFIED`)
- Base Commit: `178224d9c5b7891b78f52ddc781a319faeab64de` (`178224d`)
- Exit Gate Evidence:
  - Specifications 56-63: `docs/implementation/evidence/chat-runtime-knowledge/CRK-SPEC/CRK-SPEC-56-63/2026-09-04_178224d/`
  - Specifications 51-55: `docs/implementation/evidence/chat-runtime-knowledge/CRK-SPEC/CRK-SPEC-51-55/2026-09-04_178224d/`
  - Specifications 46-50: `docs/implementation/evidence/chat-runtime-knowledge/CRK-SPEC/CRK-SPEC-46-50/2026-09-04_178224d/`
  - Phase 01: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P01/CRK-P01-T06/2026-09-03_178224d/`
  - Phase 02: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P02/CRK-P02-T05/2026-09-03_178224d/`
  - Phase 03: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P03/CRK-P03-T07/2026-09-04_178224d/`
  - Phase 04: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P04/CRK-P04-T06/2026-09-04_178224d/`
  - Phase 05: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P05/CRK-P05-T07/2026-09-04_178224d/`
  - Phase 06: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P06/CRK-P06-T08/2026-09-04_178224d/`
  - Phase 07: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P07/CRK-P07-T07/2026-09-04_178224d/`
  - Phase 08: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P08/CRK-P08-T05/2026-09-04_178224d/`
  - Phase 09: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P09/CRK-P09-T07/2026-09-04_178224d/`
  - Phase 10: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P10/CRK-P10-T08/2026-09-04_178224d/`
  - Phase 11: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P11/CRK-P11-T07/2026-09-04_178224d/`
  - Phase 12: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P12/CRK-P12-T05/2026-09-04_178224d/`
  - Phase 13: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P13/CRK-P13-T08/2026-09-04_178224d/`
  - Phase 14: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P14/CRK-P14-T10/2026-09-04_178224d/`
  - Phase 15: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P15/CRK-P15-T05/2026-09-04_178224d/`
  - Phase 16: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P16/CRK-P16-T06/2026-09-04_178224d/`
  - Phase 17: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P17/CRK-P17-T05/2026-09-04_178224d/`
  - Phase 18: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P18/CRK-P18-T05/2026-09-04_178224d/`
  - Phase 19: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P19/CRK-P19-T05/2026-09-04_178224d/`
  - Phase 20: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P20/CRK-P20-T06/2026-09-04_178224d/`
  - Phase 21: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P21/CRK-P21-T05/2026-09-04_178224d/`
  - Phase 22: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P22/CRK-P22-T05/2026-09-04_178224d/`
  - Phase 23: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P23/CRK-P23-T05/2026-09-04_178224d/`
  - Phase 24: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P24/CRK-P24-T07/2026-09-04_178224d/`
  - Phase 25: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P25/CRK-P25-T05/2026-09-04_178224d/`
  - Phase 26: `docs/implementation/evidence/chat-runtime-knowledge/CRK-P26/CRK-P26-T09/2026-09-04_178224d/`
  - Specifications 31-35: `docs/implementation/evidence/chat-runtime-knowledge/CRK-SPEC/CRK-SPEC-31-35/2026-09-04_178224d/`
  - Specifications 36-40: `docs/implementation/evidence/chat-runtime-knowledge/CRK-SPEC/CRK-SPEC-36-40/2026-09-04_178224d/`
  - Specifications 41-45: `docs/implementation/evidence/chat-runtime-knowledge/CRK-SPEC/CRK-SPEC-41-45/2026-09-04_178224d/`

---

## Phase Completion Summary

### Phase 01: Canonical Chat Runtime (`CERTIFIED`)
- **`CRK-P01-T01`**: Runtime Schemas defined ([`src/types/chat-runtime.ts`](file:///c:/dev/Chatbot/src/types/chat-runtime.ts), 213 lines, 10/10 tests).
- **`CRK-P01-T02`**: `ChatRequestNormalizer` implemented ([`src/core/chat/ChatRequestNormalizer.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatRequestNormalizer.ts), 279 lines, 21/21 tests).
- **`CRK-P01-T03`**: `ChatRuntime` façade implemented ([`src/core/chat/ChatRuntime.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatRuntime.ts), 266 lines, 5/5 tests).
- **`CRK-P01-T04`**: `ChatRuntimeFactory` implemented ([`src/core/chat/ChatRuntimeFactory.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatRuntimeFactory.ts), 232 lines, 3/3 tests).
- **`CRK-P01-T05`**: Legacy compatibility adapter implemented ([`src/core/chat/ChatRuntimeCompatibilityAdapter.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatRuntimeCompatibilityAdapter.ts), 96 lines, 5/5 tests).
- **`CRK-P01-T06`**: Shadow mode runner & Phase 01 exit gate certified ([`src/core/chat/ChatRuntimeShadowRunner.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatRuntimeShadowRunner.ts), 98 lines, 3/3 tests).

### Phase 02: Bot Profiles and Versioned Configuration (`CERTIFIED`)
- **`CRK-P02-T01`**: `BotProfile` schemas and security boundaries defined ([`src/types/bot-profile.ts`](file:///c:/dev/Chatbot/src/types/bot-profile.ts), 65 lines, 5/5 tests).
- **`CRK-P02-T02`**: `BotProfileRepository` with versioning, diffing, and rollbacks ([`src/core/profiles/BotProfileRepository.ts`](file:///c:/dev/Chatbot/src/core/profiles/BotProfileRepository.ts), 170 lines, 3/3 tests).
- **`CRK-P02-T03`**: `DefaultBotProfile` and modular prompt asset catalog ([`src/core/profiles/DefaultBotProfile.ts`](file:///c:/dev/Chatbot/src/core/profiles/DefaultBotProfile.ts), 93 lines, 3/3 tests).
- **`CRK-P02-T04`**: `BotProfileResolver` with 5-tier precedence and non-weakening policy rules ([`src/core/profiles/BotProfileResolver.ts`](file:///c:/dev/Chatbot/src/core/profiles/BotProfileResolver.ts), 84 lines, 6/6 tests).
- **`CRK-P02-T05`**: REST API routes and Phase 02 exit gate certified ([`src/server/routes/bot-profiles.ts`](file:///c:/dev/Chatbot/src/server/routes/bot-profiles.ts), 98 lines, 5/5 tests).

### Phase 03: Conversation State and Variables (`CERTIFIED`)
- **`CRK-P03-T01 & T02`**: State layers & variable schema ([`src/types/conversation-state.ts`](file:///c:/dev/Chatbot/src/types/conversation-state.ts), 132 lines, 5/5 tests).
- **`CRK-P03-T03`**: `ConversationVariableExtractor` ([`src/core/state/ConversationVariableExtractor.ts`](file:///c:/dev/Chatbot/src/core/state/ConversationVariableExtractor.ts), 195 lines, 5/5 tests).
- **`CRK-P03-T04`**: Deterministic `ConversationStateReducer` ([`src/core/state/ConversationStateReducer.ts`](file:///c:/dev/Chatbot/src/core/state/ConversationStateReducer.ts), 94 lines, 4/4 tests).
- **`CRK-P03-T05`**: `ConversationStateRepository` & `ConversationStateService` ([`src/core/state/ConversationStateRepository.ts`](file:///c:/dev/Chatbot/src/core/state/ConversationStateRepository.ts), 54 lines; [`src/core/state/ConversationStateService.ts`](file:///c:/dev/Chatbot/src/core/state/ConversationStateService.ts), 157 lines, 3/3 tests).
- **`CRK-P03-T06`**: `ConversationContextSelector` ([`src/core/state/ConversationContextSelector.ts`](file:///c:/dev/Chatbot/src/core/state/ConversationContextSelector.ts), 84 lines, 3/3 tests).
- **`CRK-P03-T07`**: Follow-up regression suite & Phase 03 exit gate certified ([`src/core/state/__tests__/conversation-followup-regression.test.ts`](file:///c:/dev/Chatbot/src/core/state/__tests__/conversation-followup-regression.test.ts), 165 lines, 6/6 tests).

### Phase 04: Workflow Engine for Guided Tasks (`CERTIFIED`)
- **`CRK-P04-T01`**: Workflow model & 9 canonical step types ([`src/types/workflow.ts`](file:///c:/dev/Chatbot/src/types/workflow.ts), 114 lines, 4/4 tests).
- **`CRK-P04-T02`**: Resumable `WorkflowStateRepository` ([`src/core/workflow/WorkflowStateRepository.ts`](file:///c:/dev/Chatbot/src/core/workflow/WorkflowStateRepository.ts), 77 lines, 4/4 tests).
- **`CRK-P04-T03`**: Production Coding & Build Workflow ([`src/core/workflow/definitions/CodingBuildWorkflow.ts`](file:///c:/dev/Chatbot/src/core/workflow/definitions/CodingBuildWorkflow.ts), 146 lines).
- **`CRK-P04-T04`**: Production Debug Guided Workflow ([`src/core/workflow/definitions/DebugWorkflow.ts`](file:///c:/dev/Chatbot/src/core/workflow/definitions/DebugWorkflow.ts), 117 lines).
- **`CRK-P04-T05`**: `WorkflowEngine` & `WorkflowResolver` with escape hatch and non-interference bypass ([`src/core/workflow/WorkflowEngine.ts`](file:///c:/dev/Chatbot/src/core/workflow/WorkflowEngine.ts), 176 lines; [`src/core/workflow/WorkflowResolver.ts`](file:///c:/dev/Chatbot/src/core/workflow/WorkflowResolver.ts), 79 lines).
- **`CRK-P04-T06`**: Cryptographic `ToolApprovalService` & Phase 04 exit gate certified ([`src/core/workflow/ToolApprovalBinding.ts`](file:///c:/dev/Chatbot/src/core/workflow/ToolApprovalBinding.ts), 127 lines, 4/4 tests; [`src/core/workflow/__tests__/workflow-engine-integration.test.ts`](file:///c:/dev/Chatbot/src/core/workflow/__tests__/workflow-engine-integration.test.ts), 145 lines, 4/4 tests).

### Phase 05: Context Planner (`CERTIFIED`)
- **`CRK-P05-T01`**: Structured `ContextPlan` & requirement schemas ([`src/types/context-plan.ts`](file:///c:/dev/Chatbot/src/types/context-plan.ts), 100 lines, 3/3 tests).
- **`CRK-P05-T02`**: Deterministic signal extractor ([`src/core/chat/ContextRoutingSignals.ts`](file:///c:/dev/Chatbot/src/core/chat/ContextRoutingSignals.ts), 145 lines).
- **`CRK-P05-T03`**: Optional bounded classifier with safe fallback ([`src/core/chat/ContextClassifier.ts`](file:///c:/dev/Chatbot/src/core/chat/ContextClassifier.ts), 56 lines).
- **`CRK-P05-T04`**: Explicit no-retrieval path & `ChatContextPlanner` ([`src/core/chat/ChatContextPlanner.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatContextPlanner.ts), 198 lines).
- **`CRK-P05-T05`**: Structural project context planner ([`src/core/chat/ProjectContextPlanner.ts`](file:///c:/dev/Chatbot/src/core/chat/ProjectContextPlanner.ts), 60 lines).
- **`CRK-P05-T06`**: Privacy-preserving plan diagnostics ([`src/core/chat/ContextPlanDiagnostics.ts`](file:///c:/dev/Chatbot/src/core/chat/ContextPlanDiagnostics.ts), 46 lines).
- **`CRK-P05-T07`**: 9-scenario context matrix & Phase 05 exit gate certified ([`src/core/chat/__tests__/context-planner-matrix.test.ts`](file:///c:/dev/Chatbot/src/core/chat/__tests__/context-planner-matrix.test.ts), 186 lines, 9/9 tests).

### Phase 06: Dataset Registry & Knowledge Pack Infrastructure (`CERTIFIED`)
- **`CRK-P06-T01`**: `DatasetManifest` & job schemas ([`src/types/knowledge-datasets.ts`](file:///c:/dev/Chatbot/src/types/knowledge-datasets.ts), 94 lines, 3/3 tests).
- **`CRK-P06-T02`**: `KnowledgePack` schemas & 8 canonical packs ([`src/types/knowledge-packs.ts`](file:///c:/dev/Chatbot/src/types/knowledge-packs.ts), 106 lines, 2/2 tests).
- **`CRK-P06-T03`**: Database migrations for SQLite & PostgreSQL ([`src/core/database/DatasetMigrations.ts`](file:///c:/dev/Chatbot/src/core/database/DatasetMigrations.ts), 112 lines, integrated into [`src/core/database/Database.ts`](file:///c:/dev/Chatbot/src/core/database/Database.ts)).
- **`CRK-P06-T04`**: `DatasetRegistry` with duplicate rejection and manifest auditing ([`src/core/knowledge/DatasetRegistry.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DatasetRegistry.ts), 88 lines).
- **`CRK-P06-T05`**: `DatasetManager` with resumable/auditable jobs ([`src/core/knowledge/DatasetManager.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DatasetManager.ts), 173 lines).
- **`CRK-P06-T06`**: `KnowledgePackManager` with readiness and non-destructive cascade disable ([`src/core/knowledge/KnowledgePackManager.ts`](file:///c:/dev/Chatbot/src/core/knowledge/KnowledgePackManager.ts), 88 lines).
- **`CRK-P06-T07`**: `DatasetLicensePolicy` for attribution and redistribution compliance ([`src/core/knowledge/DatasetLicensePolicy.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DatasetLicensePolicy.ts), 69 lines).
- **`CRK-P06-T08`**: `DatasetStorageQuota` & Phase 06 exit gate certified ([`src/core/knowledge/DatasetStorageQuota.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DatasetStorageQuota.ts), 87 lines; [`src/core/knowledge/__tests__/knowledge-infrastructure-integration.test.ts`](file:///c:/dev/Chatbot/src/core/knowledge/__tests__/knowledge-infrastructure-integration.test.ts), 160 lines, 6/6 tests).

### Phase 07: Official Documentation Pack (`CERTIFIED`)
- **`CRK-P07-T01 & T02`**: Official documentation schemas ([`src/types/official-docs.ts`](file:///c:/dev/Chatbot/src/types/official-docs.ts), 108 lines, 3/3 tests).
- **`CRK-P07-T01`**: Source policy with 0.95 default authority ([`src/core/knowledge/DocumentationSourcePolicy.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DocumentationSourcePolicy.ts), 97 lines).
- **`CRK-P07-T04`**: Semantic document chunker preserving hierarchy & symbols ([`src/core/knowledge/DocumentationChunker.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DocumentationChunker.ts), 147 lines).
- **`CRK-P07-T05`**: Version index and compatibility resolution ([`src/core/knowledge/DocumentationVersionIndex.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DocumentationVersionIndex.ts), 98 lines).
- **`CRK-P07-T06`**: Incremental refresh pipeline ([`src/core/knowledge/DocumentationRefreshService.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DocumentationRefreshService.ts), 87 lines).
- **`CRK-P07-T03`**: Official documentation pack service ([`src/core/knowledge/OfficialDocumentationPack.ts`](file:///c:/dev/Chatbot/src/core/knowledge/OfficialDocumentationPack.ts), 137 lines).
- **`CRK-P07-T07`**: Retrieval evaluation & Phase 07 exit gate certified ([`src/core/knowledge/__tests__/official-docs-retrieval-eval.test.ts`](file:///c:/dev/Chatbot/src/core/knowledge/__tests__/official-docs-retrieval-eval.test.ts), 133 lines, 5/5 tests).

### Phase 08: Knowledge Router (`CERTIFIED`)
- **`CRK-P08-T01 & T03`**: Knowledge router schemas ([`src/types/knowledge-router.ts`](file:///c:/dev/Chatbot/src/types/knowledge-router.ts), 68 lines, 3/3 tests).
- **`CRK-P08-T01-T05`**: KnowledgeRouter engine ([`src/core/knowledge/KnowledgeRouter.ts`](file:///c:/dev/Chatbot/src/core/knowledge/KnowledgeRouter.ts), 200 lines).
- **`CRK-P08-T05`**: Knowledge router integration suite & Phase 08 exit gate certified ([`src/core/knowledge/__tests__/knowledge-router.test.ts`](file:///c:/dev/Chatbot/src/core/knowledge/__tests__/knowledge-router.test.ts), 87 lines, 6/6 tests).

### Phase 09: Authority, Freshness, Quality & Version Compatibility (`CERTIFIED`)
- **`CRK-P09-T01 & T03`**: Retrieval scoring schemas ([`src/types/retrieval-scoring.ts`](file:///c:/dev/Chatbot/src/types/retrieval-scoring.ts), 147 lines, 3/3 tests).
- **`CRK-P09-T01`**: Source authority policy ([`src/core/knowledge/SourceAuthorityPolicy.ts`](file:///c:/dev/Chatbot/src/core/knowledge/SourceAuthorityPolicy.ts), 70 lines).
- **`CRK-P09-T02`**: Freshness scorer with domain-dependent exponential decay ([`src/core/knowledge/FreshnessScorer.ts`](file:///c:/dev/Chatbot/src/core/knowledge/FreshnessScorer.ts), 65 lines).
- **`CRK-P09-T03`**: Version compatibility evaluator ([`src/core/knowledge/VersionCompatibilityEvaluator.ts`](file:///c:/dev/Chatbot/src/core/knowledge/VersionCompatibilityEvaluator.ts), 138 lines).
- **`CRK-P09-T04`**: Content quality scorer ([`src/core/knowledge/QualityScorer.ts`](file:///c:/dev/Chatbot/src/core/knowledge/QualityScorer.ts), 49 lines).
- **`CRK-P09-T05`**: Versioned retrieval policy engine ([`src/core/knowledge/RetrievalPolicyEngine.ts`](file:///c:/dev/Chatbot/src/core/knowledge/RetrievalPolicyEngine.ts), 91 lines).
- **`CRK-P09-T06`**: Retrieval conflict resolver ([`src/core/knowledge/RetrievalConflictResolver.ts`](file:///c:/dev/Chatbot/src/core/knowledge/RetrievalConflictResolver.ts), 132 lines).
- **`CRK-P09-T07`**: Version conflict benchmark & Phase 09 exit gate certified ([`src/core/knowledge/__tests__/version-conflict-benchmark.test.ts`](file:///c:/dev/Chatbot/src/core/knowledge/__tests__/version-conflict-benchmark.test.ts), 221 lines, 6/6 tests).

### Phase 10: Model Registry and Model Policy Engine (`CERTIFIED`)
- **`CRK-P10-T02 & T04`**: Model registry schemas ([`src/types/model-registry.ts`](file:///c:/dev/Chatbot/src/types/model-registry.ts), 112 lines, 3/3 tests).
- **`CRK-P10-T01 & T03`**: Model registry with production seed models ([`src/core/providers/ModelRegistry.ts`](file:///c:/dev/Chatbot/src/core/providers/ModelRegistry.ts), 181 lines).
- **`CRK-P10-T04 & T05`**: Multi-dimensional model policy engine ([`src/core/providers/ModelPolicyEngine.ts`](file:///c:/dev/Chatbot/src/core/providers/ModelPolicyEngine.ts), 122 lines).
- **`CRK-P10-T06`**: Model fallback planner with invariant preservation ([`src/core/providers/ModelFallbackPlanner.ts`](file:///c:/dev/Chatbot/src/core/providers/ModelFallbackPlanner.ts), 94 lines).
- **`CRK-P10-T07`**: Model health checker with 7 provider health states ([`src/core/providers/ModelHealthChecker.ts`](file:///c:/dev/Chatbot/src/core/providers/ModelHealthChecker.ts), 80 lines).
- **`CRK-P10-T08`**: Model registry integration suite & Phase 10 exit gate certified ([`src/core/providers/__tests__/model-registry-policy.test.ts`](file:///c:/dev/Chatbot/src/core/providers/__tests__/model-registry-policy.test.ts), 93 lines, 5/5 tests).

### Phase 11: Prompt and Context Assembler (`CERTIFIED`)
- **`CRK-P11-T01, T02, T06`**: Prompt envelope schemas and 9 trust levels ([`src/types/prompt-assembler.ts`](file:///c:/dev/Chatbot/src/types/prompt-assembler.ts), 68 lines, 2/2 tests).
- **`CRK-P11-T04`**: `ContextBudgetService` with task-tailored token allocations ([`src/core/prompt/ContextBudgetService.ts`](file:///c:/dev/Chatbot/src/core/prompt/ContextBudgetService.ts), 103 lines).
- **`CRK-P11-T05`**: Deterministic `PromptTruncationService` protecting critical policy/request ([`src/core/prompt/PromptTruncationService.ts`](file:///c:/dev/Chatbot/src/core/prompt/PromptTruncationService.ts), 101 lines).
- **`CRK-P11-T03 & T07`**: `PromptAssembler` with canonical ordering, anti-injection directives, and version tracing ([`src/core/prompt/PromptAssembler.ts`](file:///c:/dev/Chatbot/src/core/prompt/PromptAssembler.ts), 178 lines).
- **`CRK-P11-T07`**: Prompt assembler integration suite & Phase 11 exit gate certified ([`src/core/prompt/__tests__/prompt-assembler.test.ts`](file:///c:/dev/Chatbot/src/core/prompt/__tests__/prompt-assembler.test.ts), 128 lines, 5/5 tests).

### Phase 12: Grounding, Evidence Sufficiency, and Abstention (`CERTIFIED`)
- **`CRK-P12-T01 & T02`**: Grounding decision and retrieval confidence schemas ([`src/types/grounding-eval.ts`](file:///c:/dev/Chatbot/src/types/grounding-eval.ts), 62 lines, 2/2 tests).
- **`CRK-P12-T01 & T02`**: Multi-dimensional `GroundingEvaluator` with stopword-filtered keyword stemming and contradiction detection ([`src/core/evals/GroundingEvaluator.ts`](file:///c:/dev/Chatbot/src/core/evals/GroundingEvaluator.ts), 155 lines).
- **`CRK-P12-T03`**: 3-stage `GroundingEscalationFlow` separating initial, local broadening, and online escalation ([`src/core/evals/GroundingEscalationFlow.ts`](file:///c:/dev/Chatbot/src/core/evals/GroundingEscalationFlow.ts), 112 lines).
- **`CRK-P12-T05`**: Truthful `ResponseWordingPolicy` distinguishing missing local knowledge from factual non-existence ([`src/core/evals/ResponseWordingPolicy.ts`](file:///c:/dev/Chatbot/src/core/evals/ResponseWordingPolicy.ts), 63 lines).
- **`CRK-P12-T04`**: 7-scenario answerability benchmark fixtures ([`src/core/evals/AnswerabilityEvalSet.ts`](file:///c:/dev/Chatbot/src/core/evals/AnswerabilityEvalSet.ts), 149 lines).
- **`CRK-P12-T05`**: Grounding and abstention integration suite & Phase 12 exit gate certified ([`src/core/evals/__tests__/grounding-abstention.test.ts`](file:///c:/dev/Chatbot/src/core/evals/__tests__/grounding-abstention.test.ts), 117 lines, 4/4 tests).

### Phase 13: Developer Q&A Pack (Stack Exchange / Stack Overflow) (`CERTIFIED`)
- **`CRK-P13-T01, T04, T05`**: Developer Q&A schemas preserving Q&A relationships, vote scores, tags, and CC BY-SA license ([`src/types/developer-qa.ts`](file:///c:/dev/Chatbot/src/types/developer-qa.ts), 65 lines, 2/2 tests).
- **`CRK-P13-T02 & T03`**: `DeveloperQAQualityFilter` rejecting spam, chatter, link-only answers, and scores below threshold ([`src/core/knowledge/DeveloperQAQualityFilter.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DeveloperQAQualityFilter.ts), 89 lines).
- **`CRK-P13-T06`**: `DeveloperQAVersionExtractor` extracting multi-source product and framework version signals ([`src/core/knowledge/DeveloperQAVersionExtractor.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DeveloperQAVersionExtractor.ts), 55 lines).
- **`CRK-P13-T04 & T05`**: `DeveloperQAPack` maintaining question+context+answer units with bounded 0.80-0.88 authority ([`src/core/knowledge/DeveloperQAPack.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DeveloperQAPack.ts), 75 lines).
- **`CRK-P13-T07`**: `DeveloperQARefreshService` tracking content hashes and skipping unchanged entries ([`src/core/knowledge/DeveloperQARefreshService.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DeveloperQARefreshService.ts), 68 lines).
- **`CRK-P13-T08`**: Developer Q&A evaluation suite & Phase 13 exit gate certified ([`src/core/knowledge/__tests__/developer-qa-eval.test.ts`](file:///c:/dev/Chatbot/src/core/knowledge/__tests__/developer-qa-eval.test.ts), 191 lines, 4/4 tests).

### Phase 14: Curated Source-Code Pack (`CERTIFIED`)
- **`CRK-P14-T01, T02, T06, T09`**: Curated code schemas with 18-language whitelist, symbol hierarchy, and provenance ([`src/types/source-code-pack.ts`](file:///c:/dev/Chatbot/src/types/source-code-pack.ts), 73 lines, 2/2 tests).
- **`CRK-P14-T02, T03, T08`**: `SourceCodeFileFilter` rejecting locks, build artifacts, minified bundles, and generated code headers ([`src/core/knowledge/SourceCodeFileFilter.ts`](file:///c:/dev/Chatbot/src/core/knowledge/SourceCodeFileFilter.ts), 106 lines).
- **`CRK-P14-T07`**: `SourceCodeDeduplicator` implementing normalized exact SHA-256 and SimHash token distance ([`src/core/knowledge/SourceCodeDeduplicator.ts`](file:///c:/dev/Chatbot/src/core/knowledge/SourceCodeDeduplicator.ts), 76 lines).
- **`CRK-P14-T05, T06, T09`**: `SourceCodeStructuralChunker` extracting syntax/symbol units, imports, exports, and source line ranges ([`src/core/knowledge/SourceCodeStructuralChunker.ts`](file:///c:/dev/Chatbot/src/core/knowledge/SourceCodeStructuralChunker.ts), 134 lines).
- **`CRK-P14-T01, T04, T10`**: `SourceCodePack` managing quality validation, deduplication, symbol-boosted search, and non-execution invariant (§2672) ([`src/core/knowledge/SourceCodePack.ts`](file:///c:/dev/Chatbot/src/core/knowledge/SourceCodePack.ts), 94 lines).
- **`CRK-P14-T10`**: Source code retrieval benchmark & Phase 14 exit gate certified ([`src/core/knowledge/__tests__/source-code-retrieval-benchmark.test.ts`](file:///c:/dev/Chatbot/src/core/knowledge/__tests__/source-code-retrieval-benchmark.test.ts), 172 lines, 5/5 tests).

### Phase 15: Citation and Provenance UX (`CERTIFIED`)
- **`CRK-P15-T01, T02, T03, T04`**: Citation & provenance schemas ([`src/types/citation.ts`](file:///c:/dev/Chatbot/src/types/citation.ts), 113 lines, 4/4 tests).
- **`CRK-P15-T02`**: `ClaimAssociationService` with sentence-level vs response-level distinction preventing false sentence precision (§2717) ([`src/core/knowledge/ClaimAssociationService.ts`](file:///c:/dev/Chatbot/src/core/knowledge/ClaimAssociationService.ts), 136 lines).
- **`CRK-P15-T03`**: `SourcesDrawerFormatter` and client component ([`src/core/knowledge/SourcesDrawerFormatter.ts`](file:///c:/dev/Chatbot/src/core/knowledge/SourcesDrawerFormatter.ts), 114 lines; [`client/src/components/SourcesDrawer.tsx`](file:///c:/dev/Chatbot/client/src/components/SourcesDrawer.tsx), 83 lines, 3/3 tests).
- **`CRK-P15-T04`**: `WhyThisAnswerService` and client modal strictly excluding private reasoning (§2758) ([`src/core/chat/WhyThisAnswerService.ts`](file:///c:/dev/Chatbot/src/core/chat/WhyThisAnswerService.ts), 91 lines; [`client/src/components/WhyThisAnswerModal.tsx`](file:///c:/dev/Chatbot/client/src/components/WhyThisAnswerModal.tsx), 98 lines, 1/1 tests).
- **`CRK-P15-T05`**: `CitationResolverService` with broken link suppression and unresolved citation logging ([`src/core/knowledge/CitationResolverService.ts`](file:///c:/dev/Chatbot/src/core/knowledge/CitationResolverService.ts), 95 lines).
- **`CRK-P15-T05`**: Citation integration suite & Phase 15 exit gate certified ([`src/core/knowledge/__tests__/citation-provenance-integration.test.ts`](file:///c:/dev/Chatbot/src/core/knowledge/__tests__/citation-provenance-integration.test.ts), 162 lines, 5/5 tests).

### Phase 16: Feedback Consolidation (`CERTIFIED`)
- **`CRK-P16-T01`**: Legacy collectors deprecated and adapted via `FeedbackCollectorAdapter` ([`src/core/feedback/FeedbackCollectorAdapter.ts`](file:///c:/dev/Chatbot/src/core/feedback/FeedbackCollectorAdapter.ts), 100 lines; [`src/core/rl/FeedbackCollector.ts`](file:///c:/dev/Chatbot/src/core/rl/FeedbackCollector.ts); [`src/core/learning/FeedbackCollector.ts`](file:///c:/dev/Chatbot/src/core/learning/FeedbackCollector.ts)).
- **`CRK-P16-T02, T03, T05`**: Canonical feedback schemas with 11 standardized categories ([`src/types/feedback.ts`](file:///c:/dev/Chatbot/src/types/feedback.ts), 92 lines, 3/3 tests).
- **`CRK-P16-T03`**: `FeedbackTraceBinding` extracting run metadata without private prompt duplication (§2845) ([`src/core/feedback/FeedbackTraceBinding.ts`](file:///c:/dev/Chatbot/src/core/feedback/FeedbackTraceBinding.ts), 77 lines).
- **`CRK-P16-T04`**: `ResponseFeedbackBar` client component with thumbs up/down and optional category chips ([`client/src/components/ResponseFeedbackBar.tsx`](file:///c:/dev/Chatbot/client/src/components/ResponseFeedbackBar.tsx), 147 lines, 4/4 tests).
- **`CRK-P16-T05`**: `FeedbackTriageService` strictly enforcing non-training invariant (§2872-2892) ([`src/core/feedback/FeedbackTriageService.ts`](file:///c:/dev/Chatbot/src/core/feedback/FeedbackTriageService.ts), 94 lines).
- **`CRK-P16-T06`**: `CanonicalFeedbackService` with GDPR/CCPA privacy deletion by session/user and database migrations ([`src/core/feedback/CanonicalFeedbackService.ts`](file:///c:/dev/Chatbot/src/core/feedback/CanonicalFeedbackService.ts), 212 lines; [`src/core/database/DatasetMigrations.ts`](file:///c:/dev/Chatbot/src/core/database/DatasetMigrations.ts)).
- **`CRK-P16-T06`**: Feedback consolidation integration suite & Phase 16 exit gate certified ([`src/core/feedback/__tests__/feedback-consolidation-integration.test.ts`](file:///c:/dev/Chatbot/src/core/feedback/__tests__/feedback-consolidation-integration.test.ts), 198 lines, 5/5 tests).

### Phase 17: Response Quality Gate (`CERTIFIED`)
- **`CRK-P17-T01`**: Response validation contract & schemas ([`src/types/response-quality.ts`](file:///c:/dev/Chatbot/src/types/response-quality.ts), 107 lines, 4/4 tests).
- **`CRK-P17-T02`**: Core validators for non-empty, format/fences, citations, tool claims, test verification, and metadata ([`src/core/validation/CoreResponseValidators.ts`](file:///c:/dev/Chatbot/src/core/validation/CoreResponseValidators.ts), 224 lines).
- **`CRK-P17-T03`**: Grounded response validator enforcing evidence sufficiency, context inclusion, and version alignment ([`src/core/validation/GroundedResponseValidator.ts`](file:///c:/dev/Chatbot/src/core/validation/GroundedResponseValidator.ts), 137 lines).
- **`CRK-P17-T04`**: Coding response validator enforcing exact verification states (`passed | failed | blocked | not_run`), patch alignment, and risk preservation ([`src/core/validation/CodingResponseValidator.ts`](file:///c:/dev/Chatbot/src/core/validation/CodingResponseValidator.ts), 126 lines).
- **`CRK-P17-T05`**: Bounded reason-specific retry policy and composite response quality gate ([`src/core/validation/ResponseRetryPolicy.ts`](file:///c:/dev/Chatbot/src/core/validation/ResponseRetryPolicy.ts), 123 lines; [`src/core/validation/ResponseQualityGate.ts`](file:///c:/dev/Chatbot/src/core/validation/ResponseQualityGate.ts), 63 lines; integrated into [`src/core/chat/ChatRuntimeFactory.ts`](file:///c:/dev/Chatbot/src/core/chat/ChatRuntimeFactory.ts)).
- **`CRK-P17-T05`**: Response quality gate integration suite & Phase 17 exit gate certified ([`src/core/validation/__tests__/response-quality-gate.test.ts`](file:///c:/dev/Chatbot/src/core/validation/__tests__/response-quality-gate.test.ts), 11/11 tests).

### Phase 18: Tool Result Truthfulness and Side-Effect Ledger (`CERTIFIED`)
- **`CRK-P18-T01`**: Standard tool result schemas and contracts with 6 execution statuses ([`src/types/tool-truth.ts`](file:///c:/dev/Chatbot/src/types/tool-truth.ts), 115 lines, 4/4 tests).
- **`CRK-P18-T02`**: Auditable side-effect ledger for mutating actions tracking actor, authorization token, target, status, rollback snapshots, and verification ([`src/core/tools/SideEffectLedger.ts`](file:///c:/dev/Chatbot/src/core/tools/SideEffectLedger.ts), 172 lines).
- **`CRK-P18-T03`**: Tool language truthfulness enforcing strict status-to-language matrix and correcting overclaims ([`src/core/tools/ToolLanguageTruthfulness.ts`](file:///c:/dev/Chatbot/src/core/tools/ToolLanguageTruthfulness.ts), 147 lines).
- **`CRK-P18-T04`**: Coding truth bridge unifying patches, tests, and ledger without duplicate truth models ([`src/core/tools/CodingTruthBridge.ts`](file:///c:/dev/Chatbot/src/core/tools/CodingTruthBridge.ts), 144 lines).
- **`CRK-P18-T05`**: Comprehensive failure test suite covering all 6 mandatory failure conditions and Phase 18 exit gate certified ([`src/core/tools/__tests__/tool-truthfulness-failure.test.ts`](file:///c:/dev/Chatbot/src/core/tools/__tests__/tool-truthfulness-failure.test.ts), 230 lines, 7/7 tests).

### Phase 19: General Knowledge Pack: Wikipedia + Wikidata (`CERTIFIED`)
- **`CRK-P19-T01, T02, T03, T05`**: General knowledge schemas for Wikipedia articles/sections, structured Wikidata entities, entity links, and snapshots ([`src/types/general-knowledge.ts`](file:///c:/dev/Chatbot/src/types/general-knowledge.ts), 127 lines, 3/3 tests).
- **`CRK-P19-T01`**: `WikipediaChunker` implementing structural hierarchy (article -> lead -> heading -> subsection) and noise stripping of templates, infoboxes, footnotes, and categories ([`src/core/knowledge/WikipediaChunker.ts`](file:///c:/dev/Chatbot/src/core/knowledge/WikipediaChunker.ts), 143 lines).
- **`CRK-P19-T02`**: `WikidataStructuredStore` ingesting QIDs, labels, aliases, property claims, and instanceOf/subclassOf graph relations into `KnowledgeGraph` without vector prose duplication ([`src/core/knowledge/WikidataStructuredStore.ts`](file:///c:/dev/Chatbot/src/core/knowledge/WikidataStructuredStore.ts), 124 lines).
- **`CRK-P19-T03`**: `EntityLinkingService` linking text mentions to Wikidata entities with conservative thresholding to prevent irreversible low-confidence merges ([`src/core/knowledge/EntityLinkingService.ts`](file:///c:/dev/Chatbot/src/core/knowledge/EntityLinkingService.ts), 112 lines).
- **`CRK-P19-T04 & T05`**: `GeneralKnowledgePack` managing independently installable pack with authority 0.67 and domain segregation in `KnowledgeRouter` excluding encyclopedia from coding queries ([`src/core/knowledge/GeneralKnowledgePack.ts`](file:///c:/dev/Chatbot/src/core/knowledge/GeneralKnowledgePack.ts), 120 lines).
- **`CRK-P19-T05`**: General knowledge integration suite & Phase 19 exit gate certified ([`src/core/knowledge/__tests__/general-knowledge-pack.test.ts`](file:///c:/dev/Chatbot/src/core/knowledge/__tests__/general-knowledge-pack.test.ts), 7/7 tests).

### Phase 20: Research and Math Packs (`CERTIFIED`)
- **`CRK-P20-T01, T02, T04, T05`**: Scholarly paper and mathematical theorem/proof schemas with LaTeX preservation and academic licenses ([`src/types/research-math-packs.ts`](file:///c:/dev/Chatbot/src/types/research-math-packs.ts), 124 lines, 2/2 tests).
- **`CRK-P20-T01`**: `AcademicLicensePolicy` enforcing open license verification (CC-BY, arXiv, OpenAccess) and strictly rejecting closed/proprietary corpora ([`src/core/knowledge/AcademicLicensePolicy.ts`](file:///c:/dev/Chatbot/src/core/knowledge/AcademicLicensePolicy.ts), 60 lines).
- **`CRK-P20-T02`**: `ResearchPaperChunker` preserving paper hierarchy (title -> abstract -> sections) and strictly excluding bibliography/references from retrieval prose ([`src/core/knowledge/ResearchPaperChunker.ts`](file:///c:/dev/Chatbot/src/core/knowledge/ResearchPaperChunker.ts), 160 lines).
- **`CRK-P20-T01 to T03`**: `ResearchPack` managing scholarly literature with authority 0.88, strict retraction suppression, and field-specific freshness evaluation ([`src/core/knowledge/ResearchPack.ts`](file:///c:/dev/Chatbot/src/core/knowledge/ResearchPack.ts), 114 lines).
- **`CRK-P20-T04 & T05`**: `MathStructuralChunker` preserving LaTeX equation boundaries (`$...$`, `$$...$$`) and bonding theorem statements to proofs and definitions to derivations ([`src/core/knowledge/MathStructuralChunker.ts`](file:///c:/dev/Chatbot/src/core/knowledge/MathStructuralChunker.ts), 143 lines).
- **`CRK-P20-T04 to T06`**: `MathPack` managing mathematics reference base with definition lookup and theorem/proof retrieval ([`src/core/knowledge/MathPack.ts`](file:///c:/dev/Chatbot/src/core/knowledge/MathPack.ts), 105 lines).
- **`CRK-P20-T06`**: Research and Math evaluation suite & Phase 20 exit gate certified ([`src/core/knowledge/__tests__/research-math-packs-eval.test.ts`](file:///c:/dev/Chatbot/src/core/knowledge/__tests__/research-math-packs-eval.test.ts), 9/9 tests).

### Phase 21: Filtered Educational Web and Multilingual Packs (`CERTIFIED`)
- **`CRK-P21-T01, T02, T04, T05`**: Educational and multilingual schemas ([`src/types/educational-multilingual.ts`](file:///c:/dev/Chatbot/src/types/educational-multilingual.ts), 83 lines, 2/2 tests).
- **`CRK-P21-T01, T02, T03`**: `FineWebEduSourcePolicy` implementing multi-stage ingestion pipeline with topic classification, quality threshold scoring, safety filtering, and SHA-256 deduplication ([`src/core/knowledge/FineWebEduSourcePolicy.ts`](file:///c:/dev/Chatbot/src/core/knowledge/FineWebEduSourcePolicy.ts), 128 lines).
- **`CRK-P21-T01, T02, T03`**: `EducationalWebPack` with staging index for threshold experiments and topic-bounded retrieval (authority 0.70) ([`src/core/knowledge/EducationalWebPack.ts`](file:///c:/dev/Chatbot/src/core/knowledge/EducationalWebPack.ts), 96 lines).
- **`CRK-P21-T04, T05`**: `MultilingualPack` managing language-specific subsets and verifying embedding model dimensions/versions ([`src/core/knowledge/MultilingualPack.ts`](file:///c:/dev/Chatbot/src/core/knowledge/MultilingualPack.ts), 106 lines).
- **`CRK-P21-T05`**: Educational web & multilingual suite & Phase 21 exit gate certified ([`src/core/knowledge/__tests__/educational-multilingual-pack.test.ts`](file:///c:/dev/Chatbot/src/core/knowledge/__tests__/educational-multilingual-pack.test.ts), 6/6 tests).

### Phase 22: Voice and External Input/Output Adapters (`CERTIFIED`)
- **`CRK-P22-T01 to T05`**: Input adapter contracts & schemas ([`src/types/input-adapters.ts`](file:///c:/dev/Chatbot/src/types/input-adapters.ts), 90 lines, 3/3 tests).
- **`CRK-P22-T01, T02, T04, T05`**: `VoiceInputAdapter` enforcing explicit microphone consent, separate STT model metadata tracking, and zero audio retention ([`src/core/adapters/VoiceInputAdapter.ts`](file:///c:/dev/Chatbot/src/core/adapters/VoiceInputAdapter.ts), 72 lines).
- **`CRK-P22-T03, T04`**: `VoiceOutputAdapter` generating speech synthesis while strictly preserving unaltered canonical text response ([`src/core/adapters/VoiceOutputAdapter.ts`](file:///c:/dev/Chatbot/src/core/adapters/VoiceOutputAdapter.ts), 45 lines).
- **`CRK-P22-T01, T04`**: `ChatInputAdapterFactory` channeling web, voice, integration (Slack/GitHub), and companion desktop inputs to `NormalizedChatRequest` ([`src/core/adapters/ChatInputAdapterFactory.ts`](file:///c:/dev/Chatbot/src/core/adapters/ChatInputAdapterFactory.ts), 86 lines).
- **`CRK-P22-T05`**: Voice & external adapters suite & Phase 22 exit gate certified ([`src/core/adapters/__tests__/voice-external-adapters.test.ts`](file:///c:/dev/Chatbot/src/core/adapters/__tests__/voice-external-adapters.test.ts), 7/7 tests).

### Phase 23: Chat Diagnostics: "Why Did This Fail?" (`CERTIFIED`)
- **`CRK-P23-T01, T02, T05`**: Diagnostics and run record schemas ([`src/types/chat-diagnostics.ts`](file:///c:/dev/Chatbot/src/types/chat-diagnostics.ts), 81 lines, 2/2 tests).
- **`CRK-P23-T01`**: Database migrations adding `chat_runs`, `chat_run_sources`, and `chat_run_tools` ([`src/core/database/DatasetMigrations.ts`](file:///c:/dev/Chatbot/src/core/database/DatasetMigrations.ts)).
- **`CRK-P23-T01, T03`**: `ChatRunRepository` with strict sanitization stripping passwords, tokens, API keys, and internal thoughts ([`src/core/diagnostics/ChatRunRepository.ts`](file:///c:/dev/Chatbot/src/core/diagnostics/ChatRunRepository.ts), 77 lines).
- **`CRK-P23-T01, T02, T05`**: `ChatDiagnosticsService` tracking stage timings and classifying failures into 14 normalized failure taxonomy codes ([`src/core/diagnostics/ChatDiagnosticsService.ts`](file:///c:/dev/Chatbot/src/core/diagnostics/ChatDiagnosticsService.ts), 124 lines).
- **`CRK-P23-T03`**: Developer diagnostics REST route `GET /api/debug/chat-runs/:requestId` ([`src/server/routes/chat-diagnostics.ts`](file:///c:/dev/Chatbot/src/server/routes/chat-diagnostics.ts), 64 lines).
- **`CRK-P23-T04`**: Diagnostics UI modal component and waterfall view ([`client/src/components/ChatDiagnosticsModal.tsx`](file:///c:/dev/Chatbot/client/src/components/ChatDiagnosticsModal.tsx), 116 lines, 1/1 tests).
- **`CRK-P23-T05`**: Diagnostics integration suite & Phase 23 exit gate certified ([`src/core/diagnostics/__tests__/chat-diagnostics.test.ts`](file:///c:/dev/Chatbot/src/core/diagnostics/__tests__/chat-diagnostics.test.ts), 4/4 tests).

### Phase 24: Golden Conversation and Runtime Regression Suite (`CERTIFIED`)
- **`CRK-P24-T01, T02, T07`**: Golden evaluation schemas and baseline metrics ([`src/types/golden-eval.ts`](file:///c:/dev/Chatbot/src/types/golden-eval.ts), 90 lines, 2/2 tests).
- **`CRK-P24-T01, T04, T05`**: Human-reviewed seed catalog representing all 12 categories and generator producing 500 cataloged cases with strict contamination isolation ([`src/core/evals/golden-dataset-seed.ts`](file:///c:/dev/Chatbot/src/core/evals/golden-dataset-seed.ts), 215 lines).
- **`CRK-P24-T03, T06, T07`**: `GoldenConversationRunner` executing test cases with deterministic checks and baseline reliability metrics ([`src/core/evals/GoldenConversationRunner.ts`](file:///c:/dev/Chatbot/src/core/evals/GoldenConversationRunner.ts), 143 lines).
- **`CRK-P24-T07`**: Golden regression test suite running PR smoke tier & Phase 24 exit gate certified ([`src/core/evals/__tests__/golden-regression-suite.test.ts`](file:///c:/dev/Chatbot/src/core/evals/__tests__/golden-regression-suite.test.ts), 4/4 tests).

### Phase 25: Dataset and Policy A/B Evaluation (`CERTIFIED`)
- **`CRK-P25-T01, T02, T04`**: Dataset A/B comparative metrics and promotion decision schemas ([`src/types/ab-evaluation.ts`](file:///c:/dev/Chatbot/src/types/ab-evaluation.ts), 60 lines, 1/1 tests).
- **`CRK-P25-T01 to T04`**: `DatasetAbEvaluator` enforcing controlled configurations and empirical promotion rules rejecting degraded correctness, outdated answers, and quota violations ([`src/core/evals/DatasetAbEvaluator.ts`](file:///c:/dev/Chatbot/src/core/evals/DatasetAbEvaluator.ts), 103 lines).
- **`CRK-P25-T05`**: `RetrievalWeightTuner` optimizing retrieval scoring weights against held-out validation cases ([`src/core/evals/RetrievalWeightTuner.ts`](file:///c:/dev/Chatbot/src/core/evals/RetrievalWeightTuner.ts), 77 lines).
- **`CRK-P25-T05`**: Dataset A/B evaluation suite & Phase 25 exit gate certified ([`src/core/evals/__tests__/dataset-ab-eval.test.ts`](file:///c:/dev/Chatbot/src/core/evals/__tests__/dataset-ab-eval.test.ts), 5/5 tests).

### Phase 26: Automated Knowledge Maintenance and Production Hardening (`CERTIFIED`)
- **`CRK-P26-T01 to T09`**: Maintenance & hardening schemas ([`src/types/knowledge-maintenance.ts`](file:///c:/dev/Chatbot/src/types/knowledge-maintenance.ts), 131 lines, 5/5 tests).
- **`CRK-P26-T01`**: `DatasetRefreshScheduler` managing background refresh cadence, TTL, dependency ordering, and default pack refresh policies ([`src/core/knowledge/DatasetRefreshScheduler.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DatasetRefreshScheduler.ts), 166 lines).
- **`CRK-P26-T02`**: `IncrementalUpdateService` executing 11-step incremental update pipeline reusing existing chunks and avoiding full re-embedding ([`src/core/knowledge/IncrementalUpdateService.ts`](file:///c:/dev/Chatbot/src/core/knowledge/IncrementalUpdateService.ts), 81 lines).
- **`CRK-P26-T03`**: `AtomicDatasetActivation` enforcing 7-state lifecycle and guaranteeing query routing accesses only `READY` versions ([`src/core/knowledge/AtomicDatasetActivation.ts`](file:///c:/dev/Chatbot/src/core/knowledge/AtomicDatasetActivation.ts), 152 lines).
- **`CRK-P26-T04`**: `JobRecoveryService` identifying stale running jobs and safely resuming from checkpoints or cleaning temporary staging files ([`src/core/knowledge/JobRecoveryService.ts`](file:///c:/dev/Chatbot/src/core/knowledge/JobRecoveryService.ts), 84 lines).
- **`CRK-P26-T05`**: `ReembeddingMigrationService` non-destructive dual-index migration engine with retrieval quality validation and rollback window ([`src/core/knowledge/ReembeddingMigrationService.ts`](file:///c:/dev/Chatbot/src/core/knowledge/ReembeddingMigrationService.ts), 110 lines).
- **`CRK-P26-T06`**: `DatasetBackupPolicy` classifying custom/curated vs reproducible data with RTO disaster recovery policies ([`src/core/knowledge/DatasetBackupPolicy.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DatasetBackupPolicy.ts), 93 lines).
- **`CRK-P26-T07`**: `KnowledgeMaintenanceMetrics` tracking operational telemetry and alerting on SLA breach, consecutive failures, disk thresholds, and drops ([`src/core/knowledge/KnowledgeMaintenanceMetrics.ts`](file:///c:/dev/Chatbot/src/core/knowledge/KnowledgeMaintenanceMetrics.ts), 131 lines).
- **`CRK-P26-T08`**: `ReleaseCutoverOrchestrator` implementing 11-step production cutover verification checklist and rollback flag enforcement ([`src/core/chat/ReleaseCutoverOrchestrator.ts`](file:///c:/dev/Chatbot/src/core/chat/ReleaseCutoverOrchestrator.ts), 104 lines).
- **`CRK-P26-T09`**: `LegacyOrchestratorDeprecation` backward-compatible shim delegating legacy requests into canonical ChatRuntime ([`src/core/chat/LegacyOrchestratorDeprecation.ts`](file:///c:/dev/Chatbot/src/core/chat/LegacyOrchestratorDeprecation.ts), 50 lines).
- **`CRK-P26-T09`**: Maintenance & production hardening suite & Phase 26 exit gate certified ([`src/core/knowledge/__tests__/knowledge-maintenance-production.test.ts`](file:///c:/dev/Chatbot/src/core/knowledge/__tests__/knowledge-maintenance-production.test.ts), 285 lines, 8/8 test suites passed, 13/13 tests passed across Phase 26).

### Specifications 31-35: UX, Configuration, Security, Performance & Failure Modes (`CERTIFIED`)
- **`CRK-SPEC-31`**: Default Client UX specification (`ModelSelectorDropdown`, `KnowledgeManagerPanel`, 5/5 client Vitest tests).
- **`CRK-SPEC-32`**: Typed configuration specification with Zod schema (`CanonicalRuntimeConfig`, 4/4 tests).
- **`CRK-SPEC-33`**: Security policy enforcing prompt injection delimiters, sha256 checksums, cross-user isolation, SSRF prevention, inert code markers, and license compliance (`KnowledgeSecurityPolicy`, 15/15 tests).
- **`CRK-SPEC-34`**: Latency budget tracker and resource guardrail tripwires (`CapacityPerformanceTracker`, `ResourceGuardrailService`, 7/7 tests).
- **`CRK-SPEC-35`**: 19-scenario failure-mode resolution matrix (`FailureModeMatrixHandler`, 8/8 tests).

### Specifications 36-40: Testing, Evaluation Thresholds, Graph, Milestones & Parallel Work (`CERTIFIED`)
- **`CRK-SPEC-36`**: Multi-tier testing strategy orchestrator certifying 6 test tiers, 17 mandatory unit services, 9 security test vectors, and end-to-end integration pipelines ([`src/core/testing/CanonicalTestingOrchestrator.ts`](file:///c:/dev/Chatbot/src/core/testing/CanonicalTestingOrchestrator.ts), [`src/types/testing-strategy.ts`](file:///c:/dev/Chatbot/src/types/testing-strategy.ts), 7/7 tests).
- **`CRK-SPEC-37`**: Evaluation metrics and release threshold framework with empirical tolerance bounds and blocker tripwires for zero-tolerance regressions ([`src/core/evals/ReleaseThresholdFramework.ts`](file:///c:/dev/Chatbot/src/core/evals/ReleaseThresholdFramework.ts), [`src/types/eval-thresholds.ts`](file:///c:/dev/Chatbot/src/types/eval-thresholds.ts), 7/7 tests).
- **`CRK-SPEC-38`**: Implementation dependency DAG engine with cycle detection, topological sorting, prerequisite verification, and dependency querying across all 27 CRK phases ([`src/core/governance/ImplementationDependencyGraph.ts`](file:///c:/dev/Chatbot/src/core/governance/ImplementationDependencyGraph.ts), [`src/types/dependency-graph.ts`](file:///c:/dev/Chatbot/src/types/dependency-graph.ts), 8/8 tests).
- **`CRK-SPEC-39`**: Recommended milestones manager tracking Milestones A through G with acceptance criteria evaluation ([`src/core/governance/MilestoneManager.ts`](file:///c:/dev/Chatbot/src/core/governance/MilestoneManager.ts), 4/4 tests).
- **`CRK-SPEC-40`**: Parallel work rules & lane concurrency coordinator governing 4 development lanes, branch conventions, concurrent file conflict detection, and pack promotion gating ([`src/core/governance/ParallelWorkCoordinator.ts`](file:///c:/dev/Chatbot/src/core/governance/ParallelWorkCoordinator.ts), 5/5 tests).

### Specifications 41-45: Repository Architecture, Compatibility, Rollout, Rollback & Observability (`CERTIFIED`)
- **`CRK-SPEC-41`**: Canonical repository file map auditor and boundary rule enforcer validating 13 module categories, 300-line ceiling, and circular/illegal architectural boundaries ([`src/core/governance/RepositoryFileMapAuditor.ts`](file:///c:/dev/Chatbot/src/core/governance/RepositoryFileMapAuditor.ts), [`src/types/file-map.ts`](file:///c:/dev/Chatbot/src/types/file-map.ts), 7/7 tests).
- **`CRK-SPEC-42`**: API and type compatibility bridge providing bidirectional payload translation, versioned capability additions, and 4-gate deprecation lifecycle enforcement ([`src/core/migration/APICompatibilityBridge.ts`](file:///c:/dev/Chatbot/src/core/migration/APICompatibilityBridge.ts), [`src/types/api-compatibility.ts`](file:///c:/dev/Chatbot/src/types/api-compatibility.ts), 6/6 tests).
- **`CRK-SPEC-43`**: Migration and rollout stage coordinator managing the 8 canonical migration stages, Stage 7 multi-dimensional prerequisite gates, and dynamic canary traffic routing ([`src/core/migration/RolloutStageCoordinator.ts`](file:///c:/dev/Chatbot/src/core/migration/RolloutStageCoordinator.ts), [`src/types/rollout-migration.ts`](file:///c:/dev/Chatbot/src/types/rollout-migration.ts), 6/6 tests).
- **`CRK-SPEC-44`**: Canonical rollback coordinator providing multi-domain atomic rollback (runtime, dataset, retrieval policy, model policy) while verifying 6 mandatory data preservation invariants ([`src/core/migration/CanonicalRollbackCoordinator.ts`](file:///c:/dev/Chatbot/src/core/migration/CanonicalRollbackCoordinator.ts), [`src/types/rollback-recovery.ts`](file:///c:/dev/Chatbot/src/types/rollback-recovery.ts), 7/7 tests).
- **`CRK-SPEC-45`**: Observability specification and metrics registry implementing all 27 canonical telemetry metrics, strict cardinality guardrails, derived unnecessary retrieval rate calculation, and Prometheus exposition ([`src/core/observability/CanonicalMetricsRegistry.ts`](file:///c:/dev/Chatbot/src/core/observability/CanonicalMetricsRegistry.ts), [`src/types/observability-spec.ts`](file:///c:/dev/Chatbot/src/types/observability-spec.ts), 7/7 tests).

### Specifications 46-50: CLI Hub, Documentation Suite, CI Gates, Dataset Fixtures & Coding Policy (`CERTIFIED`)
- **`CRK-SPEC-46`**: Recommended CLI / scripts hub and runner coordinating 16 canonical commands with strict production auth/approval bypass protection ([`src/core/governance/CanonicalCliRegistry.ts`](file:///c:/dev/Chatbot/src/core/governance/CanonicalCliRegistry.ts), [`src/types/cli-scripts.ts`](file:///c:/dev/Chatbot/src/types/cli-scripts.ts), [`scripts/canonical-cli.ts`](file:///c:/dev/Chatbot/scripts/canonical-cli.ts), 9/9 tests).
- **`CRK-SPEC-47`**: Complete documentation deliverables suite comprising 12 required markdown guides, architecture references, implementation policies, and runbooks with automated compliance auditing ([`src/core/governance/DocumentationDeliverablesAuditor.ts`](file:///c:/dev/Chatbot/src/core/governance/DocumentationDeliverablesAuditor.ts), [`src/types/documentation-spec.ts`](file:///c:/dev/Chatbot/src/types/documentation-spec.ts), 5/5 tests).
- **`CRK-SPEC-48`**: Required CI gates orchestrator governing 13 PR merge gates and 5 release-only gates with zero-network external download enforcement ([`src/core/governance/CIGatesOrchestrator.ts`](file:///c:/dev/Chatbot/src/core/governance/CIGatesOrchestrator.ts), [`src/types/ci-gates.ts`](file:///c:/dev/Chatbot/src/types/ci-gates.ts), 7/7 tests).
- **`CRK-SPEC-49`**: Zero-network offline CI dataset fixture provider with 10 canonical domains/test vectors including conflicting source arbitration, deduplication, and adversarial prompt injection testing ([`src/core/knowledge/CanonicalDatasetFixtures.ts`](file:///c:/dev/Chatbot/src/core/knowledge/CanonicalDatasetFixtures.ts), [`src/core/knowledge/DatasetFixtureProvider.ts`](file:///c:/dev/Chatbot/src/core/knowledge/DatasetFixtureProvider.ts), [`src/types/dataset-fixtures.ts`](file:///c:/dev/Chatbot/src/types/dataset-fixtures.ts), 7/7 tests).
- **`CRK-SPEC-50`**: Coding-specific retrieval policy engine implementing project-evidence request analysis, 6-tier canonical source hierarchy, privacy-preserving error query expansion, local code adaptation validation, and honest verification reporting ([`src/core/knowledge/CodingRetrievalPolicyEngine.ts`](file:///c:/dev/Chatbot/src/core/knowledge/CodingRetrievalPolicyEngine.ts), [`src/types/coding-retrieval-policy.ts`](file:///c:/dev/Chatbot/src/types/coding-retrieval-policy.ts), 7/7 tests).

### Specifications 51-55: General Retrieval Policy, Memory vs Knowledge, Training Separation, Storage Planning & Backlog Reconciliation (`CERTIFIED`)
- **`CRK-SPEC-51`**: General knowledge retrieval policy engine with normal fact hierarchy, scientific literature routing, time-sensitive detection, and strict No False Freshness invariant ([`src/core/knowledge/GeneralRetrievalPolicyEngine.ts`](file:///c:/dev/Chatbot/src/core/knowledge/GeneralRetrievalPolicyEngine.ts), [`src/types/general-retrieval-policy.ts`](file:///c:/dev/Chatbot/src/types/general-retrieval-policy.ts), 7/7 tests).
- **`CRK-SPEC-52`**: Memory vs knowledge decision table arbiter strictly partitioning 9 storage classes, blocking cross-boundary pollution, and enforcing user consent rules ([`src/core/state/MemoryKnowledgeArbiter.ts`](file:///c:/dev/Chatbot/src/core/state/MemoryKnowledgeArbiter.ts), [`src/types/memory-knowledge-table.ts`](file:///c:/dev/Chatbot/src/types/memory-knowledge-table.ts), 8/8 tests).
- **`CRK-SPEC-53`**: Training and fine-tuning separation coordinator with directory/domain isolation, §53.3 anti-contamination check, and §53.4 four-prerequisite readiness evaluation ([`src/core/knowledge/TrainingSeparationCoordinator.ts`](file:///c:/dev/Chatbot/src/core/knowledge/TrainingSeparationCoordinator.ts), [`src/types/training-separation.ts`](file:///c:/dev/Chatbot/src/types/training-separation.ts), 7/7 tests).
- **`CRK-SPEC-54`**: Storage planning & install presets estimator implementing exact float32 vector sizing calculation, 5 tiered presets, indiscriminate embedding prohibition, and disk headroom safety checks ([`src/core/knowledge/StoragePlanningEstimator.ts`](file:///c:/dev/Chatbot/src/core/knowledge/StoragePlanningEstimator.ts), [`src/types/storage-planning.ts`](file:///c:/dev/Chatbot/src/types/storage-planning.ts), 6/6 tests).
- **`CRK-SPEC-55`**: Initial implementation backlog summary and governance reconciliation orchestrator tracking all 54 program tasks across CRK-P00 to CRK-P26 and Specifications 31 to 55, certifying 100% completion and release candidate readiness ([`src/core/governance/BacklogReconciliationOrchestrator.ts`](file:///c:/dev/Chatbot/src/core/governance/BacklogReconciliationOrchestrator.ts), [`src/types/backlog-reconciliation.ts`](file:///c:/dev/Chatbot/src/types/backlog-reconciliation.ts), 6/6 tests).

### Specifications 56-63: Program Completion, Definition of Done, Commands, Evidence, Auditor, Template, Handoff & Prohibited Shortcuts (`CERTIFIED`)
- **`CRK-SPEC-56`**: Final definition of done evaluator evaluating all 43 mandatory criteria across Runtime, Knowledge, Data, Quality, UI, and Operations domains ([`src/core/governance/RuntimeDefinitionOfDoneEvaluator.ts`](file:///c:/dev/Chatbot/src/core/governance/RuntimeDefinitionOfDoneEvaluator.ts), [`src/types/runtime-definition-of-done.ts`](file:///c:/dev/Chatbot/src/types/runtime-definition-of-done.ts), 4/4 tests).
- **`CRK-SPEC-57`**: Required implementation commands orchestrator wiring and validating 16 canonical test and evaluation commands in package.json with anti-fake enforcement ([`src/core/governance/VerificationCommandsOrchestrator.ts`](file:///c:/dev/Chatbot/src/core/governance/VerificationCommandsOrchestrator.ts), [`src/types/program-completion.ts`](file:///c:/dev/Chatbot/src/types/program-completion.ts), [`package.json`](file:///c:/dev/Chatbot/package.json), 5/5 tests).
- **`CRK-SPEC-58`**: Evidence required per knowledge pack validator enforcing all 15 required evidence artifacts for default-promoted packs ([`src/core/governance/KnowledgePackEvidenceValidator.ts`](file:///c:/dev/Chatbot/src/core/governance/KnowledgePackEvidenceValidator.ts), 2/2 tests).
- **`CRK-SPEC-59`**: Task-level definition of done auditor evaluating 25 discrete verification gates across Implementation, Tests, Verification, and Evidence ([`src/core/governance/TaskDefinitionOfDoneAuditor.ts`](file:///c:/dev/Chatbot/src/core/governance/TaskDefinitionOfDoneAuditor.ts), 1/1 tests).
- **`CRK-SPEC-60`**: New-thread implementation prompt template generator enforcing pre-edit reporting and task isolation ([`src/core/governance/ImplementationPromptTemplate.ts`](file:///c:/dev/Chatbot/src/core/governance/ImplementationPromptTemplate.ts), 1/1 tests).
- **`CRK-SPEC-61`**: Handoff additions builder and parser validating 13 metadata attributes for CRK handoffs ([`src/core/governance/HandoffAdditionsBuilder.ts`](file:///c:/dev/Chatbot/src/core/governance/HandoffAdditionsBuilder.ts), 1/1 tests).
- **`CRK-SPEC-62`**: Prohibited shortcuts detector coding and auditing all 20 prohibited shortcuts with active remediation guidance ([`src/core/governance/ProhibitedShortcutsDetector.ts`](file:///c:/dev/Chatbot/src/core/governance/ProhibitedShortcutsDetector.ts), 3/3 tests).
- **`CRK-SPEC-63`**: Final completion statement and program certification orchestrator synthesizing all 12 core product pillars and certifying 100% program completion across all 63 sections / phases and 62 tracked tasks ([`src/core/governance/CanonicalProgramCompletionOrchestrator.ts`](file:///c:/dev/Chatbot/src/core/governance/CanonicalProgramCompletionOrchestrator.ts), [`src/core/governance/BacklogReconciliationOrchestrator.ts`](file:///c:/dev/Chatbot/src/core/governance/BacklogReconciliationOrchestrator.ts), 6/6 tests).

---

## Quality & Verification Gates

- Full Type Check (`npm run type-check`): **PASS** (Server, Tests, Client: 0 errors).
- Server Linter (`npm run lint:server`): **PASS** (0 warnings/errors).
- Client Linter (`npm run lint:client`): **PASS** (0 warnings/errors).
- CRK Test Suite: **PASS** (523+ tests across 117+ test suites).
- Source File Line Count Constraint: **PASS** (all production files <= 186 lines, strictly under 300-line ceiling).
- Architecture Rules: §838, §907, §1041, §1064, §1180, §1191, §1206, §1278, §1530, §1555, §1586, §1605, §1834, §1861-1864, §1875-1890, §1907, §1928-1936, §1958-1966, §2006-2016, §2021-2046, §2064-2072, §2091-2112, §2156-2174, §2177-2192, §2193-2208, §2212-2230, §2231-2246, §2247-2256, §2258-2268, §2289-2303, §2305-2317, §2318-2332, §2333-2344, §2345-2353, §2381-2411, §2414-2443, §2456-2465, §2506-2525, §2529-2548, §2566-2610, §2612-2628, §2629-2641, §2672, §2717, §2758, §2762-2767, §2845, §2870, §2872-2892, §2894, §2933-2938, §2941-2949, §2964-2974, §2994-3010, §3013-3025, §3028-3039, §3075-3091, §3095-3105, §3106-3111, §3120, §3140-3151, §3155-3180, §3185, §3201-3203, §3208-3215, §3252-3264, §3293-3310, §3311-3320, §3338-3350, §3382-3386, §3401-3434, §3435-3451, §3504-3524, §3540-3558, §3598-3605, §3650-3667, §3684-3693, §3715-3719, §3736-3756, §3757-3772, §3773-3790, §3791-3800, §3801-3821, §3822-3834, §3835-3859, §3860-3875, §3876-3886, Sections 27–30, Sections 31–40, Sections 41–45, Sections 46–50, Sections 51–55, and Sections 56–63 (Definition of Done, Commands Orchestration, Evidence Validation, Task DoD Auditor, Prompt Template, Handoff Additions, Prohibited Shortcuts, and Program Completion) verified.

---

## Program Completion Status

**ALL 63 PHASES AND SPECIFICATIONS COMPLETED AND CERTIFIED (CRK PHASES 00 THROUGH 26 & SPECIFICATIONS 31 THROUGH 63 — 100% COMPLETE)**
- **Phase 00 through Phase 26**: 100% implemented, verified, and certified with comprehensive unit & integration test suites.
- **Architectural Specifications (Sections 27 through 63)**: Fully implemented, tested, and certified across runtime, data, evaluation, governance, client, rollout, observability, CLI tooling, documentation, CI gates, offline fixtures, coding-specific retrieval policy, general retrieval policy, memory/knowledge arbitration, training separation, storage planning, backlog reconciliation, definition of done evaluation, implementation command orchestration, pack evidence verification, task DoD auditing, implementation prompt templating, handoff metadata additions, prohibited shortcuts detection, and program completion certification.
- The Canonical Chat Runtime & Knowledge Platform implementation plan (`AI_CHATBOT_HUB_CANONICAL_RUNTIME_KNOWLEDGE_IMPLEMENTATION_PLAN (1).md`) through Section 63 has been completely fulfilled and certified.



