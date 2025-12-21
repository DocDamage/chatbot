/**
 * Reward Model - User satisfaction, task completion, coherence
 * Research: Stanford CS224N, Deep RL for Dialogue Systems
 */

import { logger } from '../observability/logger';

export interface RewardSignal {
  userSatisfaction: number; // 0-1
  taskCompletion: number; // 0-1
  coherence: number; // 0-1
  safety: number; // 0-1
  overall: number; // Weighted average
}

export interface FeedbackData {
  responseId: string;
  userId: string;
  sessionId: string;
  response: string;
  userFeedback?: {
    rating?: number; // 1-5
    thumbsUp?: boolean;
    thumbsDown?: boolean;
    comment?: string;
  };
  implicitFeedback?: {
    userContinued: boolean;
    userAskedFollowUp: boolean;
    responseTime: number;
  };
}

export class RewardModel {
  private feedbackHistory: FeedbackData[] = [];
  private weights = {
    userSatisfaction: 0.4,
    taskCompletion: 0.3,
    coherence: 0.2,
    safety: 0.1
  };

  /**
   * Calculate reward for a response
   */
  calculateReward(feedback: FeedbackData): RewardSignal {
    const userSatisfaction = this.calculateUserSatisfaction(feedback);
    const taskCompletion = this.calculateTaskCompletion(feedback);
    const coherence = this.calculateCoherence(feedback);
    const safety = this.calculateSafety(feedback);

    const overall = 
      userSatisfaction * this.weights.userSatisfaction +
      taskCompletion * this.weights.taskCompletion +
      coherence * this.weights.coherence +
      safety * this.weights.safety;

    const signal: RewardSignal = {
      userSatisfaction,
      taskCompletion,
      coherence,
      safety,
      overall
    };

    // Store feedback
    this.feedbackHistory.push(feedback);

    logger.debug('Reward calculated', {
      responseId: feedback.responseId,
      overall: overall.toFixed(2)
    });

    return signal;
  }

  /**
   * Calculate user satisfaction from feedback
   */
  private calculateUserSatisfaction(feedback: FeedbackData): number {
    if (feedback.userFeedback?.rating) {
      // Normalize 1-5 to 0-1
      return (feedback.userFeedback.rating - 1) / 4;
    }

    if (feedback.userFeedback?.thumbsUp) return 0.9;
    if (feedback.userFeedback?.thumbsDown) return 0.1;

    // Implicit feedback
    if (feedback.implicitFeedback) {
      let score = 0.5; // Base score
      if (feedback.implicitFeedback.userContinued) score += 0.2;
      if (feedback.implicitFeedback.userAskedFollowUp) score += 0.2;
      if (feedback.implicitFeedback.responseTime < 2000) score += 0.1;
      return Math.min(1.0, score);
    }

    return 0.5; // Default neutral
  }

  /**
   * Calculate task completion score
   */
  private calculateTaskCompletion(feedback: FeedbackData): number {
    // Simple heuristic - in production would use more sophisticated analysis
    if (feedback.implicitFeedback?.userAskedFollowUp) {
      // If user asked follow-up, task might not be complete
      return 0.6;
    }
    if (feedback.implicitFeedback?.userContinued) {
      // User continued conversation, task likely complete
      return 0.8;
    }
    return 0.7; // Default
  }

  /**
   * Calculate coherence score
   */
  private calculateCoherence(feedback: FeedbackData): number {
    // Simple heuristic - would use LLM to evaluate coherence
    const responseLength = feedback.response.length;
    
    // Very short or very long responses might be less coherent
    if (responseLength < 20) return 0.6;
    if (responseLength > 2000) return 0.7;
    
    // Check for common coherence issues
    const hasRepeatedPhrases = this.hasRepeatedPhrases(feedback.response);
    if (hasRepeatedPhrases) return 0.6;

    return 0.8; // Default good coherence
  }

  /**
   * Calculate safety score
   */
  private calculateSafety(feedback: FeedbackData): number {
    // Would integrate with safety pipeline
    // For now, assume safe if no negative feedback
    if (feedback.userFeedback?.thumbsDown) {
      return 0.5; // Might be unsafe
    }
    return 0.9; // Default safe
  }

  /**
   * Check for repeated phrases (coherence issue)
   */
  private hasRepeatedPhrases(text: string): boolean {
    const words = text.toLowerCase().split(/\s+/);
    const phraseCounts = new Map<string, number>();

    // Check for 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words.slice(i, i + 3).join(' ');
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    }

    // If any phrase appears more than twice, might be repetitive
    for (const count of phraseCounts.values()) {
      if (count > 2) return true;
    }

    return false;
  }

  /**
   * Get average reward over time
   */
  getAverageReward(limit: number = 100): number {
    const recent = this.feedbackHistory.slice(-limit);
    if (recent.length === 0) return 0.5;

    const rewards = recent.map(f => this.calculateReward(f));
    const avg = rewards.reduce((sum, r) => sum + r.overall, 0) / rewards.length;
    return avg;
  }

  /**
   * Get feedback statistics
   */
  getStats() {
    return {
      totalFeedback: this.feedbackHistory.length,
      averageReward: this.getAverageReward(),
      recentAverage: this.getAverageReward(10)
    };
  }
}

