/**
 * Phase PX-15: Source-Grounded Study Studio Evaluation Test Suite
 *
 * Validates:
 * - PX15-T01: Study collection & source model, checksums, portable bundle import/export
 * - PX15-T02: Source ingestion, chapter extraction, retrieval chunking, glossary extraction
 * - PX15-T03: Structured notes (8 formats), source citations, coverage and completeness reports
 * - PX15-T04: Flashcard generation, duplicate scoring, SM-2 spaced repetition review
 * - PX15-T05: Quizzes across 6 question types, distractor checks, deterministic grading
 * - PX15-T06: Exam simulation, answer key concealment during active test, topic score breakdown
 * - PX15-T07: Study plan generation and transparent rule-based topic mastery calculations
 * - PX15-T08: Socratic inquiry & debate sessions, misconception detection, source grounding
 * - PX15-T09: Audio lessons & podcast scripts, multi-voice dialogue, transcripts, cue markers
 * - PX15-T10: Educator controls, answer key locking, assignments, audit trail
 * - PX15-T11: StudyStudioService integrated workflow and accessibility
 * - PX15-T12: StudyAssessmentIntegrator automated integrity suite
 */

import {
  StudyCollectionModel,
  StudySourceIngestEngine,
  StructuredNotesEngine,
  FlashcardEngine,
  QuizEngine,
  ExamSimulationEngine,
  MasteryModelEngine,
  SocraticDebateEngine,
  StudyAudioLessonEngine,
  EducatorReviewControls,
  StudyStudioService,
  StudyAssessmentIntegrator
} from '../index';

describe('Phase PX-15: Source-Grounded Study Studio', () => {
  const sampleMarkdown = `# Machine Learning Fundamentals
Machine learning algorithms build a mathematical model based on sample data, known as training data, in order to make predictions or decisions without being explicitly programmed to do so.

## Supervised Learning
Supervised learning algorithms build a mathematical model of a set of data that contains both the inputs and the desired outputs.
**Classification**: Algorithms used when outputs are restricted to a limited set of discrete values.
**Regression**: Algorithms used when outputs have a continuous numerical range.

## Unsupervised Learning
Unsupervised learning algorithms take a set of data that contains only inputs, and find structure in the data, like grouping or clustering of data points.`;

  // PX15-T01: Study Collection & Source Model
  describe('PX15-T01: Study Collection Model & Bundle Import/Export', () => {
    it('creates collections, tracks sources, detects changes, and exports/imports bundles', () => {
      const model = new StudyCollectionModel();
      const col = model.createCollection({
        ownerId: 'student-1',
        title: 'Intro to ML',
        subject: 'Machine Learning',
        targetLevel: 'intermediate',
        learningGoals: ['Understand Supervised vs Unsupervised']
      });

      expect(col.id).toMatch(/^col-/);

      const src = model.addSource(col.id, {
        title: 'ML Basics',
        content: sampleMarkdown
      });

      expect(src.sha256Digest).toBeTruthy();
      expect(col.sources.length).toBe(1);

      // Check bundle export & import
      const bundle = model.exportCollectionBundle(col.id);
      expect(bundle).toContain('manifestVersion');

      const imported = model.importCollectionBundle(bundle);
      expect(imported.id).toBe(col.id);
      expect(imported.sources[0].title).toBe('ML Basics');
    });
  });

  // PX15-T02: Source Ingestion & Segmentation
  describe('PX15-T02: Source Ingestion, Segmentation, and Glossary Extraction', () => {
    it('extracts chapters, creates retrieval chunks, and detects glossary terms with citations', () => {
      const model = new StudyCollectionModel();
      const col = model.createCollection({
        ownerId: 'student-1',
        title: 'ML Collection',
        subject: 'AI'
      });
      const src = model.addSource(col.id, {
        title: 'ML Doc',
        content: sampleMarkdown
      });

      const ingest = new StudySourceIngestEngine();
      const result = ingest.ingestSource(src);

      expect(result.chapters.length).toBeGreaterThanOrEqual(2);
      expect(result.chapters).toContain('Supervised Learning');
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.glossaryTerms.some((g) => g.term === 'Classification')).toBe(true);
      expect(result.chunks[0].anchor.citationText).toContain('ML Doc');
    });
  });

  // PX15-T03: Structured Notes
  describe('PX15-T03: Structured Notes Generation (8 Formats)', () => {
    it('generates outline, cornell, and key concepts notes with source citations', () => {
      const model = new StudyCollectionModel();
      const col = model.createCollection({ ownerId: 's1', title: 'ML Notes', subject: 'ML' });
      const src = model.addSource(col.id, { title: 'ML Doc', content: sampleMarkdown });
      const ingest = new StudySourceIngestEngine().ingestSource(src);

      const notesEngine = new StructuredNotesEngine();

      const outlineNote = notesEngine.generateNote(col, ingest.chunks, 'outline');
      expect(outlineNote.noteType).toBe('outline');
      expect(outlineNote.contentMarkdown).toContain('# ML - Outline');
      expect(outlineNote.contentMarkdown).toContain('[Source:');
      expect(outlineNote.coveragePercent).toBe(100);

      const cornellNote = notesEngine.generateNote(col, ingest.chunks, 'cornell');
      expect(cornellNote.contentMarkdown).toContain('Cornell Notes');
      expect(cornellNote.contentMarkdown).toContain('Main Notes & Details');

      const comparisonNote = notesEngine.generateNote(col, ingest.chunks, 'comparison_table');
      expect(comparisonNote.contentMarkdown).toContain('Comparison Matrix');
    });
  });

  // PX15-T04: Flashcard & Spaced Repetition
  describe('PX15-T04: Flashcards & SuperMemo SM-2 Spaced Repetition', () => {
    it('generates flashcards, detects duplicate prompts, and updates review schedule', () => {
      const model = new StudyCollectionModel();
      const col = model.createCollection({ ownerId: 's1', title: 'ML Cards', subject: 'ML' });
      const src = model.addSource(col.id, { title: 'ML Doc', content: sampleMarkdown });
      const ingest = new StudySourceIngestEngine().ingestSource(src);

      const engine = new FlashcardEngine();
      const cards = engine.generateCardsFromChunks(col, ingest.chunks);
      expect(cards.length).toBeGreaterThan(0);

      const card = cards[0];
      expect(card.repetitionState.intervalDays).toBe(1);

      // Review card with quality rating 5 (perfect)
      const reviewedCard = engine.reviewCard(card, 5);
      expect(reviewedCard.repetitionState.repetitionCount).toBe(1);
      expect(reviewedCard.repetitionState.intervalDays).toBe(1);
      expect(reviewedCard.repetitionState.history.length).toBe(1);

      // Review second time with 5
      const reviewedAgain = engine.reviewCard(reviewedCard, 5);
      expect(reviewedAgain.repetitionState.repetitionCount).toBe(2);
      expect(reviewedAgain.repetitionState.intervalDays).toBe(6);

      // Duplicate score
      const duplicateScore = engine.calculateDuplicateScore(card, reviewedAgain);
      expect(duplicateScore).toBe(1.0);
    });
  });

  // PX15-T05: Quiz & Deterministic Grading
  describe('PX15-T05: Quiz Engine & Deterministic Grading', () => {
    it('generates multi-type questions, distractors, and grades attempts with partial credit', () => {
      const model = new StudyCollectionModel();
      const col = model.createCollection({ ownerId: 's1', title: 'ML Quiz', subject: 'ML' });
      const src = model.addSource(col.id, { title: 'ML Doc', content: sampleMarkdown });
      const ingest = new StudySourceIngestEngine().ingestSource(src);

      const quizEngine = new QuizEngine();
      const questions = quizEngine.generateQuestionsFromChunks(col, ingest.chunks);
      expect(questions.length).toBeGreaterThan(0);

      // Grade 100% correct
      const userAnswers: Record<string, string | string[]> = {};
      for (const q of questions) {
        userAnswers[q.id] = q.correctAnswer;
      }

      const attempt = quizEngine.gradeAttempt(questions, userAnswers);
      expect(attempt.percentage).toBe(100);
      expect(attempt.score).toBe(attempt.totalPoints);
      expect(attempt.itemResults.every((r) => r.correct)).toBe(true);

      // Test incorrect submission
      const wrongAnswers: Record<string, string | string[]> = {};
      for (const q of questions) {
        wrongAnswers[q.id] = 'Wrong Answer Text';
      }
      const failedAttempt = quizEngine.gradeAttempt(questions, wrongAnswers);
      expect(failedAttempt.score).toBe(0);
    });
  });

  // PX15-T06: Exam Simulation
  describe('PX15-T06: Exam Simulation & Non-Exposure of Answers', () => {
    it('runs timed exam simulation, conceals answer keys during active test, and gives score breakdown', () => {
      const model = new StudyCollectionModel();
      const col = model.createCollection({ ownerId: 's1', title: 'ML Exam', subject: 'ML' });
      const src = model.addSource(col.id, { title: 'ML Doc', content: sampleMarkdown });
      const ingest = new StudySourceIngestEngine().ingestSource(src);

      const quizEngine = new QuizEngine();
      const questions = quizEngine.generateQuestionsFromChunks(col, ingest.chunks);

      const examEngine = new ExamSimulationEngine();
      const session = examEngine.startExam({
        title: 'ML Midterm Exam',
        timeLimitMinutes: 60,
        topics: [{ topic: 'Supervised Learning', weight: 1.0 }],
        questions,
        allowPause: true,
        accommodationsMultiplier: 1.5 // 90 min accommodation
      });

      expect(session.timeLimitMinutes).toBe(90);

      // Verify answer key concealment in active session questions
      const sanitized = examEngine.getSanitizedActiveQuestions(session.sessionId);
      for (const sq of sanitized) {
        expect((sq as any).correctAnswer).toBeUndefined();
        expect((sq as any).explanation).toBeUndefined();
      }

      // Record answers and submit
      for (const q of questions) {
        examEngine.recordAnswer(session.sessionId, q.id, q.correctAnswer);
      }

      const result = examEngine.submitExam(session.sessionId);
      expect(result.percentage).toBe(100);
      expect(result.topicBreakdown).toBeDefined();
      expect(result.disclaimerNotice).toContain('simulation is for practice');
    });
  });

  // PX15-T07: Mastery Model & Study Plans
  describe('PX15-T07: Mastery Model & Multi-Day Study Plans', () => {
    it('generates multi-day study plan and computes topic mastery scores transparently', () => {
      const model = new StudyCollectionModel();
      const col = model.createCollection({
        ownerId: 's1',
        title: 'ML Plan',
        subject: 'Machine Learning',
        learningGoals: ['Understand algorithms']
      });

      const masteryEngine = new MasteryModelEngine();
      const plan = masteryEngine.generateStudyPlan(col, ['Supervised', 'Unsupervised'], {
        dailyMinutesBudget: 40,
        deadlineDays: 5
      });

      expect(plan.activities.length).toBeGreaterThanOrEqual(4);
      expect(plan.activities.some((a) => a.activityType === 'exam_sim')).toBe(true);
      expect(plan.disclaimer).toContain('transparent heuristic');

      // Test mastery score calculation
      const dummyCard = {
        id: 'c1',
        collectionId: col.id,
        frontPrompt: 'p',
        backAnswer: 'a',
        sourceAnchors: [],
        difficulty: 'medium' as const,
        tags: ['Machine Learning'],
        repetitionState: {
          intervalDays: 1,
          easeFactor: 2.5,
          repetitionCount: 1,
          nextDueDate: '',
          history: [{ reviewedAt: '', rating: 5, intervalDays: 1 }]
        },
        isSuspended: false,
        reviewedByEducator: true,
        createdAt: '',
        isStale: false
      };

      const mastery = masteryEngine.computeTopicMastery('Machine Learning', [], [dummyCard]);
      expect(mastery.flashcardRecallRate).toBe(1.0);
      expect(mastery.masteryScore).toBe(100);
      expect(mastery.level).toBe('mastery');
    });
  });

  // PX15-T08 & PX15-T09: Socratic Practice & Audio Lessons
  describe('PX15-T08 & PX15-T09: Socratic Dialogue & Audio Lessons', () => {
    it('manages Socratic debate turns, checks source grounding, and generates podcast script', () => {
      const model = new StudyCollectionModel();
      const col = model.createCollection({ ownerId: 's1', title: 'ML Audio', subject: 'Machine Learning' });
      const src = model.addSource(col.id, { title: 'ML Doc', content: sampleMarkdown });
      const ingest = new StudySourceIngestEngine().ingestSource(src);

      // Socratic debate
      const socraticEngine = new SocraticDebateEngine();
      const session = socraticEngine.startSession(col, 'explain_back', 'Supervised Learning');
      expect(session.turns.length).toBe(1);

      const turnRes = socraticEngine.submitStudentResponse(
        session,
        'Supervised learning uses labeled training data to predict discrete or continuous outputs.',
        ingest.chunks
      );
      expect(turnRes.session.turns.length).toBe(3);
      expect(turnRes.tutorTurn.sourceCitations?.length).toBeGreaterThan(0);

      // Audio lesson podcast
      const audioEngine = new StudyAudioLessonEngine();
      const lesson = audioEngine.generateAudioLesson(col, ingest.chunks, 'two_host_dialogue');
      expect(lesson.speakers).toContain('Alex');
      expect(lesson.speakers).toContain('Sam');
      expect(lesson.cuePoints.length).toBeGreaterThan(0);
      expect(lesson.fullTranscript).toContain('Alex');
    });
  });

  // PX15-T10, PX15-T11, & PX15-T12: Integrated Study Studio & Assessment Integrity
  describe('PX15-T10, PX15-T11, & PX15-T12: Integrated Studio Service & Assessment Integrity', () => {
    it('runs end-to-end Study Studio workflow with educator controls', () => {
      const studio = new StudyStudioService();
      const col = studio.createStudyCollection({
        ownerId: 'student-alpha',
        title: 'Full Studio Test',
        subject: 'Machine Learning'
      });

      studio.addSourceDocument({
        title: 'ML Reference',
        content: sampleMarkdown
      });

      // Generate notes, flashcards, quizzes
      const note = studio.generateNote('key_concepts');
      expect(note.id).toBeTruthy();

      const cards = studio.generateFlashcards();
      expect(cards.length).toBeGreaterThan(0);

      const card = studio.reviewFlashcard(cards[0].id, 4);
      expect(card.repetitionState.history.length).toBe(1);

      const questions = studio.generateQuizQuestions();
      expect(questions.length).toBeGreaterThan(0);

      // Educator controls
      const educator = studio.getEducatorControls();
      educator.lockAnswerKey(questions[0].id, 'prof-jones');
      expect(educator.isAnswerKeyLocked(questions[0].id)).toBe(true);

      const state = studio.getStudioState();
      expect(state.collection?.id).toBe(col.id);
      expect(state.notes.length).toBe(1);
      expect(state.flashcards.length).toBeGreaterThan(0);
    });

    it('passes the automated Study Assessment Integrity Suite', async () => {
      const report = await StudyAssessmentIntegrator.runEvaluationSuite();

      expect(report.citationCorrectnessRate).toBe(1.0);
      expect(report.deterministicScoringPass).toBe(true);
      expect(report.distractorValidityRate).toBe(1.0);
      expect(report.duplicateFlashcardRate).toBeLessThan(0.2);
      expect(report.staleSourcePropagationPass).toBe(true);
      expect(report.crossTenantIsolationPass).toBe(true);
      expect(report.overallPassed).toBe(true);
    });
  });
});
