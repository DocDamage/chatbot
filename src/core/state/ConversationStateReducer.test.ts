import { ConversationStateReducer } from './ConversationStateReducer';
import { ConversationState, ConversationVariable } from '../../types/conversation-state';

describe('ConversationStateReducer (CRK-P03-T04)', () => {
  const reducer = new ConversationStateReducer();

  const makeState = (variables: Record<string, ConversationVariable> = {}): ConversationState => ({
    sessionId: 'sess-1',
    variables,
    sessionMemory: { sessionId: 'sess-1', messages: [], maxHistoryTurns: 50 },
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
  });

  it('updates framework and version deterministically', () => {
    const initial = makeState();
    const candidates: Record<string, ConversationVariable> = {
      framework: {
        key: 'framework',
        value: 'Godot',
        confidence: 1.0,
        sourceTurnId: 't1',
        source: 'explicit',
        updatedAt: '2026-09-04T00:00:00.000Z',
      },
      frameworkVersion: {
        key: 'frameworkVersion',
        value: '4.7',
        confidence: 1.0,
        sourceTurnId: 't1',
        source: 'explicit',
        updatedAt: '2026-09-04T00:00:00.000Z',
      },
    };

    const next = reducer.reduce(initial, candidates);
    expect(next.variables.framework.value).toBe('Godot');
    expect(next.variables.frameworkVersion.value).toBe('4.7');
  });

  it('prevents low-confidence inference from overwriting high-confidence explicit fact', () => {
    const initial = makeState({
      framework: {
        key: 'framework',
        value: 'Godot',
        confidence: 1.0,
        sourceTurnId: 't1',
        source: 'explicit',
        updatedAt: '2026-09-04T00:00:00.000Z',
      },
    });

    const candidates: Record<string, ConversationVariable> = {
      framework: {
        key: 'framework',
        value: 'React',
        confidence: 0.6,
        sourceTurnId: 't2',
        source: 'inferred',
        updatedAt: '2026-09-04T00:01:00.000Z',
      },
    };

    const next = reducer.reduce(initial, candidates);
    expect(next.variables.framework.value).toBe('Godot');
    expect(next.variables.framework.confidence).toBe(1.0);
  });

  it('allows high-confidence explicit contradiction to update state', () => {
    const initial = makeState({
      repository: {
        key: 'repository',
        value: 'repo-A',
        confidence: 1.0,
        sourceTurnId: 't1',
        source: 'explicit',
        updatedAt: '2026-09-04T00:00:00.000Z',
      },
    });

    const candidates: Record<string, ConversationVariable> = {
      repository: {
        key: 'repository',
        value: 'repo-B',
        confidence: 1.0,
        sourceTurnId: 't2',
        source: 'explicit',
        updatedAt: '2026-09-04T00:01:00.000Z',
      },
    };

    const next = reducer.reduce(initial, candidates);
    expect(next.variables.repository.value).toBe('repo-B');
  });

  it('prunes expired variables', () => {
    const initial = makeState({
      requestedOutput: {
        key: 'requestedOutput',
        value: 'json',
        confidence: 0.9,
        sourceTurnId: 't1',
        source: 'explicit',
        updatedAt: '2026-09-04T00:00:00.000Z',
        expiresAt: '2026-09-04T00:00:30.000Z',
      },
    });

    const next = reducer.reduce(initial, {}, { now: '2026-09-04T00:01:00.000Z' });
    expect(next.variables.requestedOutput).toBeUndefined();
  });
});
