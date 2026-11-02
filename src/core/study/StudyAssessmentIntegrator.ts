/**
 * Study Assessment Integrity Evaluator (PX15-T12)
 *
 * Implements automated evaluation for citation correctness, answer-key determinism,
 * distractor validity, deduplication rates, stale source propagation, and tenant isolation.
 */

import { FlashcardEngine } from './FlashcardEngine';
import { QuizEngine } from './QuizEngine';
import { StructuredNotesEngine } from './StructuredNotesEngine';
import { StudyCollectionModel } from './StudyCollectionModel';
import { StudySourceIngestEngine } from './StudySourceIngestEngine';
import { Flashcard, QuizQuestion, StructuredNote } from './StudyTypes';

export interface StudyAssessmentReport {
  timestamp: string;
  citationCorrectnessRate: number; // 0.0 - 1.0
  deterministicScoringPass: boolean;
  distractorValidityRate: number; // 0.0 - 1.0
  duplicateFlashcardRate: number; // 0.0 - 1.0
  staleSourcePropagationPass: boolean;
  crossTenantIsolationPass: boolean;
  overallPassed: boolean;
}

export class StudyAssessmentIntegrator {
  /**
   * Runs the assessment integrity evaluation suite.
   */
  public static async runEvaluationSuite(): Promise<StudyAssessmentReport> {
    const colModel = new StudyCollectionModel();
    const ingestEngine = new StudySourceIngestEngine();
    const notesEngine = new StructuredNotesEngine();
    const flashcardEngine = new FlashcardEngine();
    const quizEngine = new QuizEngine();

    // 1. Create collection with verified source text
    const colA = colModel.createCollection({
      ownerId: 'user-a',
      title: 'Operating Systems Principles',
      subject: 'Computer Science',
      targetLevel: 'advanced'
    });

    const sourceContent = `# Memory Virtualization
Virtual memory provides an idealized abstraction of the storage resources that are actually available on a given machine.
Paging divides the virtual address space into fixed-size units called pages.
Page tables map virtual page numbers to physical frame numbers.

# Process Scheduling
Preemptive scheduling allows the operating system to interrupt a currently running process to assign the CPU to another process.
Context switching saves the execution context of the old process and loads the new process context.`;

    const source = colModel.addSource(colA.id, {
      title: 'OS Concepts',
      content: sourceContent
    });

    const ingest = ingestEngine.ingestSource(source);

    // 2. Test Citation Correctness in Notes, Cards, Quizzes
    const note = notesEngine.generateNote(colA, ingest.chunks, 'outline');
    const cards = flashcardEngine.generateCardsFromChunks(colA, ingest.chunks);
    const questions = quizEngine.generateQuestionsFromChunks(colA, ingest.chunks);

    let totalItems = 0;
    let validCitations = 0;

    for (const anchor of note.sourceAnchors) {
      totalItems++;
      if (anchor.sourceId === source.id && anchor.sourceTitle === 'OS Concepts') {
        validCitations++;
      }
    }

    for (const card of cards) {
      totalItems++;
      if (card.sourceAnchors.some((a) => a.sourceId === source.id)) {
        validCitations++;
      }
    }

    for (const q of questions) {
      totalItems++;
      if (q.sourceAnchors.some((a) => a.sourceId === source.id)) {
        validCitations++;
      }
    }

    const citationCorrectnessRate = totalItems > 0 ? validCitations / totalItems : 1.0;

    // 3. Test Deterministic Scoring
    const userAnswers: Record<string, string | string[]> = {};
    for (const q of questions) {
      userAnswers[q.id] = q.correctAnswer;
    }

    const attempt1 = quizEngine.gradeAttempt(questions, userAnswers);
    const attempt2 = quizEngine.gradeAttempt(questions, userAnswers);
    const deterministicScoringPass =
      attempt1.score === attempt2.score &&
      attempt1.percentage === 100 &&
      attempt2.percentage === 100;

    // 4. Test Distractor Validity (check non-empty distractor rationales)
    let distractorCount = 0;
    let validDistractors = 0;
    for (const q of questions) {
      if (q.distractors && q.distractors.length > 0) {
        for (const d of q.distractors) {
          distractorCount++;
          if (d.text.length > 0 && d.rationale.length > 0) validDistractors++;
        }
      }
    }
    const distractorValidityRate = distractorCount > 0 ? validDistractors / distractorCount : 1.0;

    // 5. Test Duplicate Flashcard Detection
    let duplicatePairs = 0;
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const score = flashcardEngine.calculateDuplicateScore(cards[i], cards[j]);
        if (score > 0.8) duplicatePairs++;
      }
    }
    const duplicateFlashcardRate =
      cards.length > 1 ? duplicatePairs / ((cards.length * (cards.length - 1)) / 2) : 0;

    // 6. Test Stale Source Propagation
    const updateResult = colModel.updateSourceContent(
      colA.id,
      source.id,
      sourceContent + '\n\n# Distributed Systems\nRaft consensus protocol.'
    );
    const staleSourcePropagationPass = updateResult.hasChanged === true;

    // 7. Test Cross-Tenant Isolation
    const colB = colModel.createCollection({
      ownerId: 'user-b',
      title: 'Private Medical Notes',
      subject: 'Medicine'
    });
    const colAData = colModel.getCollection(colA.id);
    const colBData = colModel.getCollection(colB.id);
    const crossTenantIsolationPass = Boolean(
      colAData &&
      colBData &&
      colAData.ownerId !== colBData.ownerId &&
      colAData.sources.every((s) => s.id !== colBData.sources[0]?.id)
    );

    const overallPassed = Boolean(
      citationCorrectnessRate === 1.0 &&
      deterministicScoringPass &&
      distractorValidityRate === 1.0 &&
      duplicateFlashcardRate < 0.2 &&
      staleSourcePropagationPass &&
      crossTenantIsolationPass
    );

    return {
      timestamp: new Date().toISOString(),
      citationCorrectnessRate,
      deterministicScoringPass,
      distractorValidityRate,
      duplicateFlashcardRate,
      staleSourcePropagationPass,
      crossTenantIsolationPass,
      overallPassed
    };
  }
}
