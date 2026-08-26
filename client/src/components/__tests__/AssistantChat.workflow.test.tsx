import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantChat from '../AssistantChat';

vi.mock('@assistant-ui/react', () => ({
  AssistantRuntimeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useExternalStoreRuntime: (options: any) => ({
    onNew: options?.onNew,
    isRunning: false
  }),
  ThreadPrimitive: {
    Root: ({ children, className }: any) => <div className={className}>{children}</div>,
    Viewport: ({ children, className }: any) => <div className={className}>{children}</div>,
    Empty: ({ children }: any) => <div data-testid="thread-empty">{children}</div>,
    Messages: () => <div data-testid="messages" />
  },
  ComposerPrimitive: {
    Root: ({ children, className }: any) => <div className={className}>{children}</div>,
    Input: (props: any) => <textarea aria-label="composer" placeholder={props.placeholder} />,
    Cancel: ({ children, className }: any) => <button className={className}>{children}</button>,
    Send: ({ children, className }: any) => <button className={className}>{children}</button>
  },
  MessagePrimitive: {
    Root: ({ children, className }: any) => <div className={className}>{children}</div>,
    Parts: () => <p />
  },
  MessagePartPrimitive: {
    Text: (props: any) => <p className={props.className} />
  },
  ActionBarPrimitive: {
    Root: ({ children, className }: any) => <div className={className}>{children}</div>,
    Copy: ({ children, className }: any) => <button className={className}>{children}</button>,
    Reload: ({ children, className }: any) => <button className={className}>{children}</button>
  }
}));

vi.mock('../../api/runtime', () => ({ isStaticPagesBuild: false }));

describe('RT-CHAT-004: AssistantChat Comprehensive Workflow Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/conversations')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ conversations: [], total: 0 })
        });
      }
      if (url.includes('/api/health')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'healthy', database: 'connected' })
        });
      }
      if (url.includes('/api/chat')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            response: 'Here is the assistance you requested.',
            mode: 'ask',
            model: 'universal-llm'
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders chat interface with empty thread prompt and knowledge online in advanced mode', () => {
    render(<AssistantChat advancedOpen={true} />);

    expect(screen.getByText('Knowledge Online')).toBeTruthy();
    expect(screen.getByTestId('thread-empty')).toBeTruthy();
  });

  it('switches modes via simple mode picker and category popover in compact mode', async () => {
    render(<AssistantChat advancedOpen={false} />);

    const modeSelect = screen.getByRole('combobox', { name: /chat mode/i });
    fireEvent.change(modeSelect, { target: { value: 'explain' } });

    const contextBtn = screen.getByRole('button', { name: /context/i });
    fireEvent.click(contextBtn);

    await waitFor(() => {
      expect(screen.getByText(/Conversation context/i)).toBeTruthy();
    });

    const categorySelect = screen.getByRole('combobox', { name: /chat category/i });
    fireEvent.change(categorySelect, { target: { value: 'math' } });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask for calculations, symbolic math, or proof help/i)).toBeTruthy();
    });
  });
});
