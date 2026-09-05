/**
 * Unit Tests for ChatRuntimeCompatibilityAdapter (CRK-P01-T05)
 *
 * Verifies bidirectional translation between legacy chat route DTOs and
 * canonical ChatRuntime contracts without breaking API behavior.
 */

import { ChatRuntimeCompatibilityAdapter } from './ChatRuntimeCompatibilityAdapter';
import { ChatRuntimeFactory } from './ChatRuntimeFactory';
import { ChatRequestDto } from '../../types/chat';
import { ChatRuntimeResult } from '../../types/chat-runtime';

describe('ChatRuntimeCompatibilityAdapter (CRK-P01-T05)', () => {
  const legacyRequest: ChatRequestDto = {
    message: 'What is the speed of light in vacuum?',
    sessionId: 'sess-compat-123',
    userId: 'user-client-claimed',
    systemPrompt: 'Be concise.',
    mode: 'ask',
  };

  const runtimeResult: ChatRuntimeResult = {
    requestId: 'req-result-001',
    response: 'The speed of light in vacuum is exactly 299,792,458 m/s.',
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      policy: 'balanced',
      fallbackUsed: false,
    },
    citations: [
      {
        id: 'cit-1',
        sourceId: 'src-1',
        title: 'Physics Constants',
        sourceUrl: 'https://example.org/physics',
        chunkId: 'chk-1',
        authority: 0.99,
      },
    ],
    toolResults: [],
    warnings: ['Warning sample'],
    latencyMs: 85,
    traceId: 'trc-result-001',
    grounding: {
      attempted: true,
      sufficient: true,
      confidence: 0.99,
    },
  };

  it('translates legacy ChatRequestDto to NormalizedChatRequest with auth preservation', () => {
    const normalized = ChatRuntimeCompatibilityAdapter.toNormalizedRequest(legacyRequest, {
      userId: 'user-server-authoritative',
    });

    expect(normalized.message).toBe(legacyRequest.message);
    expect(normalized.sessionId).toBe(legacyRequest.sessionId);
    expect(normalized.userId).toBe('user-server-authoritative');
    expect(normalized.explicitSystemInstruction).toBe('Be concise.');
    expect(normalized.requestId).toMatch(/^req_/);
  });

  it('translates ChatRuntimeResult to legacy ChatResponse contract', () => {
    const legacyResponse = ChatRuntimeCompatibilityAdapter.toLegacyResponse(runtimeResult, '2.1.0');

    expect(legacyResponse.response).toBe(runtimeResult.response);
    expect(legacyResponse.artifactId).toBe(runtimeResult.traceId);
    expect(legacyResponse.contractVersion).toBe('2.1.0');
    expect(legacyResponse.latency).toBe(85);
    expect(legacyResponse.model).toBe('gpt-4o');
    expect(legacyResponse.warnings).toEqual(['Warning sample']);
    expect(legacyResponse.knowledgeMiss).toBeUndefined();
  });

  it('flags knowledgeMiss in legacy response when grounding was attempted but insufficient', () => {
    const insufficientResult: ChatRuntimeResult = {
      ...runtimeResult,
      grounding: { attempted: true, sufficient: false },
    };

    const legacyResponse = ChatRuntimeCompatibilityAdapter.toLegacyResponse(insufficientResult);
    expect(legacyResponse.knowledgeMiss).toBe(true);
    expect(legacyResponse.canSearchOnline).toBe(true);
  });

  it('translates ChatRuntimeResult to V2ChatResponse contract', () => {
    const v2 = ChatRuntimeCompatibilityAdapter.toV2Response(runtimeResult, 'sess-compat-123');

    expect(v2.id).toBe(runtimeResult.requestId);
    expect(v2.response).toBe(runtimeResult.response);
    expect(v2.sessionId).toBe('sess-compat-123');
    expect(v2.model.model).toBe('gpt-4o');
    expect(v2.citations[0].title).toBe('Physics Constants');
    expect(v2.latencyMs).toBe(85);
  });

  it('creates an operational orchestrator bridge that executes legacy requests on ChatRuntime', async () => {
    const runtime = ChatRuntimeFactory.create();
    const bridge = ChatRuntimeCompatibilityAdapter.createOrchestratorBridge(runtime);

    const legacyResponse = await bridge.processRequest(legacyRequest);
    expect(legacyResponse.response).toBeDefined();
    expect(legacyResponse.artifactId).toMatch(/^trc_req_/);
    expect(legacyResponse.latency).toBeGreaterThanOrEqual(0);

    const v2Response = await bridge.processRequestV2(legacyRequest);
    expect(v2Response.id).toBeDefined();
    expect(v2Response.sessionId).toBe(legacyRequest.sessionId);
    expect(v2Response.response).toBeDefined();
  });
});
