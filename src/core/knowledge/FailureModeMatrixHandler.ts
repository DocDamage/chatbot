export type FailureModeCode =
  | 'PACK_NOT_INSTALLED'
  | 'DATASET_UPDATE_FAILED'
  | 'HALF_INDEXED_VERSION'
  | 'EMBEDDING_PROVIDER_FAILED'
  | 'VECTOR_SEARCH_FAILED'
  | 'LEXICAL_SEARCH_FAILED'
  | 'RERANKER_FAILED'
  | 'MODEL_UNAVAILABLE'
  | 'TOOL_BLOCKED'
  | 'PROJECT_UNAVAILABLE'
  | 'USER_DELETES_CONVERSATION'
  | 'FEEDBACK_WRITE_FAILED'
  | 'DIAGNOSTICS_PERSISTENCE_FAILED'
  | 'SOURCE_CITATION_MISSING'
  | 'STALE_TECHNICAL_SOURCE'
  | 'CONFLICTING_SOURCES'
  | 'DISK_LOW_DURING_INSTALL'
  | 'PROCESS_RESTART_DURING_INSTALL'
  | 'MALICIOUS_RETRIEVED_INSTRUCTIONS';

export interface FailureResolutionResult {
  code: FailureModeCode;
  actionTaken: string;
  isGraceful: boolean;
  userFacingNotice?: string;
  fallbackData?: unknown;
  operationalAlert?: string;
}

export class FailureModeMatrixHandler {
  /**
   * Resolves a failure scenario according to the Section 35 matrix rules.
   */
  public static resolveFailure(
    code: FailureModeCode,
    context: Record<string, any> = {}
  ): FailureResolutionResult {
    switch (code) {
      case 'PACK_NOT_INSTALLED':
        return {
          code,
          actionTaken: 'USE_ALLOWED_ALTERNATIVES_OR_STATE_UNAVAILABLE',
          isGraceful: true,
          userFacingNotice: context.alternativePack
            ? `Requested knowledge pack '${context.packId}' is not installed. Falling back to '${context.alternativePack}'.`
            : `Knowledge pack '${context.packId}' is currently not installed on this system.`,
          fallbackData: { alternativeUsed: context.alternativePack || null }
        };

      case 'DATASET_UPDATE_FAILED':
        return {
          code,
          actionTaken: 'PRESERVE_PREVIOUS_READY_VERSION',
          isGraceful: true,
          operationalAlert: `Dataset update for '${context.packId}' failed: ${context.error || 'Unknown'}. Keeping version ${context.activeVersion} active.`,
          fallbackData: { activeVersion: context.activeVersion }
        };

      case 'HALF_INDEXED_VERSION':
        return {
          code,
          actionTaken: 'NEVER_ROUTE_TO_NON_READY_VERSION',
          isGraceful: true,
          fallbackData: { routedVersion: context.readyVersion || null },
          operationalAlert: `Version ${context.version} is in status '${context.status}'. Routing rejected.`
        };

      case 'EMBEDDING_PROVIDER_FAILED':
        return {
          code,
          actionTaken: 'BOUNDED_RETRY_AND_RETAIN_PRIOR_INDEX',
          isGraceful: true,
          operationalAlert: `Embedding provider failed: ${context.error}. Retry budget exhausted; retained existing embeddings.`
        };

      case 'VECTOR_SEARCH_FAILED':
        return {
          code,
          actionTaken: 'FALLBACK_TO_LEXICAL_SEARCH',
          isGraceful: true,
          operationalAlert: 'Vector search failed. Falling back to BM25 lexical search with degraded confidence flag.',
          fallbackData: { degradedMode: true, provider: 'lexical' }
        };

      case 'LEXICAL_SEARCH_FAILED':
        return {
          code,
          actionTaken: 'FALLBACK_TO_VECTOR_SEARCH',
          isGraceful: true,
          operationalAlert: 'Lexical search failed. Falling back to dense vector search.',
          fallbackData: { degradedMode: true, provider: 'vector' }
        };

      case 'RERANKER_FAILED':
        return {
          code,
          actionTaken: 'DETERMINISTIC_SCORE_SORT_FALLBACK',
          isGraceful: true,
          operationalAlert: 'Reranker failed; preserved original reciprocal rank fusion order.',
          fallbackData: { rerankBypassed: true }
        };

      case 'MODEL_UNAVAILABLE':
        return {
          code,
          actionTaken: context.fallbackModel ? 'COMPATIBLE_MODEL_FALLBACK' : 'TERMINAL_ERROR',
          isGraceful: Boolean(context.fallbackModel),
          userFacingNotice: context.fallbackModel
            ? `Primary model '${context.model}' unavailable. Routed to compatible fallback '${context.fallbackModel}'.`
            : `Requested model is currently unavailable and no compatible fallback is configured.`,
          fallbackData: { fallbackModel: context.fallbackModel || null }
        };

      case 'TOOL_BLOCKED':
        return {
          code,
          actionTaken: 'RECORD_TOOL_NOT_RUN',
          isGraceful: true,
          userFacingNotice: `Tool execution for '${context.toolName}' was blocked by policy: ${context.reason || 'Permission denied'}.`,
          fallbackData: { executed: false, blocked: true }
        };

      case 'PROJECT_UNAVAILABLE':
        return {
          code,
          actionTaken: 'ABSTAIN_NO_INVENTED_EVIDENCE',
          isGraceful: true,
          userFacingNotice: 'Project workspace is not connected or reachable. No repository context could be inspected.',
          fallbackData: { projectEvidence: [] }
        };

      case 'USER_DELETES_CONVERSATION':
        return {
          code,
          actionTaken: 'PURGE_STATE_AND_VARIABLES',
          isGraceful: true,
          fallbackData: { purged: true, conversationId: context.conversationId }
        };

      case 'FEEDBACK_WRITE_FAILED':
        return {
          code,
          actionTaken: 'DELIVER_RESPONSE_LOG_FEEDBACK_ERROR',
          isGraceful: true,
          userFacingNotice: 'Your feedback could not be saved at this moment, but your conversation was unaffected.',
          operationalAlert: `Failed to persist feedback: ${context.error}`
        };

      case 'DIAGNOSTICS_PERSISTENCE_FAILED':
        return {
          code,
          actionTaken: 'CONTINUE_RESPONSE_EMIT_ALERT',
          isGraceful: true,
          operationalAlert: `Diagnostics trace write failed: ${context.error}`
        };

      case 'SOURCE_CITATION_MISSING':
        return {
          code,
          actionTaken: 'SUPPRESS_BROKEN_CITATION_RENDER',
          isGraceful: true,
          fallbackData: { omittedCount: 1 }
        };

      case 'STALE_TECHNICAL_SOURCE':
        return {
          code,
          actionTaken: context.isHistoricalQuery ? 'ALLOW_HISTORICAL' : 'DOWNRANK_STALE_SOURCE',
          isGraceful: true,
          fallbackData: { downranked: !context.isHistoricalQuery }
        };

      case 'CONFLICTING_SOURCES':
        return {
          code,
          actionTaken: 'ACKNOWLEDGE_CONFLICT_AND_TRACE',
          isGraceful: true,
          userFacingNotice: 'Found differing guidance across technical sources; prioritized the official release documentation.',
          fallbackData: { conflictLogged: true }
        };

      case 'DISK_LOW_DURING_INSTALL':
        return {
          code,
          actionTaken: 'ABORT_BEFORE_CORRUPTION',
          isGraceful: false,
          userFacingNotice: 'Knowledge pack download aborted: available disk space is below safety threshold.',
          operationalAlert: `Low disk threshold breached: ${context.freeDisk} GB remaining.`
        };

      case 'PROCESS_RESTART_DURING_INSTALL':
        return {
          code,
          actionTaken: 'RESUME_OR_ROLLBACK_CHECKPOINT',
          isGraceful: true,
          operationalAlert: `Detected interrupted job ${context.jobId} on restart. Rolled back incomplete files to clean checkpoint.`
        };

      case 'MALICIOUS_RETRIEVED_INSTRUCTIONS':
        return {
          code,
          actionTaken: 'INERT_EVIDENCE_BOUNDARY_ENFORCED',
          isGraceful: true,
          fallbackData: { executionSuppressed: true },
          operationalAlert: 'Adversarial instruction patterns detected in retrieved document chunk; tagged inert.'
        };
    }
  }
}
