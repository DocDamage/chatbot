/**
 * Section 42: API and Type Compatibility Bridge
 * Translates between legacy and canonical payloads and manages deprecation lifecycles.
 */
import {
  ApiClientVersion,
  LegacyChatRequestPayload,
  LegacyChatResponsePayload,
  ClientNegotiationInfo,
  DeprecationPolicyCheck,
} from '../../types/api-compatibility';
import {
  NormalizedChatRequest,
  ChatRuntimeResult,
} from '../../types/chat-runtime';

export class APICompatibilityBridge {
  negotiateClientVersion(headerVersion?: string): ClientNegotiationInfo {
    if (!headerVersion || headerVersion === 'v1' || headerVersion === 'v1_legacy') {
      return {
        version: 'v1_legacy',
        isLegacy: true,
        warnings: ['Using deprecated API v1. Please upgrade to v2_canonical.'],
        deprecationNotice: 'API v1 is scheduled for deprecation after the release window elapses.',
      };
    }

    if (headerVersion === 'v2_canary') {
      return {
        version: 'v2_canary',
        isLegacy: false,
      };
    }

    return {
      version: 'v2_canonical',
      isLegacy: false,
    };
  }

  normalizeLegacyRequest(
    payload: LegacyChatRequestPayload,
    clientVersion: ApiClientVersion = 'v1_legacy',
  ): NormalizedChatRequest {
    const text = payload.prompt || payload.message || '';
    const userId = payload.userId || 'anonymous';
    const conversationId = payload.conversationId || payload.sessionId || `legacy-sess-${Date.now()}`;

    return {
      requestId: `req-legacy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sessionId: conversationId,
      userId,
      message: text,
      botProfileId: 'default',
      loadedFiles: [],
      loadedAudio: [],
      clientCapabilities: {
        streaming: payload.options?.stream ?? false,
        citations: clientVersion !== 'v1_legacy',
        toolApproval: false,
      },
      requestedModelPolicy: payload.options?.model,
      metadata: {
        rawClientVersion: clientVersion,
        isLegacyClient: clientVersion === 'v1_legacy',
      },
    };
  }

  formatResponseForClient(
    result: ChatRuntimeResult,
    clientVersion: ApiClientVersion = 'v1_legacy',
  ): LegacyChatResponsePayload {
    const baseResponse: LegacyChatResponsePayload = {
      response: result.response,
      sessionId: result.requestId,
      conversationId: result.requestId,
      model: result.model.model,
      apiVersion: clientVersion,
    };

    // Modern additions for v2+ clients
    if (clientVersion !== 'v1_legacy') {
      baseResponse.traceId = result.traceId;

      if (result.citations && result.citations.length > 0) {
        baseResponse.citations = result.citations.map((c) => ({
          source: c.sourceId,
          snippet: c.title,
        }));
      }

      if (result.grounding) {
        baseResponse.grounding = {
          confidence: result.grounding.confidence ?? 1.0,
          supported: result.grounding.sufficient,
        };
      }

      if (result.toolResults && result.toolResults.length > 0) {
        baseResponse.toolResults = result.toolResults.map((t) => ({
          toolName: t.toolName,
          status: t.status,
        }));
      }
    }

    return baseResponse;
  }

  evaluateDeprecationPolicy(status: {
    apiVersion: ApiClientVersion;
    sunsetDate: string;
    clientMigrated: boolean;
    apiConsumersIdentified: boolean;
    deprecationDocumented: boolean;
    releaseWindowElapsed: boolean;
  }): DeprecationPolicyCheck {
    const blockingReasons: string[] = [];

    if (!status.clientMigrated) {
      blockingReasons.push('Client has not completed migration to modern API');
    }
    if (!status.apiConsumersIdentified) {
      blockingReasons.push('Active API consumers have not been fully identified');
    }
    if (!status.deprecationDocumented) {
      blockingReasons.push('Deprecation notice and migration guide have not been documented');
    }
    if (!status.releaseWindowElapsed) {
      blockingReasons.push('The mandatory deprecation release window has not elapsed');
    }

    return {
      ...status,
      canDecommission: blockingReasons.length === 0,
      blockingReasons,
    };
  }
}
