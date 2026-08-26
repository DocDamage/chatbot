import { ConversationSharingService } from '../ConversationSharing';

describe('RT-SHARE-001: ConversationSharing Service Suite', () => {
  let mockDb: any;
  let service: ConversationSharingService;

  beforeEach(() => {
    mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 })
    };
    service = new ConversationSharingService('https://hub.example.com', mockDb);
  });

  it('creates public and password-protected conversation shares with DB persistence', async () => {
    const publicShare = await service.createShare('sess-001', {
      userId: 'user-1',
      title: 'Public Chat',
      description: 'Useful discussion',
      public: true,
      expiresInDays: 7
    });

    expect(publicShare.shareId).toBeDefined();
    expect(publicShare.url).toContain('https://hub.example.com/share/');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO shared_conversations'),
      expect.any(Array)
    );

    // Retrieve public share
    const retrieved = await service.getShare(publicShare.shareId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe('Public Chat');
    expect(retrieved?.viewCount).toBe(1);

    // Password protected share
    const protectedShare = await service.createShare('sess-002', {
      userId: 'user-1',
      title: 'Secret Chat',
      password: 'super-secret-password'
    });

    // Getting without password throws
    await expect(service.getShare(protectedShare.shareId)).rejects.toThrow('Password required');

    // Getting with wrong password throws
    await expect(service.getShare(protectedShare.shareId, 'wrong-password')).rejects.toThrow('Invalid password');

    // Getting with correct password succeeds
    const secretDoc = await service.getShare(protectedShare.shareId, 'super-secret-password');
    expect(secretDoc?.title).toBe('Secret Chat');
  });

  it('handles expired shares and nonexistent shares', async () => {
    const expiredShare = await service.createShare('sess-003', {
      expiresInDays: -1 // Already expired
    });

    const result = await service.getShare(expiredShare.shareId);
    expect(result).toBeNull();

    const missing = await service.getShare('nonexistent-id');
    expect(missing).toBeNull();
  });

  it('lists shares by user and enforces authorization on deletion', async () => {
    await service.createShare('sess-10', { userId: 'user-A', title: 'Doc A1' });
    await service.createShare('sess-11', { userId: 'user-A', title: 'Doc A2' });
    const shareB = await service.createShare('sess-20', { userId: 'user-B', title: 'Doc B1' });

    const userAShares = await service.listShares('user-A');
    expect(userAShares.length).toBe(2);

    // Unauthorized deletion attempt
    await expect(service.deleteShare(shareB.shareId, 'user-A')).rejects.toThrow('Not authorized to delete this share');

    // Authorized deletion
    const deleted = await service.deleteShare(shareB.shareId, 'user-B');
    expect(deleted).toBe(true);

    // Deleting nonexistent share returns false
    const deletedAgain = await service.deleteShare('nonexistent');
    expect(deletedAgain).toBe(false);
  });

  it('falls back to DB retrieval when share is not in memory cache', async () => {
    const isolatedService = new ConversationSharingService('https://hub.example.com', mockDb);
    mockDb.query.mockResolvedValueOnce({
      rows: [{
        share_id: 'db-share-123',
        session_id: 'db-sess',
        user_id: 'user-db',
        title: 'DB Loaded Share',
        description: 'From DB',
        public: 1,
        password: null,
        expires_at: null,
        view_count: 5,
        created_at: new Date().toISOString()
      }]
    });

    const retrieved = await isolatedService.getShare('db-share-123');
    expect(retrieved?.title).toBe('DB Loaded Share');
    expect(retrieved?.viewCount).toBe(6);
  });
});
