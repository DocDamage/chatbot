/**
 * Conversation Follow-up Regression Suite & Exit Gate (CRK-P03-T07)
 *
 * Verifies all 6 mandatory follow-up scenarios specified in Plan §1080-1097:
 * 1. "I use Godot 4.7" -> later "how do I make a signal?" retains version.
 * 2. "repo A" -> later switch to "repo B" updates correctly.
 * 3. Temporary output-format preference does not become permanent.
 * 4. Contradiction explicitly updates variable.
 * 5. Ambiguous contradiction requests clarification only when required.
 * 6. Deleted session does not leak state.
 */

import { ConversationStateService } from '../ConversationStateService';
import { ConversationStateRepository } from '../ConversationStateRepository';
import { ConversationContextSelector } from '../ConversationContextSelector';
import { NormalizedChatRequest, ChatRuntimeResult, ChatTraceContext } from '../../../types/chat-runtime';
import { ConversationVariable } from '../../../types/conversation-state';

describe('CRK Phase 03 Exit Gate: Conversation Follow-up Regression Suite', () => {
  let repository: ConversationStateRepository;
  let service: ConversationStateService;
  let selector: ConversationContextSelector;

  beforeEach(() => {
    repository = new ConversationStateRepository();
    service = new ConversationStateService({ repository });
    selector = new ConversationContextSelector();
  });

  const makeReq = (msg: string, sessionId = 'sess-regression'): NormalizedChatRequest => ({
    requestId: `req-${Date.now()}-${Math.random()}`,
    sessionId,
    message: msg,
    botProfileId: 'default',
    loadedFiles: [],
    loadedAudio: [],
    clientCapabilities: { streaming: false, citations: false, toolApproval: false },
    metadata: {},
  });

  const fakeCommit = async (req: NormalizedChatRequest, state: any, responseText = 'OK') => {
    const result: ChatRuntimeResult = {
      requestId: req.requestId,
      response: responseText,
      model: { provider: 'mock', model: 'mock-1', policy: 'mock', fallbackUsed: false },
      citations: [],
      toolResults: [],
      warnings: [],
      latencyMs: 50,
      traceId: `trc-${req.requestId}`,
      grounding: { attempted: false, sufficient: true },
    };
    const trace: ChatTraceContext = {
      traceId: `trc-${req.requestId}`,
      requestId: req.requestId,
      sessionId: req.sessionId,
      stageTimings: {},
      createdAt: new Date().toISOString(),
    };
    await service.commit({ request: req, state, result, trace });
  };

  // 1. "I use Godot 4.7" -> later "how do I make a signal?" retains version (§1084)
  it('Scenario 1: Retains framework and version across conversational turns', async () => {
    const req1 = makeReq('I use Godot 4.7');
    const state1 = await service.load(req1);
    expect(state1.variables.framework).toBe('Godot');
    expect(state1.variables.frameworkVersion).toBe('4.7');
    await fakeCommit(req1, state1, 'Understood, Godot 4.7 configured.');

    // Follow up turn without repeating framework
    const req2 = makeReq('how do I make a signal?');
    const state2 = await service.load(req2);
    expect(state2.variables.framework).toBe('Godot');
    expect(state2.variables.frameworkVersion).toBe('4.7');

    // Context selector includes version for coding task
    const structVars = state2.metadata?.structuredVariables as Record<string, ConversationVariable>;
    const context = selector.selectRelevant('coding', structVars);
    expect(context.framework).toBe('Godot');
    expect(context.frameworkVersion).toBe('4.7');
  });

  // 2. "repo A" -> later switch to "repo B" updates correctly (§1085)
  it('Scenario 2: Correctly updates repository when switching', async () => {
    const req1 = makeReq('switch to repo frontend-app');
    const state1 = await service.load(req1);
    expect(state1.variables.repository).toBe('frontend-app');
    await fakeCommit(req1, state1);

    const req2 = makeReq('switch to repo backend-service');
    const state2 = await service.load(req2);
    expect(state2.variables.repository).toBe('backend-service');
    await fakeCommit(req2, state2);

    const checkState = await service.load(makeReq('what is the active repo?'));
    expect(checkState.variables.repository).toBe('backend-service');
  });

  // 3. Temporary output-format preference does not become permanent (§1086)
  it('Scenario 3: Temporary output format preference with expiry does not persist permanently', async () => {
    const req1 = makeReq('show status in json');
    const state1 = await service.load(req1);
    expect(state1.variables.requestedOutput).toBe('json');

    // Attach an expiration of 1 millisecond to test expiration semantics
    const structVars = state1.metadata?.structuredVariables as Record<string, ConversationVariable>;
    if (structVars.requestedOutput) {
      structVars.requestedOutput.expiresAt = new Date(Date.now() - 1000).toISOString();
    }
    await fakeCommit(req1, state1);

    // Later turn should have expired requestedOutput pruned
    const req2 = makeReq('explain the architecture');
    const state2 = await service.load(req2);
    expect(state2.variables.requestedOutput).toBeUndefined();
  });

  // 4. Contradiction explicitly updates variable (§1087)
  it('Scenario 4: High-confidence contradiction explicitly replaces variable', async () => {
    const req1 = makeReq('programming in Python');
    const state1 = await service.load(req1);
    expect(state1.variables.programmingLanguage).toBe('Python');
    await fakeCommit(req1, state1);

    // Contradiction: explicit switch to Rust
    const req2 = makeReq('programming in Rust');
    const state2 = await service.load(req2);
    expect(state2.variables.programmingLanguage).toBe('Rust');
    await fakeCommit(req2, state2);

    const finalState = await service.load(makeReq('generate a hello world'));
    expect(finalState.variables.programmingLanguage).toBe('Rust');
  });

  // 5. Ambiguous contradiction requests clarification only when required (§1088)
  it('Scenario 5: Flags ambiguity without overwriting when ambiguous switch is detected', async () => {
    const req1 = makeReq('switch to repo alpha');
    const state1 = await service.load(req1);
    expect(state1.variables.repository).toBe('alpha');
    await fakeCommit(req1, state1);

    // Ambiguous command: "switch to the other repo" without specifying which one
    const req2 = makeReq('switch to the other repo');
    const state2 = await service.load(req2);
    expect(state2.metadata?.ambiguities).toContain(
      'Ambiguous repository switch: target repository name unspecified'
    );
    // Repository variable is NOT overwritten with garbage or undefined
    expect(state2.variables.repository).toBe('alpha');
  });

  // 6. Deleted session does not leak state (§1089)
  it('Scenario 6: Cleanly purges all session variables on session delete', async () => {
    const sessionId = 'isolated-sess-xyz';
    const req1 = makeReq('I use Godot 4.7', sessionId);
    const state1 = await service.load(req1);
    await fakeCommit(req1, state1);

    const savedState = await repository.getState(sessionId);
    expect(savedState).not.toBeNull();
    expect(savedState?.variables.framework?.value).toBe('Godot');

    // Perform deletion
    const deleted = await service.deleteSession(sessionId);
    expect(deleted).toBe(true);

    // Confirm state is completely gone
    const postDelete = await repository.getState(sessionId);
    expect(postDelete).toBeNull();
  });
});
