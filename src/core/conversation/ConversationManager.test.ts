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
});
