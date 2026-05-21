import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ModeSelector from './ModeSelector';

afterEach(() => {
  cleanup();
});

describe('ModeSelector', () => {
  it('opens the mode list and selects a new mode', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();

    render(<ModeSelector mode="ask" onModeChange={onModeChange} />);

    const trigger = screen.getByRole('button', { name: /ask/i });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('listbox', { name: /chat mode/i })).toBeTruthy();

    await user.click(screen.getByRole('option', { name: /debug/i }));

    expect(onModeChange).toHaveBeenCalledWith('debug');
  });

  it('supports arrow-key navigation in the open listbox', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();

    render(<ModeSelector mode="ask" onModeChange={onModeChange} />);

    await user.click(screen.getByRole('button', { name: /ask/i }));
    await user.keyboard('{ArrowDown}');
    const planOption = () => screen.getAllByRole('option')
      .find(option => option.querySelector('.mode-option-label')?.textContent === 'Plan');
    await waitFor(() => {
      expect(document.activeElement).toBe(planOption());
    });
    await user.keyboard('{Enter}');

    expect(onModeChange).toHaveBeenCalledWith('plan');
  });

  it('supports keyboard mode shortcuts', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();

    render(<ModeSelector mode="ask" onModeChange={onModeChange} />);

    await user.keyboard('{Control>}3{/Control}');

    expect(onModeChange).toHaveBeenCalledWith('implement');
  });

  it('exposes backend specialist modes in the visible selector', async () => {
    const user = userEvent.setup();

    render(<ModeSelector mode="ask" onModeChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /ask/i }));
    const optionLabels = () => screen.getAllByRole('option')
      .map(option => option.querySelector('.mode-option-label')?.textContent);

    expect(optionLabels()).toEqual(expect.arrayContaining([
      'Math',
      'Market',
      'Game Dev',
      'Legal/Civic',
      'Engineering',
    ]));
  });
});
