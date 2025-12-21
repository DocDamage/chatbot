/**
 * Conversation Sharing - Share conversations via links
 */

import { logger } from '../observability/logger';
import { Database } from '../database/Database';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export interface SharedConversation {
  shareId: string;
  sessionId: string;
  userId?: string;
  title?: string;
  description?: string;
  public: boolean;
  password?: string; // Hashed
  expiresAt?: Date;
  viewCount: number;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export class ConversationSharingService {
  private shares: Map<string, SharedConversation> = new Map();
  private db?: Database;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001', db?: Database) {
    this.baseUrl = baseUrl;
    this.db = db;
  }

  /**
   * Create a shareable link for a conversation
   */
  async createShare(
    sessionId: string,
    options: {
      userId?: string;
      title?: string;
      description?: string;
      public?: boolean;
      password?: string;
      expiresInDays?: number;
    } = {}
  ): Promise<{ shareId: string; url: string }> {
    const shareId = uuidv4().substr(0, 12);
    const expiresAt = options.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const passwordHash = options.password
      ? crypto.createHash('sha256').update(options.password).digest('hex')
      : undefined;

    const share: SharedConversation = {
      shareId,
      sessionId,
      userId: options.userId,
      title: options.title,
      description: options.description,
      public: options.public ?? false,
      password: passwordHash,
      expiresAt,
      viewCount: 0,
      createdAt: new Date(),
    };

    this.shares.set(shareId, share);

    // Persist to database
    if (this.db) {
      try {
        await this.db.query(
          `INSERT INTO shared_conversations
           (share_id, session_id, user_id, title, description, public, password, expires_at, view_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            shareId,
            sessionId,
            options.userId || null,
            options.title || null,
            options.description || null,
            share.public ? 1 : 0,
            passwordHash || null,
            expiresAt?.toISOString() || null,
            0,
            share.createdAt.toISOString(),
          ]
        );
      } catch (error: any) {
        logger.warn('Failed to persist share to database', { error: error.message });
      }
    }

    const url = `${this.baseUrl}/share/${shareId}`;
    logger.info('Conversation share created', { shareId, sessionId, public: share.public });

    return { shareId, url };
  }

  /**
   * Get shared conversation
   */
  async getShare(shareId: string, password?: string): Promise<SharedConversation | null> {
    let share = this.shares.get(shareId);

    // Load from database if not in memory
    if (!share && this.db) {
      try {
        const result = await this.db.query(
          'SELECT * FROM shared_conversations WHERE share_id = ?',
          [shareId]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          share = {
            shareId: row.share_id,
            sessionId: row.session_id,
            userId: row.user_id,
            title: row.title,
            description: row.description,
            public: row.public === 1,
            password: row.password,
            expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
            viewCount: row.view_count,
            createdAt: new Date(row.created_at),
          };
          this.shares.set(shareId, share);
        }
      } catch (error: any) {
        logger.warn('Failed to load share from database', { error: error.message });
      }
    }

    if (!share) return null;

    // Check expiration
    if (share.expiresAt && share.expiresAt < new Date()) {
      logger.info('Share expired', { shareId });
      return null;
    }

    // Check password
    if (share.password) {
      if (!password) {
        throw new Error('Password required');
      }
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      if (hash !== share.password) {
        throw new Error('Invalid password');
      }
    }

    // Increment view count
    share.viewCount++;
    if (this.db) {
      try {
        await this.db.query(
          'UPDATE shared_conversations SET view_count = ? WHERE share_id = ?',
          [share.viewCount, shareId]
        );
      } catch (error: any) {
        logger.warn('Failed to update view count', { error: error.message });
      }
    }

    return share;
  }

  /**
   * Delete a share
   */
  async deleteShare(shareId: string, userId?: string): Promise<boolean> {
    const share = this.shares.get(shareId);
    if (!share) return false;

    // Check ownership
    if (userId && share.userId !== userId) {
      throw new Error('Not authorized to delete this share');
    }

    this.shares.delete(shareId);

    if (this.db) {
      try {
        await this.db.query('DELETE FROM shared_conversations WHERE share_id = ?', [shareId]);
      } catch (error: any) {
        logger.warn('Failed to delete share from database', { error: error.message });
      }
    }

    logger.info('Share deleted', { shareId });
    return true;
  }

  /**
   * List shares for a user
   */
  async listShares(userId: string): Promise<SharedConversation[]> {
    return Array.from(this.shares.values())
      .filter(share => share.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

