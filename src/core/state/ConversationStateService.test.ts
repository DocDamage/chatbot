import { ConversationStateService } from './ConversationStateService';
import { ConversationStateRepository } from './ConversationStateRepository';
import { NormalizedChatRequest, ChatRuntimeResult, ChatTraceContext } from '../../types/chat-runtime';

describe('ConversationStateService (CRK-P03-T05)', () => {
  let repository: ConversationStateRepository;
  let service: ConversationStateService;

  beforeEach(() => {
    repository = new ConversationStateRepository();
    service = new ConversationStateService({ repository });
  });

  const makeReq = (msg: string, sessionId = 'sess-1'): NormalizedChatRequest => ({
    requestId: `req-${Date.now()}`,
    sessionId,
    message: msg,
    botProfileId: 'default',
    loadedFiles: [],
    loadedAudio: [],
    clientCapabilities: { streaming: false, citations: false, toolApproval: false },
    metadata: {},
  });

  it('loads fresh state and extracts variables from first turn', async () => {
    const req = makeReq('I am working on Godot 4.7');
    const state = await service.load(req);

    expect(state.sessionId).toBe('sess-1');
    expect(state.variables.framework).toBe('Godot');
    expect(state.variables.frameworkVersion).toBe('4.7');
    expect(state.messageHistory.length).toBe(1);
  });

  it('commits response and preserves variables into subsequent turn', async () => {
    const req1 = makeReq('I am working on Godot 4.7');
    const state1 = await service.load(req1);

    const dummyResult: ChatRuntimeResult = {
      requestId: req1.requestId,
      response: 'Great! Godot 4.7 is a powerful engine.',
      model: { provider: 'mock', model: 'mock-1', policy: 'mock', fallbackUsed: false },
      citations: [],
      toolResults: [],
      warnings: [],
      latencyMs: 120,
      traceId: 'trc-1',
      grounding: { attempted: false, sufficient: true },
    };

    const dummyTrace: ChatTraceContext = {
      traceId: 'trc-1',
      requestId: req1.requestId,
      sessionId: req1.sessionId,
      stageTimings: {},
      createdAt: new Date().toISOString(),
    };

    await service.commit({
      request: req1,
      state: state1,
      result: dummyResult,
      trace: dummyTrace,
    });

    // Turn 2: Follow-up question without restating engine
    const req2 = makeReq('How do I create a custom signal?');
    const state2 = await service.load(req2);

    expect(state2.variables.framework).toBe('Godot');
    expect(state2.variables.frameworkVersion).toBe('4.7');
    expect(state2.messageHistory.length).toBe(3); // user turn 1, assistant reply 1, user turn 2
  });

  it('deletes session state cleanly with zero memory leakage', async () => {
    const req = makeReq('I use React 19', 'sess-temp');
    await service.load(req);

    const initialStored = await repository.getState('sess-temp');
    expect(initialStored).toBeDefined();

    const deleted = await service.deleteSession('sess-temp');
    expect(deleted).toBe(true);

    const afterDelete = await repository.getState('sess-temp');
    expect(afterDelete).toBeNull();
  });
});
