import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AssistantChat from './AssistantChat';

vi.mock('@assistant-ui/react', () => ({
  AssistantRuntimeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useExternalStoreRuntime: () => ({}),
  ThreadPrimitive: {
    Root: ({ children, className }: any) => <div className={className}>{children}</div>,
    Viewport: ({ children, className }: any) => <div className={className}>{children}</div>,
    Empty: ({ children }: any) => <div>{children}</div>,
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

vi.mock('../api/runtime', () => ({ isStaticPagesBuild: false }));
vi.mock('./FileExplorerPanel', () => ({ default: () => <div data-testid="file-explorer" /> }));
vi.mock('./KnowledgeOSPanel', () => ({ default: () => <div data-testid="knowledge-os" /> }));
vi.mock('./ConversationToolsPanel', () => ({ default: () => <div data-testid="conversation-tools" /> }));
vi.mock('./CodeWorkflowPanel', () => ({ default: () => <div data-testid="code-workflows" /> }));
vi.mock('./CreativeComposerPanel', () => ({
  defaultCreativeComposerState: {},
  buildCreativeRequestPayload: () => ({}),
  default: () => <div data-testid="creative-composer" />
}));
vi.mock('./KnowledgeMissPrompt', () => ({ default: () => <div data-testid="knowledge-miss" /> }));
vi.mock('./PlanActionBar', () => ({ default: () => <div data-testid="plan-action" /> }));
vi.mock('./AudioPreviewBrowser', () => ({ default: () => <div data-testid="audio-browser" /> }));
vi.mock('./FLStudioControlPanel', () => ({ default: () => <div data-testid="fl-control" /> }));
vi.mock('../features/gis/GISMapPanel', () => ({ default: () => <div data-testid="gis-panel" /> }));
vi.mock('./GamingPlaybookPanel', () => ({ default: () => <div>Gaming Playbooks</div> }));
vi.mock('./KnowledgeOnlinePanel', () => ({ default: () => <div>Knowledge Online</div> }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AssistantChat specialist panel scoping', () => {
  it('shows Knowledge Online in ask mode without showing Gaming playbooks', () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);

    render(<AssistantChat />);

    expect(screen.getByText('Knowledge Online')).toBeTruthy();
    expect(screen.queryByText('Gaming Playbooks')).toBeNull();
  });

  it('shows Gaming playbooks only after switching to Gaming mode', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    const user = userEvent.setup();

    render(<AssistantChat />);

    await user.click(screen.getByRole('button', { name: /ask/i }));
    await user.click(screen.getByRole('option', { name: /gaming/i }));

    await waitFor(() => expect(screen.getByText('Gaming Playbooks')).toBeTruthy());
    expect(screen.getByText('Knowledge Online')).toBeTruthy();
  });

  it('hides both panels in Story mode', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    const user = userEvent.setup();

    render(<AssistantChat />);

    await user.click(screen.getByRole('button', { name: /ask/i }));
    await user.click(screen.getByRole('option', { name: /story/i }));

    await waitFor(() => expect(screen.queryByText('Knowledge Online')).toBeNull());
    expect(screen.queryByText('Gaming Playbooks')).toBeNull();
  });
});
