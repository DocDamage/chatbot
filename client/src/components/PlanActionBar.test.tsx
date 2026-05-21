import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlanActionBar from './PlanActionBar';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PlanActionBar', () => {
  it('offers switch, open, and copy actions for saved plans', async () => {
    const user = userEvent.setup();
    const onSwitchToImplement = vi.fn();
    const onOpenPlan = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <PlanActionBar
        planId="plan-1"
        planPath="plans/2026-05-21/plan-1.md"
        onSwitchToImplement={onSwitchToImplement}
        onOpenPlan={onOpenPlan}
      />
    );

    await user.click(screen.getByRole('button', { name: /switch to implement/i }));
    await user.click(screen.getByRole('button', { name: /open plan/i }));
    await user.click(screen.getByRole('button', { name: /copy plan path/i }));

    expect(onSwitchToImplement).toHaveBeenCalledTimes(1);
    expect(onOpenPlan).toHaveBeenCalledWith('plan-1');
    expect(writeText).toHaveBeenCalledWith('plans/2026-05-21/plan-1.md');
  });
});
