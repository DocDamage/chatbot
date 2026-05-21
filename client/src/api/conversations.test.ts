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
    global.fetch = vi.fn().mockResolvedValue({
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
  });

  it('maps conversation management endpoints', async () => {
    await listConversations(5);
    await getConversation('session-1');
    await deleteConversation('session-1');
    await shareConversation('session-1', 'Current chat');
    await getSharedConversation('share-1', 'secret');

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/conversations?limit=5');
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/conversations/session-1');
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/conversations/session-1', { method: 'DELETE' });
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/conversations/session-1/share', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(5, '/api/share/share-1?password=secret');
  });

  it('maps quick reply and document search endpoints', async () => {
    await getQuickReplies('How?', 'Like this', { mode: 'ask' });
    await searchDocuments('release', 7);

    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('/api/chat/quick-replies?'));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/documents/search?q=release&limit=7');
  });
});
