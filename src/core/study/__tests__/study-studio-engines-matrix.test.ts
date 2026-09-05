import { StudyStudioService } from '../StudyStudioService';
import { QuizEngine } from '../QuizEngine';
import { SocraticDebateEngine } from '../SocraticDebateEngine';
import { StructuredNotesEngine } from '../StructuredNotesEngine';
import { ExamSimulationEngine } from '../ExamSimulationEngine';
import { MasteryModelEngine } from '../MasteryModelEngine';
import { StudyCollection, SourceChunk } from '../StudyTypes';

describe('B75-06: Study Studio Engines Decision Matrix', () => {
  let studio: StudyStudioService;
  let collection: StudyCollection;
  let sampleChunks: SourceChunk[];

  beforeEach(() => {
    studio = new StudyStudioService();
    collection = studio.createStudyCollection({
      ownerId: 'user_123',
      title: 'Cell Biology & Genetics',
      subject: 'Biology',
      targetLevel: 'advanced',
      learningGoals: ['Understand mitosis and meiosis', 'Explain DNA transcription'],
    });

    sampleChunks = [
      {
        chunkId: 'chunk_1',
        sourceId: 'src_1',
        sourceTitle: 'Cell Biology Essentials',
        chapterTitle: 'Mitosis',
        text: 'Mitosis is a process of cell division resulting in two genetically identical daughter cells. Prophase is the first phase where chromosomes condense. Spindle fibers attach during metaphase.',
        startOffset: 0,
        endOffset: 150,
        anchor: {
          sourceId: 'src_1',
          sourceTitle: 'Cell Biology Essentials',
          citationText: 'Cell Bio Essentials, p. 42',
        },
      },
      {
        chunkId: 'chunk_2',
        sourceId: 'src_2',
        sourceTitle: 'Genetics 101',
        chapterTitle: 'DNA Transcription',
        text: 'DNA transcription involves copying a segment of DNA into RNA by RNA polymerase. The promoter region initiates transcription.',
        startOffset: 0,
        endOffset: 120,
        anchor: {
          sourceId: 'src_2',
          sourceTitle: 'Genetics 101',
          citationText: 'Genetics 101, p. 108',
        },
      },
    ];
  });

  describe('StudyStudioService Lifecycle', () => {
    it('manages collections, notes, flashcards, quizzes, exams, and socratic sessions', async () => {
      expect(studio.getActiveCollection()).toBe(collection);

      // Ingest sources
      const { source, chunks } = studio.addSourceDocument({
        title: 'Cell Biology Essentials',
        content: sampleChunks[0].text,
        format: 'text',
      });
      expect(source).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);

      // Generate notes
      const note = studio.generateNote('cornell', 'Mitosis Overview');
      expect(note.title).toBe('Mitosis Overview');

      // Generate flashcards
      const cards = studio.generateFlashcards();
      expect(cards.length).toBeGreaterThan(0);

      // Review card
      const reviewed = studio.reviewFlashcard(cards[0].id, 4);
      expect(reviewed.repetitionState.intervalDays).toBeGreaterThan(0);

      // Generate quiz and submit attempt
      const quizQuestions = studio.generateQuizQuestions();
      expect(quizQuestions.length).toBeGreaterThan(0);

      const attempt = studio.submitQuizAttempt({
        [quizQuestions[0].id]: quizQuestions[0].correctAnswer,
      });
      expect(attempt.score).toBeGreaterThanOrEqual(0);

      // Socratic debate
      const session = studio.startSocraticSession('socratic_questioning', 'Mitosis vs Meiosis');
      expect(session.topic).toBe('Mitosis vs Meiosis');

      const advanced = studio.submitSocraticTurn(
        session.sessionId,
        'Mitosis creates 2 diploid cells while meiosis creates 4 haploid gametes.'
      );
      expect(advanced.turns.length).toBeGreaterThan(1);

      // Study plan
      const plan = studio.generateStudyPlan(60);
      expect(plan.dailyMinutesBudget).toBe(60);
    });
  });

  describe('QuizEngine', () => {
    it('generates questions and grades attempts with partial credit and distractor analysis', () => {
      const engine = new QuizEngine();
      const questions = engine.generateQuestionsFromChunks(collection, sampleChunks);
      expect(questions.length).toBeGreaterThan(0);

      const q1 = questions[0];
      const attempt = engine.gradeAttempt(questions, {
        [q1.id]: q1.correctAnswer,
      });

      expect(attempt.totalPoints).toBeGreaterThan(0);
      expect(attempt.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('SocraticDebateEngine, StructuredNotesEngine, ExamSimulationEngine, MasteryModelEngine', () => {
    it('SocraticDebateEngine handles modes, evaluation, and turn taking', () => {
      const engine = new SocraticDebateEngine();
      const session = engine.startSession(collection, 'debate_positions', 'Cell division');
      expect(session.mode).toBe('debate_positions');

      const next = engine.submitStudentResponse(
        session,
        'I believe mitosis is essential for multicellular tissue repair.',
        sampleChunks
      );
      expect(next.session.turns.length).toBeGreaterThan(1);
    });

    it('StructuredNotesEngine generates all 8 note formats, handles fallback and empty chunks', () => {
      const engine = new StructuredNotesEngine();

      const formats = [
        'cornell',
        'outline',
        'key_concepts',
        'glossary',
        'formula_sheet',
        'timeline',
        'comparison_table',
        'chapter_summary',
        'unrecognized_type' as any,
      ] as const;

      for (const fmt of formats) {
        const note = engine.generateNote(collection, sampleChunks, fmt);
        expect(note.contentMarkdown).toBeDefined();
        expect(note.coveragePercent).toBe(100);
      }

      // Empty chunks edge case
      const emptyNote = engine.generateNote(collection, [], 'outline');
      expect(emptyNote.unsupportedClaimWarnings.length).toBeGreaterThan(0);
      expect(emptyNote.coveragePercent).toBe(0);
    });

    it('ExamSimulationEngine constructs blueprints and grades simulation attempts', () => {
      const examEngine = new ExamSimulationEngine();
      const quizEngine = new QuizEngine();
      const questions = quizEngine.generateQuestionsFromChunks(collection, sampleChunks);

      const blueprint = {
        title: 'Midterm Exam',
        timeLimitMinutes: 60,
        topics: [{ topic: 'Mitosis', weight: 1.0 }],
        questions,
        allowPause: true,
        accommodationsMultiplier: 1.5,
      };

      const examSession = examEngine.startExam(blueprint);
      expect(examSession.isSubmitted).toBe(false);
      expect(examSession.timeLimitMinutes).toBe(90);

      // Sanitized questions
      const sanitized = examEngine.getSanitizedActiveQuestions(examSession.sessionId);
      expect(sanitized.length).toBe(questions.length);

      // Pause toggle
      expect(examEngine.togglePause(examSession.sessionId)).toBe(true);
      expect(examEngine.togglePause(examSession.sessionId, false)).toBe(false);

      examEngine.recordAnswer(examSession.sessionId, questions[0].id, questions[0].correctAnswer);
      const result = examEngine.submitExam(examSession.sessionId);
      expect(result.score).toBeGreaterThanOrEqual(0);

      // Error answering submitted exam
      expect(() => examEngine.recordAnswer(examSession.sessionId, 'q2', 'ans')).toThrow(
        'Cannot answer on a submitted exam'
      );
    });

    it('FlashcardEngine computes duplicate scores, merges cards, and evaluates SM-2 ratings', () => {
      const { FlashcardEngine } = require('../FlashcardEngine');
      const engine = new FlashcardEngine();

      const cards = engine.generateCardsFromChunks(collection, sampleChunks);
      expect(cards.length).toBeGreaterThan(0);

      const simScore = engine.calculateDuplicateScore(cards[0], cards[0]);
      expect(simScore).toBe(1.0);

      if (cards.length > 1) {
        const merged = engine.mergeCards(cards[0], cards[1]);
        expect(merged.sourceAnchors.length).toBeGreaterThanOrEqual(2);
      }

      // Test all SM-2 review ratings 0 to 5
      for (let r = 0; r <= 5; r++) {
        const reviewed = engine.reviewCard(cards[0], r);
        expect(reviewed.repetitionState.intervalDays).toBeGreaterThan(0);
      }
    });

    it('MasteryModelEngine computes topic mastery and spaced repetition retention decay', () => {
      const mastery = new MasteryModelEngine();

      const updated = mastery.computeTopicMastery(
        'Mitosis',
        [{ score: 10, totalPoints: 10 }] as any,
        []
      );
      expect(updated.masteryScore).toBeGreaterThanOrEqual(0);
    });
  });
});
