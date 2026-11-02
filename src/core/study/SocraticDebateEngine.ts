/**
 * Socratic Practice & Debate Engine (PX15-T08)
 *
 * Implements Socratic questioning, explain-back, debate scenarios, and misconception detection
 * with strict source citation grounding.
 */

import * as crypto from 'crypto';
import { DebatePracticeMode, SocraticSession, SocraticTurn, SourceChunk, StudyCollection } from './StudyTypes';

export class SocraticDebateEngine {
  /**
   * Starts a new Socratic or debate practice session.
   */
  public startSession(
    collection: StudyCollection,
    mode: DebatePracticeMode,
    topic: string,
    initialPrompt?: string
  ): SocraticSession {
    const sessionId = `soc-${crypto.randomUUID()}`;
    const firstTurn: SocraticTurn = {
      turnId: `turn-${crypto.randomUUID()}`,
      role: 'tutor',
      content:
        initialPrompt ||
        this.getInitialTutorPrompt(mode, topic, collection.subject),
      timestamp: new Date().toISOString()
    };

    return {
      sessionId,
      collectionId: collection.id,
      mode,
      topic,
      turns: [firstTurn],
      isCompleted: false
    };
  }

  /**
   * Generates opening tutor prompt based on mode.
   */
  private getInitialTutorPrompt(mode: DebatePracticeMode, topic: string, subject: string): string {
    switch (mode) {
      case 'explain_back':
        return `Let us begin your explain-back exercise on "${topic}". In your own words, describe how this principle functions within ${subject}.`;
      case 'socratic_questioning':
        return `Welcome to Socratic inquiry on "${topic}". Why is this concept considered fundamental, and what would happen if its primary assumption were removed?`;
      case 'debate_positions':
        return `Debate Challenge: Take a position supporting the primary approach in "${topic}", and present your strongest opening argument.`;
      case 'misconception_review':
        return `In "${topic}", many students confuse the primary mechanism with secondary effects. How do you distinguish them?`;
      case 'evidence_challenge':
        return `Evidence Challenge: What specific textual evidence from our authorized study materials supports the validity of "${topic}"?`;
      case 'oral_answer':
      default:
        return `Please provide your spoken or written summary for "${topic}".`;
    }
  }

  /**
   * Evaluates student response against source chunks and advances dialogue.
   */
  public submitStudentResponse(
    session: SocraticSession,
    studentText: string,
    chunks: SourceChunk[]
  ): { session: SocraticSession; tutorTurn: SocraticTurn } {
    // 1. Record student turn
    const studentTurn: SocraticTurn = {
      turnId: `turn-${crypto.randomUUID()}`,
      role: 'student',
      content: studentText,
      timestamp: new Date().toISOString()
    };
    session.turns.push(studentTurn);

    // 2. Analyze response against source chunks for misconceptions and citations
    const relevantChunks = chunks.filter((c) =>
      c.text.toLowerCase().includes(session.topic.toLowerCase()) ||
      studentText.toLowerCase().includes(c.chapterTitle?.toLowerCase() || '')
    );
    const primaryChunk = relevantChunks[0] || chunks[0];

    const studentWords = new Set(studentText.toLowerCase().match(/\b\w+\b/g) || []);
    const sourceWords = new Set(primaryChunk?.text.toLowerCase().match(/\b\w+\b/g) || []);

    let overlapCount = 0;
    for (const w of studentWords) {
      if (sourceWords.has(w)) overlapCount++;
    }
    const groundedRatio = studentWords.size > 0 ? overlapCount / studentWords.size : 0;

    const misconceptions: string[] = [];
    if (groundedRatio < 0.2) {
      misconceptions.push('Response makes general assertions not clearly grounded in the authorized source material.');
    }

    let tutorContent = '';
    let feedback = '';

    if (groundedRatio >= 0.3) {
      tutorContent = `Well reasoned. You captured key elements accurately: "${studentText.substring(0, 80)}...". How does this specifically relate to ${primaryChunk?.chapterTitle || 'the foundational mechanism'}?`;
      feedback = 'Strong source alignment. Good grasp of essential concepts.';
    } else {
      tutorContent = `Interesting perspective, but consider the source text: "${primaryChunk?.text.substring(0, 120)}...". How does this perspective reconcile with the source's findings?`;
      feedback = 'Review recommended: Ground your explanation closer to the source evidence.';
    }

    const tutorTurn: SocraticTurn = {
      turnId: `turn-${crypto.randomUUID()}`,
      role: 'tutor',
      content: tutorContent,
      sourceCitations: primaryChunk ? [primaryChunk.anchor] : [],
      identifiedMisconceptions: misconceptions,
      feedback,
      timestamp: new Date().toISOString()
    };

    session.turns.push(tutorTurn);
    if (session.turns.length >= 6) {
      session.isCompleted = true;
      session.summaryFeedback =
        'Practice session completed. Demonstrated good conceptual comprehension with opportunities for tighter source grounding.';
    }

    return { session, tutorTurn };
  }
}
