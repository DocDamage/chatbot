import { ConversationContextSelector } from './ConversationContextSelector';
import { ConversationVariable } from '../../types/conversation-state';

describe('ConversationContextSelector (CRK-P03-T06)', () => {
  const selector = new ConversationContextSelector();

  const mockVariables: Record<string, ConversationVariable> = {
    operatingSystem: {
      key: 'operatingSystem',
      value: 'Windows 11',
      confidence: 1.0,
      sourceTurnId: 't1',
      source: 'explicit',
      updatedAt: '2026-09-04T00:00:00.000Z',
    },
    repository: {
      key: 'repository',
      value: 'DocDamage/chatbot',
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
    userGoal: {
      key: 'userGoal',
      value: 'Write an inspiring piece',
      confidence: 0.95,
      sourceTurnId: 't1',
      source: 'explicit',
      updatedAt: '2026-09-04T00:00:00.000Z',
    },
    requestedOutput: {
      key: 'requestedOutput',
      value: 'markdown',
      confidence: 0.9,
      sourceTurnId: 't1',
      source: 'explicit',
      updatedAt: '2026-09-04T00:00:00.000Z',
    },
  };

  it('omits operatingSystem, repository, and frameworkVersion for poem/creative tasks (§1072)', () => {
    const selected = selector.selectRelevant('creative_poem', mockVariables);
    expect(selected.userGoal).toBe('Write an inspiring piece');
    expect(selected.requestedOutput).toBe('markdown');
    expect(selected.operatingSystem).toBeUndefined();
    expect(selected.repository).toBeUndefined();
    expect(selected.frameworkVersion).toBeUndefined();
  });

  it('includes operatingSystem, repository, and frameworkVersion for coding/debug tasks (§1078)', () => {
    const selected = selector.selectRelevant('coding_assistance', mockVariables);
    expect(selected.operatingSystem).toBe('Windows 11');
    expect(selected.repository).toBe('DocDamage/chatbot');
    expect(selected.frameworkVersion).toBe('4.7');
    expect(selected.requestedOutput).toBe('markdown');
  });

  it('allows explicit key selection', () => {
    const selected = selector.selectByKeys(['repository', 'userGoal'], mockVariables);
    expect(selected).toEqual({
      repository: 'DocDamage/chatbot',
      userGoal: 'Write an inspiring piece',
    });
  });
});
