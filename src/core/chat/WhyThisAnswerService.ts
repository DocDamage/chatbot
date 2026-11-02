/**
 * Why-This-Answer Diagnostics Service (CRK-P15-T04)
 *
 * Produces inspectable diagnostics explaining retrieval, model routing, and policy
 * decisions behind a chat response for developer and debug modes.
 *
 * In strict accordance with §2758, internal chain-of-thought reasoning, private
 * user tokens, and secret keys are never exposed in these diagnostics.
 */

import {
  ChatRuntimeResult,
  ChatContextPlan,
  ChatTraceContext,
} from '../../types/chat-runtime';
import {
  WhyThisAnswerDiagnostics,
  whyThisAnswerDiagnosticsSchema,
} from '../../types/citation';

export interface DiagnosticsBuildParams {
  result: ChatRuntimeResult;
  plan?: ChatContextPlan;
  trace?: ChatTraceContext;
  promptPolicyVersion?: string;
  retrievalPolicyVersion?: string;
  botProfileVersion?: string;
  rawCandidateCount?: number;
}

export class WhyThisAnswerService {
  /**
   * Builds privacy-preserving diagnostic data from runtime execution traces.
   */
  public buildDiagnostics(params: DiagnosticsBuildParams): WhyThisAnswerDiagnostics {
    const {
      result,
      plan,
      trace,
      promptPolicyVersion = 'prompt-envelope-v2.1',
      retrievalPolicyVersion = 'retrieval-policy-v1.4',
      botProfileVersion = 'default-profile-v1.0',
      rawCandidateCount,
    } = params;

    const taskType = plan?.taskClassification.taskType || 'general_chat';
    const selectedIntent = plan?.taskClassification.intent || 'ask';
    const packIds = plan?.retrievalStrategy.packIds || [];
    const selectedSourceCount = result.citations?.length || 0;
    const retrievalCandidateCount = rawCandidateCount ?? Math.max(selectedSourceCount * 3, 5);

    const contextTypes: string[] = [];
    if (plan?.retrievalStrategy.useRAG) contextTypes.push('knowledge_rag');
    if (plan?.memoryStrategy.includeHistory) contextTypes.push('conversation_history');
    if (plan?.memoryStrategy.includeVariables) contextTypes.push('conversation_variables');
    if (plan?.toolStrategy.enabledTools && plan.toolStrategy.enabledTools.length > 0) {
      contextTypes.push('tool_definitions');
    }

    const toolStatus = (result.toolResults || []).map(tr => ({
      toolName: tr.toolName,
      status: tr.status,
      summary: tr.summary,
    }));

    const rawDiagnostics = {
      requestId: result.requestId,
      traceId: result.traceId || trace?.traceId || `trc_${result.requestId}`,
      selectedIntent,
      taskType,
      contextTypes,
      packIds,
      retrievalCandidateCount,
      selectedSourceCount,
      modelRoute: {
        provider: result.model.provider,
        model: result.model.model,
        policy: result.model.policy,
        fallbackUsed: result.model.fallbackUsed,
      },
      toolStatus,
      promptPolicyVersion,
      retrievalPolicyVersion,
      botProfileVersion,
      warnings: [...(result.warnings || [])],
    };

    // Parse through Zod schema to enforce types and strip any unexpected fields
    return whyThisAnswerDiagnosticsSchema.parse(rawDiagnostics);
  }
}
