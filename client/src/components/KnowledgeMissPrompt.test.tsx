import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import KnowledgeMissPrompt from './KnowledgeMissPrompt';

afterEach(() => {
  cleanup();
});

describe('KnowledgeMissPrompt', () => {
  it('shows recommended sources and emits search or cancel actions', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    const onCancel = vi.fn();

    render(
      <KnowledgeMissPrompt
        query="Godot 4.5 release notes"
        domain="gaming"
        recommendedSources={['official game or engine documentation']}
        onSearch={onSearch}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText(/local knowledge database/i)).toBeTruthy();
    expect(screen.getByText(/Godot 4.5 release notes/)).toBeTruthy();
    expect(screen.getByText(/official game or engine documentation/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /search online/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
