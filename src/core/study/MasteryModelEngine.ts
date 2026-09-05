/**
 * Mastery Model & Study Plan Engine (PX15-T07)
 *
 * Implements study plan generation and transparent rule-based topic mastery calculations.
 */

import * as crypto from 'crypto';
import {
  Flashcard,
  QuizAttempt,
  StudyCollection,
  StudyPlan,
  StudyPlanActivity,
  TargetLevel,
  TopicMastery
} from './StudyTypes';

export class MasteryModelEngine {
  /**
   * Generates a multi-day structured study plan.
   */
  public generateStudyPlan(
    collection: StudyCollection,
    topics: string[],
    options: {
      dailyMinutesBudget?: number;
      deadlineDays?: number;
      targetLevel?: TargetLevel;
    } = {}
  ): StudyPlan {
    const dailyMinutes = options.dailyMinutesBudget || 45;
    const daysCount = options.deadlineDays || Math.max(3, topics.length * 2);
    const activities: StudyPlanActivity[] = [];

    let day = 1;
    for (const topic of topics) {
      // Day A: Read & Cornell Notes
      activities.push({
        id: `act-${crypto.randomUUID()}`,
        dayNumber: day,
        title: `Read & Notes: ${topic}`,
        activityType: 'notes',
        targetTopic: topic,
        estimatedMinutes: Math.min(30, dailyMinutes),
        completed: false
      });

      // Day A+1: Flashcard drill & Quiz
      activities.push({
        id: `act-${crypto.randomUUID()}`,
        dayNumber: Math.min(daysCount, day + 1),
        title: `Active Recall & Quiz: ${topic}`,
        activityType: 'quiz',
        targetTopic: topic,
        estimatedMinutes: Math.min(25, dailyMinutes),
        completed: false
      });

      day = Math.min(daysCount, day + 2);
    }

    // Final Exam Sim on last day
    activities.push({
      id: `act-${crypto.randomUUID()}`,
      dayNumber: daysCount,
      title: `Final Review & Exam Simulation: ${collection.subject}`,
      activityType: 'exam_sim',
      targetTopic: collection.subject,
      estimatedMinutes: dailyMinutes,
      completed: false
    });

    const masteryStatus: Record<string, TopicMastery> = {};
    for (const topic of topics) {
      masteryStatus[topic] = {
        topic,
        masteryScore: 0,
        level: 'beginner',
        quizSuccessRate: 0,
        flashcardRecallRate: 0,
        lastAssessedAt: new Date().toISOString()
      };
    }

    return {
      id: `plan-${crypto.randomUUID()}`,
      collectionId: collection.id,
      goal: collection.learningGoals.join(', ') || `Mastery of ${collection.subject}`,
      deadline: collection.scheduleDeadline,
      dailyMinutesBudget: dailyMinutes,
      activities,
      masteryStatus,
      disclaimer:
        'Notice: Topic mastery metrics are transparent heuristic indicators of review consistency and exercise performance. They do not constitute an accredited psychometric or educational diagnosis.'
    };
  }

  /**
   * Computes topic mastery score (0 - 100) based on quiz attempts and flashcard performance.
   */
  public computeTopicMastery(
    topic: string,
    quizAttempts: QuizAttempt[],
    flashcards: Flashcard[]
  ): TopicMastery {
    // 1. Calculate Quiz Success Rate
    let quizPointsEarned = 0;
    let quizPointsTotal = 0;
    for (const att of quizAttempts) {
      quizPointsEarned += att.score;
      quizPointsTotal += att.totalPoints;
    }
    const quizSuccessRate = quizPointsTotal > 0 ? quizPointsEarned / quizPointsTotal : 0;

    // 2. Calculate Flashcard Recall Rate (ratings >= 3 count as recalled)
    let totalReviews = 0;
    let successfulRecalls = 0;
    for (const card of flashcards) {
      if (card.tags.includes(topic)) {
        for (const rev of card.repetitionState.history) {
          totalReviews++;
          if (rev.rating >= 3) successfulRecalls++;
        }
      }
    }
    const flashcardRecallRate = totalReviews > 0 ? successfulRecalls / totalReviews : 0;

    // Weighted formula: 60% Quiz Performance + 40% Flashcard Recall
    let rawScore = 0;
    if (quizPointsTotal > 0 && totalReviews > 0) {
      rawScore = quizSuccessRate * 60 + flashcardRecallRate * 40;
    } else if (quizPointsTotal > 0) {
      rawScore = quizSuccessRate * 100;
    } else if (totalReviews > 0) {
      rawScore = flashcardRecallRate * 100;
    }

    const masteryScore = Math.min(100, Math.round(rawScore));

    let level: TargetLevel = 'beginner';
    if (masteryScore >= 85) {
      level = 'mastery';
    } else if (masteryScore >= 70) {
      level = 'advanced';
    } else if (masteryScore >= 45) {
      level = 'intermediate';
    }

    return {
      topic,
      masteryScore,
      level,
      quizSuccessRate: Math.round(quizSuccessRate * 100) / 100,
      flashcardRecallRate: Math.round(flashcardRecallRate * 100) / 100,
      lastAssessedAt: new Date().toISOString()
    };
  }
}
