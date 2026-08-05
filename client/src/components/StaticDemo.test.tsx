import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import StaticDemo from './StaticDemo';

afterEach(cleanup);

describe('StaticDemo', () => {
  it('shows persistent limitations and disables backend actions', () => {
    render(<StaticDemo />);

    expect(screen.getByRole('status')).toHaveTextContent('Static interface demo only');
    expect(screen.getByRole('status')).toHaveTextContent('does not send prompts or run actions');
    expect(screen.getByLabelText('Message')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send unavailable' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Unavailable in this demo' })).toBeInTheDocument();
  });
});
