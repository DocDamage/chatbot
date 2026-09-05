import { APICompatibilityBridge } from '../APICompatibilityBridge';
import { ChatRuntimeResult } from '../../../types/chat-runtime';

describe('APICompatibilityBridge (Section 42)', () => {
  let bridge: APICompatibilityBridge;

  beforeEach(() => {
    bridge = new APICompatibilityBridge();
  });

  it('negotiates client versions with warnings for legacy v1', () => {
    const legacyNegotiation = bridge.negotiateClientVersion('v1');
    expect(legacyNegotiation.version).toBe('v1_legacy');
    expect(legacyNegotiation.isLegacy).toBe(true);
    expect(legacyNegotiation.warnings?.length).toBeGreaterThan(0);

    const modernNegotiation = bridge.negotiateClientVersion('v2_canonical');
    expect(modernNegotiation.version).toBe('v2_canonical');
    expect(modernNegotiation.isLegacy).toBe(false);
  });

  it('normalizes legacy request payloads into NormalizedChatRequest', () => {
    const legacyPayload = {
      prompt: 'Summarize the documentation',
      userId: 'legacy-user-42',
      sessionId: 'legacy-sess-99',
      options: {
        model: 'gemini-1.5-pro',
      },
    };

    const normalized = bridge.normalizeLegacyRequest(legacyPayload, 'v1_legacy');
    expect(normalized.message).toBe('Summarize the documentation');
    expect(normalized.userId).toBe('legacy-user-42');
    expect(normalized.sessionId).toBe('legacy-sess-99');
    expect((normalized.metadata as { isLegacyClient: boolean }).isLegacyClient).toBe(true);
    expect(normalized.requestedModelPolicy).toBe('gemini-1.5-pro');
  });

  it('formats response: strips versioned additions for legacy clients', () => {
    const runtimeResult: ChatRuntimeResult = {
      requestId: 'req-1',
      traceId: 'trace-123',
      response: 'Canonical response text',
      latencyMs: 120,
      model: {
        provider: 'google',
        model: 'gemini-1.5-pro',
        policy: 'general',
        fallbackUsed: false,
      },
      citations: [{ id: 'c1', sourceId: 'doc-1', title: 'Docs', chunkId: 'chk1' }],
      grounding: { attempted: true, sufficient: true, confidence: 0.95 },
      toolResults: [{ toolCallId: 'call-1', toolName: 'search', status: 'success' }],
      warnings: [],
    };

    const legacyResponse = bridge.formatResponseForClient(runtimeResult, 'v1_legacy');
    expect(legacyResponse.response).toBe('Canonical response text');
    expect(legacyResponse.citations).toBeUndefined();
    expect(legacyResponse.traceId).toBeUndefined();

    const modernResponse = bridge.formatResponseForClient(runtimeResult, 'v2_canonical');
    expect(modernResponse.response).toBe('Canonical response text');
    expect(modernResponse.citations?.length).toBe(1);
    expect(modernResponse.traceId).toBe('trace-123');
    expect(modernResponse.grounding?.confidence).toBe(0.95);
  });

  it('enforces 4 deprecation conditions before allowing decommissioning', () => {
    const blockedStatus = {
      apiVersion: 'v1_legacy' as const,
      sunsetDate: '2026-12-31',
      clientMigrated: false,
      apiConsumersIdentified: true,
      deprecationDocumented: true,
      releaseWindowElapsed: false,
    };

    const checkBlocked = bridge.evaluateDeprecationPolicy(blockedStatus);
    expect(checkBlocked.canDecommission).toBe(false);
    expect(checkBlocked.blockingReasons.length).toBe(2);

    const readyStatus = {
      ...blockedStatus,
      clientMigrated: true,
      releaseWindowElapsed: true,
    };
    const checkReady = bridge.evaluateDeprecationPolicy(readyStatus);
    expect(checkReady.canDecommission).toBe(true);
    expect(checkReady.blockingReasons.length).toBe(0);
  });
});
