import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhyThisAnswerModal } from './WhyThisAnswerModal';
import type { WhyThisAnswerDiagnostics } from '../../../src/types/citation';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('WhyThisAnswerModal Component', () => {
  const mockDiagnostics: WhyThisAnswerDiagnostics = {
    requestId: 'req-why-01',
    traceId: 'trc-why-01',
    selectedIntent: 'framework_api_query',
    taskType: 'coding_question',
    contextTypes: ['knowledge_rag', 'conversation_history'],
    packIds: ['pack-godot', 'pack-stack-exchange'],
    retrievalCandidateCount: 12,
    selectedSourceCount: 3,
    modelRoute: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      policy: 'coding_high_reasoning',
      fallbackUsed: false,
    },
    toolStatus: [
      { toolName: 'file_read', status: 'success', summary: 'read 1 file' },
    ],
    promptPolicyVersion: 'prompt-envelope-v2.1',
    retrievalPolicyVersion: 'retrieval-policy-v1.4',
    botProfileVersion: 'default-profile-v1.0',
    warnings: ['Source score below ideal threshold'],
  };

  it('renders modal with diagnostics breakdown without private reasoning (§2758)', () => {
    const onClose = vi.fn();
    render(<WhyThisAnswerModal diagnostics={mockDiagnostics} onClose={onClose} />);

    expect(screen.getByText('Response Diagnostics')).toBeDefined();
    expect(screen.getByText('framework_api_query')).toBeDefined();
    expect(screen.getByText('pack-godot, pack-stack-exchange')).toBeDefined();
    expect(screen.getByText('claude-3-5-sonnet')).toBeDefined();
    expect(screen.getByText('Source score below ideal threshold')).toBeDefined();

    // Verify close buttons
    const closeBtn = screen.getByRole('button', { name: /Close diagnostics/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
