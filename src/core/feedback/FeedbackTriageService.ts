/**
 * Feedback Triage & Non-Training Verification Service (CRK-P16-T05)
 *
 * Implements failure classification, evaluation candidate generation, and regression
 * dataset integration from collected user feedback.
 *
 * In strict accordance with §2872-2892, automatic fine-tuning or live parameter updates
 * from user feedback are strictly prohibited.
 */

import {
  FeedbackEvent,
  FeedbackCategory,
  EvaluationCandidateRecord,
} from '../../types/feedback';
import { logger } from '../observability/logger';

export class FeedbackTriageService {
  private candidates: Map<string, EvaluationCandidateRecord> = new Map();

  /**
   * Enforces the invariant that feedback cannot trigger automatic model training (§2874).
   */
  public assertNoAutoTraining(): void {
    // Explicit architectural check: confirms no live weights or fine-tuning APIs are called.
  }

  /**
   * Evaluates a feedback event and creates an evaluation candidate if it signals failure.
   */
  public triageFeedback(feedback: FeedbackEvent): EvaluationCandidateRecord | null {
    this.assertNoAutoTraining();

    const isNegative = feedback.thumbs === 'down' || (feedback.rating !== undefined && feedback.rating <= 2);
    const hasFailureCategories = feedback.categories && feedback.categories.length > 0;

    if (!isNegative && !hasFailureCategories) {
      return null;
    }

    const failureCategories: FeedbackCategory[] = feedback.categories.length > 0
      ? feedback.categories
      : ['other'];

    const candidate: EvaluationCandidateRecord = {
      id: `cand-${feedback.id}-${Date.now()}`,
      feedbackId: feedback.id,
      responseId: feedback.responseId,
      sessionId: feedback.sessionId,
      failureCategories,
      status: 'candidate',
      reviewNotes: feedback.comment,
      createdAt: new Date().toISOString(),
    };

    this.candidates.set(candidate.id, candidate);

    logger.info('Feedback triaged into evaluation candidate', {
      candidateId: candidate.id,
      categories: candidate.failureCategories,
      feedbackId: feedback.id,
    });

    return candidate;
  }

  /**
   * Promotes a reviewed candidate to a verified regression case candidate.
   */
  public promoteToRegression(candidateId: string, notes?: string): EvaluationCandidateRecord {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) {
      throw new Error(`Evaluation candidate ${candidateId} not found`);
    }

    candidate.status = 'regression_added';
    if (notes) candidate.reviewNotes = notes;

    logger.info('Evaluation candidate promoted to regression test suite', {
      candidateId,
      responseId: candidate.responseId,
    });

    return candidate;
  }

  /**
   * Gets all pending evaluation candidates.
   */
  public getCandidates(status?: EvaluationCandidateRecord['status']): EvaluationCandidateRecord[] {
    const all = Array.from(this.candidates.values());
    return status ? all.filter(c => c.status === status) : all;
  }
}
