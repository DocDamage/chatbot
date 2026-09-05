import { ConversationManager } from './ConversationManager';

describe('ConversationManager', () => {
  it('persists a session before inserting messages', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const manager = new ConversationManager({ query } as any);

    await manager.addMessage('session-1', 'user', 'hello', { userId: 'user-1' });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO sessions'),
      ['session-1', 'user-1']
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO messages'),
      expect.arrayContaining(['session-1', 'user', 'hello'])
    );
  });

  it('keeps user ownership in memory for conversation listing', async () => {
    const manager = new ConversationManager();

    await manager.addMessage('session-1', 'user', 'hello', { userId: 'user-1' });
    await manager.addMessage('session-2', 'user', 'different user', { userId: 'user-2' });

    const conversations = await manager.listConversations('user-1');

    expect(conversations).toHaveLength(1);
    expect(conversations[0].sessionId).toBe('session-1');
    expect(conversations[0].userId).toBe('user-1');
  });

  it('uses chronological messages for persisted conversation summaries', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        session_id: 'session-1',
        user_id: 'user-1',
        message_count: 2,
        first_message: 'First chronological message',
        last_message: 'Last chronological message',
        created_at: '2026-08-06T01:00:00.000Z',
        updated_at: '2026-08-06T01:01:00.000Z',
      }],
      rowCount: 1,
    });
    const manager = new ConversationManager({ query } as any);

    const conversations = await manager.listConversations('user-1', 10);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('ORDER BY first.created_at ASC, first.id ASC');
    expect(sql).toContain('ORDER BY last.created_at DESC, last.id DESC');
    expect(sql).not.toContain('MIN(m.content)');
    expect(sql).not.toContain('MAX(m.content)');
    expect(params).toEqual(['user-1', 10]);
    expect(conversations).toEqual([
      expect.objectContaining({
        sessionId: 'session-1',
        firstMessage: 'First chronological message',
        lastMessage: 'Last chronological message',
        messageCount: 2,
      }),
    ]);
  });

  it('manages conversation context window, search, delete, and db load fallbacks', async () => {
    const dbQuery = jest.fn().mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('SELECT * FROM messages')) {
        return {
          rows: [
            { id: 'm1', session_id: params[0], role: 'user', content: 'What is AI?', created_at: new Date().toISOString(), metadata: '{"k":"v"}' },
            { id: 'm2', session_id: params[0], role: 'assistant', content: 'AI is artificial intelligence.', created_at: new Date().toISOString() }
          ]
        };
      }
      if (sql.includes('DELETE FROM')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const manager = new ConversationManager({ query: dbQuery } as any);

    // 1. Get conversation loaded from DB
    const loaded = await manager.getConversation('db-session');
    expect(loaded).not.toBeNull();
    expect(loaded?.messages.length).toBe(2);
    expect(loaded?.messages[0].metadata?.k).toBe('v');

    // 2. Context window truncation
    const fullContext = await manager.getConversationContext('db-session', 100);
    expect(fullContext.length).toBe(2);

    const smallContext = await manager.getConversationContext('db-session', 10); // fits last message
    expect(smallContext.length).toBe(1);

    // 3. Search conversations
    const searchRes = await manager.searchConversations('artificial');
    expect(searchRes.length).toBe(1);
    expect(searchRes[0].sessionId).toBe('db-session');

    // 4. Delete conversation
    const deleted = await manager.deleteConversation('db-session');
    expect(deleted).toBe(true);

    // 5. Query error resilience
    const failingDb = new ConversationManager({
      query: jest.fn().mockRejectedValue(new Error('DB disconnect'))
    } as any);

    await expect(failingDb.addMessage('sess-err', 'user', 'msg')).resolves.toBeDefined();
    await expect(failingDb.getConversation('sess-err')).resolves.toBeDefined();
    await expect(failingDb.listConversations('user-x')).resolves.toBeDefined();
    await expect(failingDb.deleteConversation('sess-err')).resolves.toBeDefined();
  });
});
