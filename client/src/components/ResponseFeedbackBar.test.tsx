import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponseFeedbackBar } from './ResponseFeedbackBar';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ResponseFeedbackBar Component (CRK-P16-T04)', () => {
  it('renders thumbs up and thumbs down buttons', () => {
    render(<ResponseFeedbackBar responseId="resp-001" />);
    expect(screen.getByRole('button', { name: /^Helpful response$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Unhelpful response$/i })).toBeDefined();
  });

  it('triggers onFeedbackSubmit on thumbs up without follow-up', () => {
    const onFeedbackSubmit = vi.fn();
    render(<ResponseFeedbackBar responseId="resp-001" onFeedbackSubmit={onFeedbackSubmit} />);

    const upBtn = screen.getByRole('button', { name: /^Helpful response$/i });
    fireEvent.click(upBtn);

    expect(onFeedbackSubmit).toHaveBeenCalledWith({ responseId: 'resp-001', thumbs: 'up' });
    expect(screen.getByText('Thanks for your feedback!')).toBeDefined();
    // Follow-up should not be shown for thumbs up
    expect(screen.queryByText(/What went wrong/i)).toBeNull();
  });

  it('opens optional category follow-up on thumbs down and allows skip (§2870)', () => {
    const onFeedbackSubmit = vi.fn();
    render(<ResponseFeedbackBar responseId="resp-002" onFeedbackSubmit={onFeedbackSubmit} />);

    const downBtn = screen.getByRole('button', { name: /^Unhelpful response$/i });
    fireEvent.click(downBtn);

    expect(onFeedbackSubmit).toHaveBeenCalledWith({ responseId: 'resp-002', thumbs: 'down' });
    expect(screen.getByText(/What went wrong/i)).toBeDefined();

    // Verify skip button works
    const skipBtn = screen.getByRole('button', { name: /Skip follow-up/i });
    fireEvent.click(skipBtn);
    expect(screen.queryByText(/What went wrong/i)).toBeNull();
  });

  it('submits detailed negative feedback with categories and comment', () => {
    const onFeedbackSubmit = vi.fn();
    render(<ResponseFeedbackBar responseId="resp-003" onFeedbackSubmit={onFeedbackSubmit} />);

    const downBtn = screen.getByRole('button', { name: /^Unhelpful response$/i });
    fireEvent.click(downBtn);

    const outdatedChip = screen.getByRole('button', { name: 'Outdated' });
    fireEvent.click(outdatedChip);

    const submitDetailsBtn = screen.getByRole('button', { name: 'Submit Details' });
    fireEvent.click(submitDetailsBtn);

    expect(onFeedbackSubmit).toHaveBeenLastCalledWith({
      responseId: 'resp-003',
      thumbs: 'down',
      categories: ['outdated'],
      comment: undefined,
    });
  });
});
