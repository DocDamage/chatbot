/**
 * Chat Runtime Compatibility Adapter
 *
 * Provides bidirectional translation between legacy route contracts (ChatRequestDto,
 * ChatResponse) and canonical ChatRuntime contracts (NormalizedChatRequest, ChatRuntimeResult).
 * Enables zero-downtime progressive migration without a flag-day API rewrite (§844).
 */

import { NormalizedChatRequest, ChatRuntimeResult } from '../../types/chat-runtime';
import { ChatRequestDto } from '../../types/chat';
import { ChatResponse } from '../orchestrator/Orchestrator';
import { ChatRequestNormalizer, ChatServerContext } from './ChatRequestNormalizer';
import { ChatRuntime } from './ChatRuntime';

export interface V2ChatResponse {
  id: string;
  response: string;
  sessionId: string;
  model: {
    provider: string;
    model: string;
    policy: string;
  };
  citations: Array<{
    id: string;
    title: string;
    sourceUrl?: string;
  }>;
  latencyMs: number;
  traceId: string;
  grounding?: {
    attempted: boolean;
    sufficient: boolean;
    confidence?: number;
  };
}

export class ChatRuntimeCompatibilityAdapter {
  public static toNormalizedRequest(
    legacy: ChatRequestDto,
    serverContext?: ChatServerContext
  ): NormalizedChatRequest {
    return ChatRequestNormalizer.normalize(legacy, serverContext);
  }

  public static toLegacyResponse(
    result: ChatRuntimeResult,
    contractVersion: string = '1.0.0'
  ): ChatResponse {
    const isKnowledgeMiss = result.grounding.attempted && !result.grounding.sufficient;

    return {
      response: result.response,
      artifactId: result.traceId,
      contractVersion,
      latency: result.latencyMs,
      model: result.model.model,
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
      knowledgeMiss: isKnowledgeMiss ? true : undefined,
      canSearchOnline: isKnowledgeMiss ? true : undefined,
      proposedWebQuery: isKnowledgeMiss ? result.response.slice(0, 100) : undefined,
    };
  }

  public static toV2Response(result: ChatRuntimeResult, sessionId: string): V2ChatResponse {
    return {
      id: result.requestId,
      response: result.response,
      sessionId,
      model: {
        provider: result.model.provider,
        model: result.model.model,
        policy: result.model.policy,
      },
      citations: result.citations.map(c => ({
        id: c.id,
        title: c.title,
        sourceUrl: c.sourceUrl,
      })),
      latencyMs: result.latencyMs,
      traceId: result.traceId,
      grounding: result.grounding,
    };
  }

  public static createOrchestratorBridge(runtime: ChatRuntime) {
    return {
      processRequest: async (legacyRequest: ChatRequestDto, serverContext?: ChatServerContext): Promise<ChatResponse> => {
        const normalized = ChatRuntimeCompatibilityAdapter.toNormalizedRequest(legacyRequest, serverContext);
        const result = await runtime.execute(normalized);
        return ChatRuntimeCompatibilityAdapter.toLegacyResponse(result);
      },
      processRequestV2: async (legacyRequest: ChatRequestDto, serverContext?: ChatServerContext): Promise<V2ChatResponse> => {
        const normalized = ChatRuntimeCompatibilityAdapter.toNormalizedRequest(legacyRequest, serverContext);
        const result = await runtime.execute(normalized);
        return ChatRuntimeCompatibilityAdapter.toV2Response(result, normalized.sessionId);
      },
    };
  }
}
