import { DocumentMetadataManager } from '../DocumentMetadata';
import { FeedbackService } from '../../feedback/FeedbackService';

describe('B75-08: Document Metadata and Message Feedback Matrix', () => {
  describe('DocumentMetadataManager', () => {
    it('creates, updates, retrieves, searches, and extracts tags/categories', async () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };

      const manager = new DocumentMetadataManager(mockDb as any);

      // 1. Create document metadata
      const doc1 = await manager.upsertMetadata({
        source: 's3://docs/architecture.pdf',
        title: 'System Architecture Design',
        description: 'Comprehensive overview of microservice topology',
        tags: ['architecture', 'backend', 'v2'],
        category: 'engineering',
        version: 1,
        chunkCount: 12,
        contentHash: 'hash_abc123',
        metadata: { author: 'Alice', securityClassification: 'internal' }
      });

      expect(doc1.id).toBeDefined();
      expect(doc1.version).toBe(1);
      expect(mockDb.query).toHaveBeenCalledTimes(1);

      // 2. Upsert same source + contentHash (updates version)
      const doc1Updated = await manager.upsertMetadata({
        source: 's3://docs/architecture.pdf',
        title: 'System Architecture Design (Revised)',
        tags: ['architecture', 'backend', 'v3'],
        category: 'engineering',
        version: 1,
        chunkCount: 15,
        contentHash: 'hash_abc123',
        metadata: { author: 'Alice', securityClassification: 'internal' }
      });
      expect(doc1Updated.version).toBe(2);
      expect(doc1Updated.title).toContain('Revised');

      // 3. Create second document
      const doc2 = await manager.upsertMetadata({
        source: 's3://docs/user_guide.md',
        title: 'User Onboarding Manual',
        description: 'Step-by-step guide for end users',
        tags: ['guide', 'support'],
        category: 'product',
        version: 1,
        chunkCount: 5,
        contentHash: 'hash_xyz789',
        metadata: { author: 'Bob' }
      });

      // 4. Retrieve metadata
      expect(manager.getMetadata(doc1.id)?.title).toBe('System Architecture Design (Revised)');
      expect(manager.getMetadata('nonexistent_id')).toBeUndefined();

      // 5. Tags and categories extraction
      expect(manager.getAllTags()).toEqual(['architecture', 'backend', 'guide', 'support', 'v3']);
      expect(manager.getAllCategories()).toEqual(['engineering', 'product']);

      // 6. Search with filters
      const searchTag = manager.search({ tags: ['guide'] });
      expect(searchTag.length).toBe(1);
      expect(searchTag[0].id).toBe(doc2.id);

      const searchCategory = manager.search({ category: 'engineering' });
      expect(searchCategory.length).toBe(1);

      const searchSource = manager.search({ source: 's3://docs/user_guide.md' });
      expect(searchSource.length).toBe(1);

      const searchQuery = manager.search({ searchQuery: 'microservice' });
      expect(searchQuery.length).toBe(1);

      const searchDate = manager.search({
        createdAfter: new Date(Date.now() - 10000),
        createdBefore: new Date(Date.now() + 10000)
      });
      expect(searchDate.length).toBe(2);
    });

    it('handles database write errors gracefully', async () => {
      const failingDb = {
        query: jest.fn().mockRejectedValue(new Error('DB connection refused'))
      };

      const manager = new DocumentMetadataManager(failingDb as any);
      const doc = await manager.upsertMetadata({
        source: 'file://local/note.txt',
        title: 'Local Note',
        tags: [],
        version: 1,
        chunkCount: 1,
        contentHash: 'hash_note',
        metadata: {}
      });

      expect(doc.id).toBeDefined();
    });
  });

  describe('FeedbackService', () => {
    it('submits reactions, ratings, computes stats, and queries session history', async () => {
      const mockDb = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };

      const service = new FeedbackService(mockDb as any);

      // Submit feedback 1: like + 5 rating
      await service.submitFeedback({
        messageId: 'msg-1',
        sessionId: 'session-alpha',
        userId: 'u1',
        reaction: 'like',
        rating: 5,
        comment: 'Very helpful answer!'
      });

      // Submit feedback 2: helpful + 4 rating
      await service.submitFeedback({
        messageId: 'msg-1',
        sessionId: 'session-alpha',
        userId: 'u2',
        reaction: 'helpful',
        rating: 4
      });

      // Submit feedback 3: dislike + 2 rating
      await service.submitFeedback({
        messageId: 'msg-2',
        sessionId: 'session-beta',
        userId: 'u3',
        reaction: 'dislike',
        rating: 2,
        comment: 'Incorrect information'
      });

      // Retrieve feedback for msg-1
      const msg1Feedback = service.getFeedback('msg-1');
      expect(msg1Feedback.length).toBe(2);

      // Retrieve session feedback
      const alphaFeedback = service.getSessionFeedback('session-alpha');
      expect(alphaFeedback.length).toBe(2);

      // Global stats
      const globalStats = service.getStats();
      expect(globalStats.totalFeedback).toBe(3);
      expect(globalStats.averageRating).toBeCloseTo(3.67, 1);
      expect(globalStats.positiveRate).toBeCloseTo(66.67, 1);
      expect(globalStats.reactions.get('like')).toBe(1);
      expect(globalStats.reactions.get('helpful')).toBe(1);
      expect(globalStats.reactions.get('dislike')).toBe(1);

      // Message specific stats
      const msg1Stats = service.getStats('msg-1');
      expect(msg1Stats.totalFeedback).toBe(2);
      expect(msg1Stats.averageRating).toBe(4.5);
      expect(msg1Stats.positiveRate).toBe(100);
    });

    it('handles database write errors gracefully', async () => {
      const failingDb = {
        query: jest.fn().mockRejectedValue(new Error('DB failure'))
      };

      const service = new FeedbackService(failingDb as any);
      const res = await service.submitFeedback({
        messageId: 'msg-err',
        sessionId: 'sess-err',
        reaction: 'accurate'
      });

      expect(res.id).toBeDefined();
    });
  });
});
