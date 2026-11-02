/**
 * Exam Simulation Engine (PX15-T06)
 *
 * Implements timed exam simulations with strict active state answer isolation,
 * accommodations support, topic score breakdown, and source-backed review.
 */

import * as crypto from 'crypto';
import { QuizEngine } from './QuizEngine';
import { ActiveExamSession, ExamBlueprint, ExamResult, QuizQuestion } from './StudyTypes';

export class ExamSimulationEngine {
  private quizEngine: QuizEngine;
  private activeSessions: Map<string, { session: ActiveExamSession; blueprint: ExamBlueprint }> =
    new Map();

  constructor() {
    this.quizEngine = new QuizEngine();
  }

  /**
   * Starts a new exam simulation session. Answer keys are NOT returned in the session object.
   */
  public startExam(blueprint: ExamBlueprint): ActiveExamSession {
    const sessionId = `exam-${crypto.randomUUID()}`;
    const multiplier = blueprint.accommodationsMultiplier || 1.0;
    const effectiveTimeMinutes = Math.round(blueprint.timeLimitMinutes * multiplier);

    const session: ActiveExamSession = {
      sessionId,
      blueprintTitle: blueprint.title,
      startedAt: new Date().toISOString(),
      timeLimitMinutes: effectiveTimeMinutes,
      remainingSeconds: effectiveTimeMinutes * 60,
      isPaused: false,
      answers: {},
      questionsCount: blueprint.questions.length,
      isSubmitted: false
    };

    this.activeSessions.set(sessionId, { session, blueprint });
    return session;
  }

  /**
   * Retrieves sanitized active questions for the examinee (correct answers & explanations stripped).
   */
  public getSanitizedActiveQuestions(sessionId: string): Array<Omit<QuizQuestion, 'correctAnswer' | 'explanation' | 'distractors'>> {
    const record = this.activeSessions.get(sessionId);
    if (!record) throw new Error(`Exam session ${sessionId} not found`);

    return record.blueprint.questions.map((q) => ({
      id: q.id,
      collectionId: q.collectionId,
      questionType: q.questionType,
      prompt: q.prompt,
      options: q.options,
      matchingPairs: q.matchingPairs ? q.matchingPairs.map(p => ({ id: p.id, leftPrompt: p.leftPrompt, rightMatch: '' })) : undefined,
      hints: q.hints,
      sourceAnchors: q.sourceAnchors,
      points: q.points,
      topic: q.topic,
      isStale: q.isStale
    }));
  }

  /**
   * Records an answer for a question in an active exam session.
   */
  public recordAnswer(sessionId: string, questionId: string, answer: string | string[]): void {
    const record = this.activeSessions.get(sessionId);
    if (!record) throw new Error(`Exam session ${sessionId} not found`);
    if (record.session.isSubmitted) throw new Error('Cannot answer on a submitted exam');

    record.session.answers[questionId] = answer;
  }

  /**
   * Pauses or resumes an active exam session.
   */
  public togglePause(sessionId: string, pause?: boolean): boolean {
    const record = this.activeSessions.get(sessionId);
    if (!record) throw new Error(`Exam session ${sessionId} not found`);
    if (!record.blueprint.allowPause) throw new Error('Pausing is not permitted for this exam blueprint');

    record.session.isPaused = pause !== undefined ? pause : !record.session.isPaused;
    return record.session.isPaused;
  }

  /**
   * Submits the exam and computes the final score breakdown and source review.
   */
  public submitExam(sessionId: string): ExamResult {
    const record = this.activeSessions.get(sessionId);
    if (!record) throw new Error(`Exam session ${sessionId} not found`);

    record.session.isSubmitted = true;
    const { session, blueprint } = record;

    const grading = this.quizEngine.gradeAttempt(blueprint.questions, session.answers);

    // Compute breakdown by topic
    const topicBreakdown: Record<string, { earned: number; total: number; percentage: number }> = {};
    for (const q of blueprint.questions) {
      if (!topicBreakdown[q.topic]) {
        topicBreakdown[q.topic] = { earned: 0, total: 0, percentage: 0 };
      }
      topicBreakdown[q.topic].total += q.points;
      const resultItem = grading.itemResults.find((r) => r.questionId === q.id);
      if (resultItem) {
        topicBreakdown[q.topic].earned += resultItem.pointsAwarded;
      }
    }

    for (const t of Object.keys(topicBreakdown)) {
      const top = topicBreakdown[t];
      top.percentage = top.total > 0 ? Math.round((top.earned / top.total) * 100) : 0;
    }

    // Build source-backed review
    const sourceBackedReview = blueprint.questions.map((q) => ({
      questionId: q.id,
      prompt: q.prompt,
      userAnswer: session.answers[q.id] || 'No answer',
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      anchors: q.sourceAnchors
    }));

    return {
      sessionId,
      submittedAt: new Date().toISOString(),
      score: grading.score,
      totalPoints: grading.totalPoints,
      percentage: grading.percentage,
      topicBreakdown,
      sourceBackedReview,
      disclaimerNotice:
        'Notice: This simulation is for practice and self-study only. It does not constitute an official educational or professional credential certification.'
    };
  }
}
