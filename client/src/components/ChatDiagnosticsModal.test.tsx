import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatDiagnosticsModal } from './ChatDiagnosticsModal';
import type { ChatRunRecord } from '../../../src/types/chat-diagnostics';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ChatDiagnosticsModal Component', () => {
  const mockRun: ChatRunRecord = {
    requestId: 'req-modal-test-1',
    traceId: 'tr-modal-test-1',
    sessionId: 'sess-test-1',
    startedAt: new Date().toISOString(),
    status: 'failed',
    taskType: 'CODING_DEBUG',
    intent: 'fix_bug',
    botProfileVersion: 'profile-v1',
    contextPlanSummary: {},
    modelPolicyVersion: 'policy-v1',
    selectedModel: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      fallbackUsed: true,
    },
    selectedSourceIds: ['src-1', 'src-2'],
    toolCallIds: ['tool-1'],
    validationCodes: ['GROUNDING_INSUFFICIENT'],
    failureCode: 'GROUNDING_INSUFFICIENT',
    failureMessage: 'Required knowledge documentation was missing.',
    stageTimings: {
      retrievalMs: 40,
      generationMs: 320,
    },
    latencyMs: 360,
  };

  it('renders failure diagnostics, waterfall timing, and allows closing', () => {
    const onClose = vi.fn();
    render(<ChatDiagnosticsModal run={mockRun} onClose={onClose} />);

    expect(screen.getByText('Execution Diagnostics')).toBeDefined();
    expect(screen.getByText('req-modal-test-1')).toBeDefined();
    expect(screen.getAllByText('GROUNDING_INSUFFICIENT').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Required knowledge documentation was missing.')).toBeDefined();
    expect(screen.getByText('40 ms')).toBeDefined();

    const closeBtn = screen.getByRole('button', { name: /Close diagnostics/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
