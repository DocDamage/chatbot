/**
 * Canonical Chat Context Planner (CRK-P05-T02, T04, T05, T06)
 *
 * Implements the context planning stage of the canonical runtime, determining
 * precisely what information resources a request actually requires prior to
 * retrieval or prompt assembly.
 */

import {
  NormalizedChatRequest,
  TaskClassificationResult,
  ChatContextPlan,
} from '../../types/chat-runtime';
import {
  ChatConversationState,
  ChatWorkflowDefinition,
  ChatPolicyResolution,
  IChatContextPlanner,
} from './ChatRuntime';
import {
  ContextPlan,
  ContextRequirement,
  SkippedRequirement,
} from '../../types/context-plan';
import { ContextRoutingSignals } from './ContextRoutingSignals';
import { ContextClassifier } from './ContextClassifier';
import { ProjectContextPlanner } from './ProjectContextPlanner';
import { ContextPlanDiagnostics } from './ContextPlanDiagnostics';

export interface ChatContextPlannerOptions {
  classifier?: ContextClassifier;
  defaultAnswerReserveTokens?: number;
}

export class ChatContextPlanner implements IChatContextPlanner {
  private readonly classifier?: ContextClassifier;
  private readonly defaultAnswerReserveTokens: number;

  constructor(options: ChatContextPlannerOptions = {}) {
    this.classifier = options.classifier;
    this.defaultAnswerReserveTokens = options.defaultAnswerReserveTokens || 2000;
  }

  public async plan(params: {
    request: NormalizedChatRequest;
    state: ChatConversationState;
    analysis: TaskClassificationResult;
    workflow?: ChatWorkflowDefinition;
    policy: ChatPolicyResolution;
  }): Promise<ChatContextPlan> {
    const { request, state, analysis, workflow, policy } = params;

    // 1. Extract multi-dimensional deterministic routing signals
    const signals = ContextRoutingSignals.extract(request, state);

    // 2. Fall back to bounded classifier if deterministic confidence is low (§1257)
    let classifierResult = null;
    if (signals.confidence < 0.75 && this.classifier) {
      classifierResult = await this.classifier.classify(request.message);
    }

    const requirements: ContextRequirement[] = [];
    const skippedRequirements: SkippedRequirement[] = [];
    const rationaleCodes: string[] = [];

    // Conversation requirement: always bounded
    requirements.push({
      type: 'conversation',
      maxTokens: 4000,
    });

    // Variables requirement
    const activeVariableKeys: string[] = [];
    if (signals.isCodingOrDebug || signals.isProjectRepoWork) {
      activeVariableKeys.push('programmingLanguage', 'framework', 'operatingSystem', 'repository');
    }
    if (signals.activePlanReferenced || request.activePlan) {
      activeVariableKeys.push('activePlan', 'currentStep');
      rationaleCodes.push('ACTIVE_PLAN_REFERENCED');
    }
    if (activeVariableKeys.length > 0) {
      requirements.push({
        type: 'variables',
        keys: Array.from(new Set(activeVariableKeys)),
      });
    }

    // Explicit No-Retrieval Path (§1278-1290)
    let useRAG = false;
    let selectedPacks: string[] = [];

    if (signals.explicitNoSearch) {
      requirements.push({ type: 'none', reason: 'User explicitly requested no online search' });
      skippedRequirements.push({ type: 'knowledge', reason: 'User disallowed search' });
      rationaleCodes.push('NO_RAG_USER_RESTRICTED');
    } else if (signals.hasLoadedContentSufficient) {
      requirements.push({ type: 'none', reason: 'Loaded attachment contains sufficient context' });
      skippedRequirements.push({ type: 'knowledge', reason: 'Attached file is sufficient' });
      rationaleCodes.push('NO_RAG_ATTACHED_SUFFICIENT');
    } else if (signals.isGreetingOrBrainstorm) {
      requirements.push({ type: 'none', reason: 'Greeting or brainstorming requires no retrieval' });
      skippedRequirements.push({ type: 'knowledge', reason: 'Greeting or brainstorm query' });
      rationaleCodes.push('NO_RAG_GREETING_OR_BRAINSTORM');
    } else if (signals.isTextRewritingOrCreative) {
      requirements.push({ type: 'none', reason: 'Creative task or text rewriting requires no retrieval' });
      skippedRequirements.push({ type: 'knowledge', reason: 'Creative or text transformation task' });
      rationaleCodes.push('NO_RAG_CREATIVE_OR_REWRITE');
    } else {
      // Knowledge retrieval path
      useRAG = true;
      if (signals.isMathOrProof) {
        selectedPacks = ['math'];
        rationaleCodes.push('KNOWLEDGE_MATH_PACK');
      } else if (signals.isCodingOrDebug) {
        selectedPacks = ['core-official-docs', 'developer-qa'];
        rationaleCodes.push('KNOWLEDGE_CODING_PACKS');
      } else if (signals.isGeneralKnowledge) {
        selectedPacks = ['general-knowledge'];
        rationaleCodes.push('KNOWLEDGE_GENERAL_PACK');
      } else if (classifierResult?.needsKnowledge) {
        selectedPacks = classifierResult.knowledgeDomains.length > 0
          ? classifierResult.knowledgeDomains
          : ['core-official-docs'];
        rationaleCodes.push('KNOWLEDGE_CLASSIFIER_PACKS');
      } else {
        selectedPacks = ['general-knowledge'];
        rationaleCodes.push('KNOWLEDGE_DEFAULT_PACK');
      }

      const filters: Record<string, unknown> = {};
      if (signals.detectedLanguages.length > 0) {
        filters.languages = signals.detectedLanguages;
      }
      if (signals.hasFreshnessRequirement) {
        filters.requireFreshness = true;
        rationaleCodes.push('VERSION_FILTERED_DOCS');
      }

      requirements.push({
        type: 'knowledge',
        packs: selectedPacks,
        query: request.message,
        filters,
        maxChunks: 5,
      });
    }

    // Project context planning (§1291-1304)
    if (signals.isProjectRepoWork || signals.isCodingOrDebug || classifierResult?.needsProject) {
      const projectReq = ProjectContextPlanner.plan({
        message: request.message,
        loadedFilePaths: request.loadedFiles?.map(f => f.path),
        detectedLanguages: signals.detectedLanguages,
        hasTestFailure: /test fails|test failure/i.test(request.message),
      });
      requirements.push(projectReq);
      rationaleCodes.push('PROJECT_STRUCTURAL_CONTEXT');
    }

    // Tool requirement
    const enabledTools: string[] = [];
    if (policy.toolsEnabled) {
      if (signals.isCodingOrDebug || workflow?.name?.includes('Coding')) {
        enabledTools.push('file_search', 'code_runner');
        requirements.push({
          type: 'tool',
          toolId: 'file_search',
          reason: 'Locate relevant codebase files and symbols',
        });
        rationaleCodes.push('TOOL_FILE_SEARCH');
      }
    }

    const structuredPlan: ContextPlan = {
      requestId: request.requestId,
      requirements,
      answerReserveTokens: this.defaultAnswerReserveTokens,
      rationaleCodes,
      skippedRequirements,
      tokenBudgets: {
        conversation: 4000,
        project: signals.isProjectRepoWork ? 4000 : 0,
        knowledge: useRAG ? 3000 : 0,
        answer: this.defaultAnswerReserveTokens,
      },
      confidence: classifierResult ? classifierResult.confidence : signals.confidence,
    };

    // Log diagnostic observability (§1305-1317)
    ContextPlanDiagnostics.summarize(structuredPlan);

    // Return unified ChatContextPlan with embedded structuredPlan
    return {
      requestId: request.requestId,
      traceId: `trc_${request.requestId}`,
      taskClassification: analysis,
      retrievalStrategy: {
        useRAG,
        packIds: selectedPacks.length > 0 ? selectedPacks : undefined,
        maxSources: useRAG ? 5 : 0,
      },
      memoryStrategy: {
        includeHistory: true,
        maxMessages: 10,
        includeVariables: activeVariableKeys.length > 0,
      },
      toolStrategy: {
        enabledTools,
        requireApproval: workflow ? true : false,
      },
      modelStrategy: {
        policy: request.requestedModelPolicy || 'balanced',
      },
      budgetLimits: {
        maxContextTokens: policy.maxContextTokens || 16000,
        maxOutputTokens: this.defaultAnswerReserveTokens,
      },
      structuredPlan,
    };
  }
}
