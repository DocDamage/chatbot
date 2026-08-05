import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api/runtime', () => ({ isStaticPagesBuild: true }));
vi.mock('./components/AssistantChat', () => ({
  default: () => {
    throw new Error('Interactive chat must not render in the static demo');
  }
}));
vi.mock('./components/LocalToolsWorkspace', () => ({
  default: () => {
    throw new Error('Local tools must not render in the static demo');
  }
}));
vi.mock('./components/SettingsMenu', () => ({
  default: () => {
    throw new Error('Settings must not render in the static demo');
  }
}));

import App from './App';

afterEach(cleanup);

describe('App static demo boundary', () => {
  it('renders only the static demo surface', () => {
    render(<App />);

    expect(screen.getByRole('status')).toHaveTextContent('Static interface demo only');
    expect(screen.getByLabelText('Message')).toBeDisabled();
    expect(document.querySelector('[data-static-demo="true"]')).toBeInTheDocument();
  });
});
