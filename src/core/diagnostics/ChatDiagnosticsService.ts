/**
 * Chat Diagnostics Service (CRK-P23-T01, T02, T03, T05)
 *
 * Tracks the execution lifecycle of canonical chat runs, measuring per-stage timing,
 * categorizing failures into normalized taxonomy codes, and producing developer diagnostic reports.
 */

import {
  ChatRunRecord,
  FailureTaxonomyCode,
  StageTimings,
} from '../../types/chat-diagnostics';
import { ChatRunRepository } from './ChatRunRepository';

export interface StartRunParams {
  requestId: string;
  traceId: string;
  sessionId: string;
  userId?: string;
  taskType: string;
  intent?: string;
  workflowId?: string;
  botProfileVersion?: string;
  modelPolicyVersion?: string;
  retrievalPolicyVersion?: string;
}

export class ChatDiagnosticsService {
  constructor(private readonly repository: ChatRunRepository = new ChatRunRepository()) {}

  public startRun(params: StartRunParams): ChatRunRecord {
    const record: ChatRunRecord = {
      requestId: params.requestId,
      traceId: params.traceId,
      sessionId: params.sessionId,
      userId: params.userId,
      startedAt: new Date().toISOString(),
      status: 'success', // Provisional until finish
      taskType: params.taskType,
      intent: params.intent,
      workflowId: params.workflowId,
      botProfileVersion: params.botProfileVersion || 'default-v1.0',
      contextPlanSummary: {},
      modelPolicyVersion: params.modelPolicyVersion || 'default-policy-v1',
      retrievalPolicyVersion: params.retrievalPolicyVersion,
      selectedSourceIds: [],
      toolCallIds: [],
      validationCodes: [],
      stageTimings: {},
    };

    return this.repository.save(record);
  }

  public recordStageTiming(requestId: string, stage: keyof StageTimings, durationMs: number): void {
    const rec = this.repository.getByRequestId(requestId);
    if (!rec) return;

    rec.stageTimings[stage] = durationMs;
    this.repository.save(rec);
  }

  public finishRunSuccess(
    requestId: string,
    details: {
      selectedModel?: { provider: string; model: string; fallbackUsed: boolean };
      selectedSourceIds?: string[];
      toolCallIds?: string[];
      validationCodes?: string[];
      contextPlanSummary?: Record<string, unknown>;
      latencyMs?: number;
    }
  ): ChatRunRecord | null {
    const rec = this.repository.getByRequestId(requestId);
    if (!rec) return null;

    rec.status = 'success';
    rec.completedAt = new Date().toISOString();
    if (details.selectedModel) rec.selectedModel = details.selectedModel;
    if (details.selectedSourceIds) rec.selectedSourceIds = details.selectedSourceIds;
    if (details.toolCallIds) rec.toolCallIds = details.toolCallIds;
    if (details.validationCodes) rec.validationCodes = details.validationCodes;
    if (details.contextPlanSummary) rec.contextPlanSummary = details.contextPlanSummary;
    if (details.latencyMs !== undefined) rec.latencyMs = details.latencyMs;

    return this.repository.save(rec);
  }

  public finishRunFailure(
    requestId: string,
    error: Error | string,
    failureCode?: FailureTaxonomyCode,
    latencyMs?: number
  ): ChatRunRecord | null {
    const rec = this.repository.getByRequestId(requestId);
    if (!rec) return null;

    const errorMessage = typeof error === 'string' ? error : error.message;
    const classifiedCode = failureCode || this.classifyErrorToTaxonomy(errorMessage);

    rec.status = 'failed';
    rec.completedAt = new Date().toISOString();
    rec.failureCode = classifiedCode;
    rec.failureMessage = errorMessage;
    if (latencyMs !== undefined) rec.latencyMs = latencyMs;

    return this.repository.save(rec);
  }

  public getDiagnostics(requestId: string): ChatRunRecord | null {
    return this.repository.getByRequestId(requestId);
  }

  public getRepository(): ChatRunRepository {
    return this.repository;
  }

  public classifyErrorToTaxonomy(message: string): FailureTaxonomyCode {
    const lower = message.toLowerCase();
    if (lower.includes('rate limit') || lower.includes('429')) return 'MODEL_RATE_LIMITED';
    if (lower.includes('timeout') || lower.includes('timed out')) return 'MODEL_TIMEOUT';
    if (lower.includes('model unavailable') || lower.includes('503')) return 'MODEL_UNAVAILABLE';
    if (lower.includes('auth') || lower.includes('unauthorized') || lower.includes('401')) return 'AUTH_BLOCKED';
    if (lower.includes('grounding') || lower.includes('insufficient evidence')) return 'GROUNDING_INSUFFICIENT';
    if (lower.includes('validation') || lower.includes('code fence')) return 'VALIDATION_FAILED';
    if (lower.includes('tool failed') || lower.includes('tool execution')) return 'TOOL_FAILED';
    if (lower.includes('tool blocked') || lower.includes('unapproved')) return 'TOOL_BLOCKED';
    if (lower.includes('pack unavailable') || lower.includes('knowledge pack')) return 'KNOWLEDGE_PACK_UNAVAILABLE';
    if (lower.includes('retrieval empty') || lower.includes('no documents')) return 'RETRIEVAL_EMPTY';
    if (lower.includes('context plan') || lower.includes('planner')) return 'CONTEXT_PLANNING_FAILED';
    if (lower.includes('cancelled') || lower.includes('abort')) return 'CANCELLED';
    return 'REQUEST_INVALID';
  }
}
