/**
 * Canonical Feedback Service (CRK-P16-T06)
 *
 * Central production service for ingesting, validating, enriching, and storing user
 * feedback. Enforces privacy retention, deletion by session/user, and trace version binding.
 *
 * In accordance with §2874, feedback cannot directly trigger automatic model retraining.
 */

import {
  FeedbackEvent,
  FeedbackEventInput,
  feedbackEventSchema,
  EnrichedFeedbackRecord,
  FeedbackCategory,
} from '../../types/feedback';
import { FeedbackTraceBinding, TraceExtractionParams } from './FeedbackTraceBinding';
import { FeedbackTriageService } from './FeedbackTriageService';
import { Database } from '../database/Database';
import { logger } from '../observability/logger';

export interface FeedbackSubmissionParams {
  event: Omit<FeedbackEventInput, 'id' | 'createdAt'>;
  traceContext?: TraceExtractionParams;
}

export interface FeedbackStats {
  total: number;
  thumbsUp: number;
  thumbsDown: number;
  positiveRate: number;
  categoryBreakdown: Record<FeedbackCategory, number>;
}

export class CanonicalFeedbackService {
  private inMemoryEvents: Map<string, EnrichedFeedbackRecord> = new Map();
  private readonly traceBinding: FeedbackTraceBinding;
  private readonly triageService: FeedbackTriageService;

  constructor(
    private readonly db?: Database,
    traceBinding?: FeedbackTraceBinding,
    triageService?: FeedbackTriageService
  ) {
    this.traceBinding = traceBinding ?? new FeedbackTraceBinding();
    this.triageService = triageService ?? new FeedbackTriageService();
  }

  /**
   * Submits and records feedback with full trace binding and triage evaluation.
   */
  public async submitFeedback(params: FeedbackSubmissionParams): Promise<EnrichedFeedbackRecord> {
    const id = `fb-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const fullEvent: FeedbackEvent = feedbackEventSchema.parse({
      id,
      ...params.event,
      createdAt: new Date().toISOString(),
    });

    const traceMeta = this.traceBinding.extractTraceMetadata(params.traceContext || {});

    const enrichedRecord: EnrichedFeedbackRecord = {
      id,
      event: fullEvent,
      trace: traceMeta,
      createdAt: fullEvent.createdAt,
    };

    this.inMemoryEvents.set(id, enrichedRecord);

    // Triage for evaluation candidates (negative or failure-flagged feedback)
    this.triageService.triageFeedback(fullEvent);

    // Persist to database if available
    if (this.db) {
      try {
        await this.db.query(
          `INSERT INTO message_feedback 
           (id, message_id, session_id, user_id, reaction, rating, comment, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            fullEvent.responseId,
            fullEvent.sessionId,
            fullEvent.userId || null,
            fullEvent.thumbs || null,
            fullEvent.rating || null,
            fullEvent.comment || null,
            fullEvent.createdAt,
          ]
        );
      } catch (err: any) {
        logger.warn('Failed to persist feedback to database', { error: err.message });
      }
    }

    logger.info('Canonical feedback submitted and bound to trace', {
      feedbackId: id,
      responseId: fullEvent.responseId,
      model: traceMeta.model,
      policy: traceMeta.modelPolicy,
    });

    return enrichedRecord;
  }

  /**
   * Retrieves feedback records by response ID.
   */
  public getFeedbackByResponse(responseId: string): EnrichedFeedbackRecord[] {
    return Array.from(this.inMemoryEvents.values()).filter(r => r.event.responseId === responseId);
  }

  /**
   * Deletes all feedback associated with a session (privacy/compliance §2894).
   */
  public async deleteFeedbackBySession(sessionId: string): Promise<number> {
    let deletedCount = 0;
    for (const [id, record] of this.inMemoryEvents.entries()) {
      if (record.event.sessionId === sessionId) {
        this.inMemoryEvents.delete(id);
        deletedCount++;
      }
    }

    if (this.db) {
      try {
        await this.db.query('DELETE FROM message_feedback WHERE session_id = ?', [sessionId]);
      } catch (err: any) {
        logger.warn('Failed to delete session feedback from database', { error: err.message });
      }
    }

    logger.info('Feedback purged for session', { sessionId, deletedCount });
    return deletedCount;
  }

  /**
   * Deletes all feedback associated with a user (privacy/GDPR §2894).
   */
  public async deleteFeedbackByUser(userId: string): Promise<number> {
    let deletedCount = 0;
    for (const [id, record] of this.inMemoryEvents.entries()) {
      if (record.event.userId === userId) {
        this.inMemoryEvents.delete(id);
        deletedCount++;
      }
    }

    if (this.db) {
      try {
        await this.db.query('DELETE FROM message_feedback WHERE user_id = ?', [userId]);
      } catch (err: any) {
        logger.warn('Failed to delete user feedback from database', { error: err.message });
      }
    }

    logger.info('Feedback purged for user', { userId, deletedCount });
    return deletedCount;
  }

  /**
   * Computes feedback statistics and category breakdowns.
   */
  public getStats(): FeedbackStats {
    const all = Array.from(this.inMemoryEvents.values());
    let thumbsUp = 0;
    let thumbsDown = 0;
    const categoryBreakdown: Record<FeedbackCategory, number> = {
      incorrect: 0,
      instruction_failure: 0,
      outdated: 0,
      misunderstood: 0,
      bad_code: 0,
      too_verbose: 0,
      too_short: 0,
      wrong_source: 0,
      tool_failed: 0,
      citation_problem: 0,
      other: 0,
    };

    for (const rec of all) {
      if (rec.event.thumbs === 'up' || (rec.event.rating && rec.event.rating >= 4)) {
        thumbsUp++;
      } else if (rec.event.thumbs === 'down' || (rec.event.rating && rec.event.rating <= 2)) {
        thumbsDown++;
      }

      for (const cat of rec.event.categories) {
        if (categoryBreakdown[cat] !== undefined) {
          categoryBreakdown[cat]++;
        }
      }
    }

    const total = all.length;
    const positiveRate = total > 0 ? parseFloat((thumbsUp / total).toFixed(2)) : 1.0;

    return {
      total,
      thumbsUp,
      thumbsDown,
      positiveRate,
      categoryBreakdown,
    };
  }

  public getTriageService(): FeedbackTriageService {
    return this.triageService;
  }
}
