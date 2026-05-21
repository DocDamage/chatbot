import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConversationToolsPanel from './ConversationToolsPanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/conversations?')) {
      return {
        ok: true,
        json: async () => ({ conversations: [{ sessionId: 'session-1', firstMessage: 'Hello', lastMessage: 'Done', messageCount: 2 }] }),
      } as Response;
    }
    if (url === '/api/conversations/session-1') {
      return {
        ok: true,
        json: async () => ({ conversation: { sessionId: 'session-1', messages: [{ id: 'm1', sessionId: 'session-1', role: 'user', content: 'Hello', timestamp: '2026-05-20T00:00:00.000Z' }] } }),
      } as Response;
    }
    if (url === '/api/documents/search?q=release&limit=10') {
      return {
        ok: true,
        json: async () => ({ documents: [{ id: 'doc-1', title: 'Release Audit', source: 'docs/RELEASE_COMPLETION_AUDIT.md' }] }),
      } as Response;
    }
    if (url.startsWith('/api/chat/quick-replies?')) {
      return {
        ok: true,
        json: async () => ({ replies: ['Run release check'] }),
      } as Response;
    }
    return {
      ok: true,
      json: async () => ({ success: true, url: 'http://localhost:3001/share/share-1' }),
    } as Response;
  });
});

describe('ConversationToolsPanel', () => {
  it('maps conversation history, load, delete, and share controls to routes', async () => {
    const user = userEvent.setup();
    const onLoadConversation = vi.fn();

    render(
      <ConversationToolsPanel
        sessionId="current-session"
        onLoadConversation={onLoadConversation}
        onUseQuickReply={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /conversation tools/i }));
    await user.click(screen.getByRole('button', { name: /refresh history/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /hello/i })).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /hello/i }));
    await waitFor(() => expect(onLoadConversation).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'session-1' })));

    await user.click(screen.getByRole('button', { name: /delete session-1/i }));
    await user.click(screen.getByRole('button', { name: /share current chat/i }));

    expect(fetch).toHaveBeenCalledWith('/api/conversations?limit=20');
    expect(fetch).toHaveBeenCalledWith('/api/conversations/session-1');
    expect(fetch).toHaveBeenCalledWith('/api/conversations/session-1', { method: 'DELETE' });
    expect(fetch).toHaveBeenCalledWith('/api/conversations/current-session/share', expect.objectContaining({ method: 'POST' }));
  });

  it('maps quick replies and document search to visible controls', async () => {
    const user = userEvent.setup();
    const onUseQuickReply = vi.fn();

    render(
      <ConversationToolsPanel
        sessionId="current-session"
        lastUserMessage="What next?"
        lastAssistantMessage="Run checks."
        onLoadConversation={vi.fn()}
        onUseQuickReply={onUseQuickReply}
      />
    );

    await user.click(screen.getByRole('button', { name: /conversation tools/i }));
    await user.click(screen.getByRole('button', { name: /quick replies/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /run release check/i })).toBeTruthy());
    await user.click(screen.getByRole('button', { name: /run release check/i }));

    await user.type(screen.getByPlaceholderText(/search documents/i), 'release');
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    await waitFor(() => expect(screen.getByText('Release Audit')).toBeTruthy());

    expect(onUseQuickReply).toHaveBeenCalledWith('Run release check');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/chat/quick-replies?'));
    expect(fetch).toHaveBeenCalledWith('/api/documents/search?q=release&limit=10');
  });

  it('displays structured 500 route errors without dumping backend details', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: {
          message: 'Document index unavailable',
          code: 'INTERNAL_ERROR',
          details: { secret: 'server-only-token' },
        },
      }),
    } as Response);

    render(
      <ConversationToolsPanel
        sessionId="current-session"
        onLoadConversation={vi.fn()}
        onUseQuickReply={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /conversation tools/i }));
    await user.type(screen.getByPlaceholderText(/search documents/i), 'release');
    await user.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText('Document index unavailable')).toBeTruthy());
    expect(screen.queryByText(/server-only-token/i)).toBeNull();
  });
});
