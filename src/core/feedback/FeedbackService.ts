/**
 * Feedback Service - Message reactions and feedback
 */

import { logger } from '../observability/logger';
import { Database } from '../database/Database';

export type ReactionType = 'like' | 'dislike' | 'helpful' | 'not_helpful' | 'accurate' | 'inaccurate';

export interface MessageFeedback {
  id: string;
  messageId: string;
  sessionId: string;
  userId?: string;
  reaction?: ReactionType;
  rating?: number; // 1-5
  comment?: string;
  timestamp: Date;
}

export interface FeedbackStats {
  totalFeedback: number;
  reactions: Map<ReactionType, number>;
  averageRating: number;
  positiveRate: number; // % of positive reactions
}

export class FeedbackService {
  private feedback: Map<string, MessageFeedback> = new Map();
  private db?: Database;

  constructor(db?: Database) {
    this.db = db;
  }

  /**
   * Submit feedback for a message
   */
  async submitFeedback(feedback: Omit<MessageFeedback, 'id' | 'timestamp'>): Promise<MessageFeedback> {
    const id = `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullFeedback: MessageFeedback = {
      id,
      ...feedback,
      timestamp: new Date(),
    };

    this.feedback.set(id, fullFeedback);

    // Persist to database if available
    if (this.db) {
      try {
        await this.db.query(
          `INSERT INTO message_feedback 
           (id, message_id, session_id, user_id, reaction, rating, comment, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            feedback.messageId,
            feedback.sessionId,
            feedback.userId || null,
            feedback.reaction || null,
            feedback.rating || null,
            feedback.comment || null,
            fullFeedback.timestamp.toISOString(),
          ]
        );
      } catch (error: any) {
        logger.warn('Failed to persist feedback to database', { error: error.message });
      }
    }

    logger.info('Feedback submitted', {
      id,
      messageId: feedback.messageId,
      reaction: feedback.reaction,
      rating: feedback.rating,
    });

    return fullFeedback;
  }

  /**
   * Get feedback for a message
   */
  getFeedback(messageId: string): MessageFeedback[] {
    return Array.from(this.feedback.values()).filter(f => f.messageId === messageId);
  }

  /**
   * Get feedback statistics
   */
  getStats(messageId?: string): FeedbackStats {
    const relevantFeedback = messageId
      ? Array.from(this.feedback.values()).filter(f => f.messageId === messageId)
      : Array.from(this.feedback.values());

    const reactions = new Map<ReactionType, number>();
    let totalRating = 0;
    let ratingCount = 0;
    let positiveCount = 0;

    for (const fb of relevantFeedback) {
      if (fb.reaction) {
        reactions.set(fb.reaction, (reactions.get(fb.reaction) || 0) + 1);
        
        // Count positive reactions
        if (['like', 'helpful', 'accurate'].includes(fb.reaction)) {
          positiveCount++;
        }
      }

      if (fb.rating) {
        totalRating += fb.rating;
        ratingCount++;
      }
    }

    const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
    const positiveRate = relevantFeedback.length > 0
      ? (positiveCount / relevantFeedback.length) * 100
      : 0;

    return {
      totalFeedback: relevantFeedback.length,
      reactions,
      averageRating,
      positiveRate,
    };
  }

  /**
   * Get feedback for a session
   */
  getSessionFeedback(sessionId: string): MessageFeedback[] {
    return Array.from(this.feedback.values())
      .filter(f => f.sessionId === sessionId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

