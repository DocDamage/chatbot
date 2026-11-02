import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteConversation,
  getConversation,
  getQuickReplies,
  getSharedConversation,
  listConversations,
  searchDocuments,
  shareConversation,
} from './conversations';

describe('conversation API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps conversation management endpoints with parameter options', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        conversations: [{ sessionId: 'session-1' }],
        conversation: { sessionId: 'session-1', messages: [] },
        documents: [{ id: 'doc-1', title: 'Release Audit', source: 'docs' }],
        replies: ['Run the tests'],
        success: true,
        shareId: 'share-1',
      }),
    } as Response);

    await listConversations(5);
    await listConversations();
    await getConversation('session-1');
    await deleteConversation('session-1');
    await shareConversation('session-1', 'Current chat');
    await shareConversation('session-1');
    await getSharedConversation('share-1', 'secret');
    await getSharedConversation('share-1');

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/conversations?limit=5');
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/conversations?limit=20');
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/conversations/session-1');
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/conversations/session-1', { method: 'DELETE' });
    expect(fetch).toHaveBeenNthCalledWith(5, '/api/conversations/session-1/share', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(6, '/api/conversations/session-1/share', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(7, '/api/share/share-1?password=secret');
    expect(fetch).toHaveBeenNthCalledWith(8, '/api/share/share-1');
  });

  it('maps quick reply and document search endpoints with default parameters and empty fallbacks', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        replies: ['Run the tests'],
        documents: [{ id: 'doc-1', title: 'Release Audit', source: 'docs' }],
      }),
    } as Response));

    await getQuickReplies('How?', 'Like this', { mode: 'ask' });
    await searchDocuments('release', 7);

    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('/api/chat/quick-replies?'));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/documents/search?q=release&limit=7');

    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({}),
    } as Response));

    await expect(listConversations()).resolves.toEqual([]);
    await expect(getQuickReplies('How?', 'Like this')).resolves.toEqual([]);
    await expect(searchDocuments('release')).resolves.toEqual([]);
  });

  it('handles error paths across all conversation endpoints', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failure' }),
    } as Response);

    await expect(listConversations()).rejects.toThrow();
    await expect(getConversation('session-1')).rejects.toThrow();
    await expect(deleteConversation('session-1')).rejects.toThrow();
    await expect(shareConversation('session-1')).rejects.toThrow();
    await expect(getSharedConversation('share-1')).rejects.toThrow();
    await expect(getQuickReplies('a', 'b')).rejects.toThrow();
    await expect(searchDocuments('query')).rejects.toThrow();
  });
});
