import { AgentOperationsConsoleService } from '../console/AgentOperationsConsoleService';

describe('B75-08: AgentOperationsConsoleService Deep Matrix and Budget Enforcement Suite', () => {
  let consoleService: AgentOperationsConsoleService;

  beforeEach(() => {
    consoleService = new AgentOperationsConsoleService();
  });

  it('manages full lifecycle of agent sessions: start, transition, usage, pause, resume, and complete', () => {
    // 1. Start session
    const session = consoleService.startSession({
      agentId: 'agent_coder_1',
      ownerId: 'user_1',
      role: 'implementer',
      projectId: 'proj_alpha',
      budget: {
        maxTokens: 1000,
        maxCommands: 10,
        maxTimeMs: 60000,
        maxCostUsd: 1.0
      }
    });

    expect(session.sessionId).toBeDefined();
    expect(session.state).toBe('active');

    // 2. Transition stage
    consoleService.transitionStage(session.sessionId, 'implementation', 'command_execution');
    const updated1 = consoleService.getSession(session.sessionId);
    expect(updated1?.currentStage).toBe('implementation');
    expect(updated1?.currentToolCategory).toBe('command_execution');

    // 3. Record usage within budget
    consoleService.recordUsage(session.sessionId, {
      tokens: 200,
      timeMs: 1000,
      commands: 2,
      costUsd: 0.1,
      diskBytes: 1024
    });
    const updated2 = consoleService.getSession(session.sessionId);
    expect(updated2?.resourceUsage.tokensUsed).toBe(200);

    // 4. Pause and Resume
    consoleService.pauseSession(session.sessionId, 'Waiting for user confirmation');
    const paused = consoleService.getSession(session.sessionId);
    expect(paused?.state).toBe('paused');

    consoleService.resumeSession(session.sessionId);
    const resumed = consoleService.getSession(session.sessionId);
    expect(resumed?.state).toBe('active');

    // 5. Complete session
    consoleService.completeSession(session.sessionId, ['patch.diff']);
    const completed = consoleService.getSession(session.sessionId);
    expect(completed?.state).toBe('completed');

    // 6. Summary and events
    const summary = consoleService.getConsoleSummary('proj_alpha');
    expect(summary.sessions.length).toBe(1);

    const events = consoleService.getSessionEvents(session.sessionId);
    expect(events.length).toBeGreaterThan(0);
  });

  it('enforces token, command, and time budget limits with auto-cancellation', () => {
    // Token budget exceed
    const s1 = consoleService.startSession({
      agentId: 'agent_1',
      ownerId: 'user_1',
      role: 'implementer',
      projectId: 'proj_beta',
      budget: { maxTokens: 100 }
    });
    expect(() => consoleService.recordUsage(s1.sessionId, { tokens: 150 })).toThrow('token budget exceeded');
    expect(consoleService.getSession(s1.sessionId)?.state).toBe('cancelled');

    // Command budget exceed
    const s2 = consoleService.startSession({
      agentId: 'agent_2',
      ownerId: 'user_1',
      role: 'implementer',
      projectId: 'proj_beta',
      budget: { maxCommands: 2 }
    });
    expect(() => consoleService.recordUsage(s2.sessionId, { commands: 5 })).toThrow('command budget exceeded');
    expect(consoleService.getSession(s2.sessionId)?.state).toBe('cancelled');

    // Time budget exceed
    const s3 = consoleService.startSession({
      agentId: 'agent_3',
      ownerId: 'user_1',
      role: 'implementer',
      projectId: 'proj_beta',
      budget: { maxTimeMs: 500 }
    });
    expect(() => consoleService.recordUsage(s3.sessionId, { timeMs: 1000 })).toThrow('time budget exceeded');
    expect(consoleService.getSession(s3.sessionId)?.state).toBe('cancelled');
  });

  it('handles emergency stop-all across all active project sessions', () => {
    const s1 = consoleService.startSession({ agentId: 'a1', ownerId: 'u1', role: 'test_author', projectId: 'p1' });
    const s2 = consoleService.startSession({ agentId: 'a2', ownerId: 'u1', role: 'test_author', projectId: 'p1' });

    expect(consoleService.getConsoleSummary('p1').activeSessionCount).toBe(2);

    consoleService.stopAll('p1', 'Emergency stop trigger');

    expect(consoleService.getSession(s1.sessionId)?.state).toBe('cancelled');
    expect(consoleService.getSession(s2.sessionId)?.state).toBe('cancelled');
    expect(consoleService.getConsoleSummary('p1').activeSessionCount).toBe(0);
  });
});
