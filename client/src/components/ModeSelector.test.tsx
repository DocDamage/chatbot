import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  it('supports keyboard interaction on button and arrow-key navigation in listbox', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();

    render(<ModeSelector mode="ask" onModeChange={onModeChange} />);

    const trigger = screen.getByRole('button', { name: /ask/i });

    // Open via Space on button
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(screen.getByRole('listbox', { name: /chat mode/i })).toBeTruthy();

    // Arrow navigation
    await user.keyboard('{ArrowDown}');
    const planOption = () => screen.getAllByRole('option')
      .find(option => option.querySelector('.mode-option-label')?.textContent === 'Plan');
    await waitFor(() => {
      expect(document.activeElement).toBe(planOption());
    });

    // ArrowUp back to Ask
    await user.keyboard('{ArrowUp}');
    const askOption = () => screen.getAllByRole('option')
      .find(option => option.querySelector('.mode-option-label')?.textContent === 'Ask');
    await waitFor(() => {
      expect(document.activeElement).toBe(askOption());
    });

    // Select with Space
    await user.keyboard(' ');
    expect(onModeChange).toHaveBeenCalledWith('ask');
  });

  it('opens on button ArrowDown and closes on Escape and outside click', async () => {
    const onModeChange = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside area</div>
        <ModeSelector mode="ask" onModeChange={onModeChange} />
      </div>
    );

    const trigger = screen.getByRole('button', { name: /ask/i });

    // ArrowDown when closed opens dropdown
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox', { name: /chat mode/i })).toBeTruthy();

    // Escape closes dropdown
    const askOption = screen.getAllByRole('option')[0];
    fireEvent.keyDown(askOption, { key: 'Escape' });
    expect(screen.queryByRole('listbox', { name: /chat mode/i })).toBeNull();

    // Open via Enter on trigger
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByRole('listbox', { name: /chat mode/i })).toBeTruthy();

    // Outside click closes dropdown
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('listbox', { name: /chat mode/i })).toBeNull();
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
      'Creative Writing',
      'Roleplay',
      'Legal/Civic',
      'GIS',
      'Engineering',
    ]));
  });
});
