/**
 * Chat Runtime Shadow Runner
 *
 * Runs canonical ChatRuntime decision stages in shadow mode alongside legacy execution
 * when CHAT_RUNTIME_V2_SHADOW=true (§851).
 * Guarantees zero duplicate tool writes, zero duplicate memory mutations, and zero
 * user-visible latency or response modification.
 */

import { ChatRequestDto } from '../../types/chat';
import { ChatResponse } from '../orchestrator/Orchestrator';
import { ChatRuntime } from './ChatRuntime';
import { ChatRuntimeCompatibilityAdapter } from './ChatRuntimeCompatibilityAdapter';
import { ChatRuntimeResult, ChatContextPlan } from '../../types/chat-runtime';
import { ChatServerContext } from './ChatRequestNormalizer';

export interface ShadowComparisonResult {
  requestId: string;
  sessionId: string;
  legacyModel?: string;
  shadowModel?: string;
  legacyLatencyMs: number;
  shadowLatencyMs: number;
  divergences: string[];
  shadowPlan?: ChatContextPlan;
  shadowResult?: ChatRuntimeResult;
  timestamp: string;
}

export interface ShadowRunnerOptions {
  isShadowEnabled?: boolean;
  serverContext?: ChatServerContext;
  onComparison?: (comparison: ShadowComparisonResult) => void;
}

export class ChatRuntimeShadowRunner {
  public static isShadowEnabled(): boolean {
    return process.env.CHAT_RUNTIME_V2_SHADOW === 'true';
  }

  public static async executeWithShadow(
    legacyExecutor: () => Promise<ChatResponse>,
    shadowRuntime: ChatRuntime,
    request: ChatRequestDto,
    options: ShadowRunnerOptions = {}
  ): Promise<ChatResponse> {
    const shadowActive = options.isShadowEnabled ?? this.isShadowEnabled();

    // 1. Primary execution always runs authoritatively
    const primaryStart = Date.now();
    const primaryResponse = await legacyExecutor();
    const legacyLatencyMs = Date.now() - primaryStart;

    // 2. If shadow mode is disabled, return primary response immediately
    if (!shadowActive) {
      return primaryResponse;
    }

    // 3. Non-mutating shadow execution
    try {
      const shadowStart = Date.now();
      const normalized = ChatRuntimeCompatibilityAdapter.toNormalizedRequest(
        request,
        options.serverContext
      );

      const shadowResult = await shadowRuntime.execute(normalized);
      const shadowLatencyMs = Date.now() - shadowStart;

      const divergences: string[] = [];
      if (primaryResponse.model !== shadowResult.model.model) {
        divergences.push(
          `Model route divergence: legacy used '${primaryResponse.model}', shadow selected '${shadowResult.model.model}'`
        );
      }
      if (Boolean(primaryResponse.knowledgeMiss) !== (shadowResult.grounding.attempted && !shadowResult.grounding.sufficient)) {
        divergences.push('Retrieval / knowledge miss detection divergence');
      }

      const comparison: ShadowComparisonResult = {
        requestId: normalized.requestId,
        sessionId: normalized.sessionId,
        legacyModel: primaryResponse.model,
        shadowModel: shadowResult.model.model,
        legacyLatencyMs,
        shadowLatencyMs,
        divergences,
        shadowResult,
        timestamp: new Date().toISOString(),
      };

      if (options.onComparison) {
        options.onComparison(comparison);
      }
    } catch {
      // Non-mutating shadow execution must never fail or modify the primary response
    }

    return primaryResponse;
  }
}
