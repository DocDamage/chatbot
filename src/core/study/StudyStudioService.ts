/**
 * Study Studio Service (PX15-T11)
 *
 * Primary orchestrator service for the Source-Grounded Study Studio.
 */

import { EducatorReviewControls } from './EducatorReviewControls';
import { ExamSimulationEngine } from './ExamSimulationEngine';
import { FlashcardEngine } from './FlashcardEngine';
import { MasteryModelEngine } from './MasteryModelEngine';
import { QuizEngine } from './QuizEngine';
import { SocraticDebateEngine } from './SocraticDebateEngine';
import { StructuredNotesEngine } from './StructuredNotesEngine';
import { StudyAudioLessonEngine } from './StudyAudioLessonEngine';
import { StudyCollectionModel } from './StudyCollectionModel';
import { StudySourceIngestEngine } from './StudySourceIngestEngine';
import {
  ActiveExamSession,
  DebatePracticeMode,
  ExamBlueprint,
  ExamResult,
  Flashcard,
  NoteType,
  QuizAttempt,
  QuizQuestion,
  SocraticSession,
  SourceChunk,
  StructuredNote,
  StudyAudioLesson,
  StudyCollection,
  StudyPlan,
  StudySource,
  StudyStudioState,
  TargetLevel,
  TopicMastery
} from './StudyTypes';

export class StudyStudioService {
  private collectionModel: StudyCollectionModel;
  private ingestEngine: StudySourceIngestEngine;
  private notesEngine: StructuredNotesEngine;
  private flashcardEngine: FlashcardEngine;
  private quizEngine: QuizEngine;
  private examEngine: ExamSimulationEngine;
  private masteryEngine: MasteryModelEngine;
  private socraticEngine: SocraticDebateEngine;
  private audioEngine: StudyAudioLessonEngine;
  private educatorControls: EducatorReviewControls;

  private activeCollection: StudyCollection | null = null;
  private cachedChunks: Map<string, SourceChunk[]> = new Map();
  private notes: Map<string, StructuredNote[]> = new Map();
  private flashcards: Map<string, Flashcard[]> = new Map();
  private quizzes: Map<string, QuizQuestion[]> = new Map();
  private quizAttempts: Map<string, QuizAttempt[]> = new Map();
  private studyPlans: Map<string, StudyPlan> = new Map();
  private activeExam: ActiveExamSession | null = null;
  private socraticSessions: Map<string, SocraticSession[]> = new Map();
  private audioLessons: Map<string, StudyAudioLesson[]> = new Map();

  constructor() {
    this.collectionModel = new StudyCollectionModel();
    this.ingestEngine = new StudySourceIngestEngine();
    this.notesEngine = new StructuredNotesEngine();
    this.flashcardEngine = new FlashcardEngine();
    this.quizEngine = new QuizEngine();
    this.examEngine = new ExamSimulationEngine();
    this.masteryEngine = new MasteryModelEngine();
    this.socraticEngine = new SocraticDebateEngine();
    this.audioEngine = new StudyAudioLessonEngine();
    this.educatorControls = new EducatorReviewControls();
  }

  /**
   * Creates a new study collection and sets it as active.
   */
  public createStudyCollection(params: {
    ownerId: string;
    title: string;
    subject: string;
    targetLevel?: TargetLevel;
    learningGoals?: string[];
  }): StudyCollection {
    const col = this.collectionModel.createCollection(params);
    this.activeCollection = col;
    return col;
  }

  /**
   * Sets the active collection.
   */
  public setActiveCollection(collection: StudyCollection): void {
    this.activeCollection = collection;
  }

  /**
   * Gets the active collection.
   */
  public getActiveCollection(): StudyCollection | null {
    return this.activeCollection;
  }

  /**
   * Ingests a source document into the active study collection.
   */
  public addSourceDocument(params: {
    title: string;
    content: string;
    format?: 'markdown' | 'text' | 'pdf' | 'url';
    author?: string;
  }): { source: StudySource; chunks: SourceChunk[] } {
    if (!this.activeCollection) throw new Error('No active study collection');

    const source = this.collectionModel.addSource(this.activeCollection.id, params);
    const ingestRes = this.ingestEngine.ingestSource(source);

    const existingChunks = this.cachedChunks.get(this.activeCollection.id) || [];
    const allChunks = [...existingChunks, ...ingestRes.chunks];
    this.cachedChunks.set(this.activeCollection.id, allChunks);

    return { source, chunks: ingestRes.chunks };
  }

  /**
   * Generates a structured note for the active collection.
   */
  public generateNote(noteType: NoteType, title?: string): StructuredNote {
    if (!this.activeCollection) throw new Error('No active study collection');
    const chunks = this.cachedChunks.get(this.activeCollection.id) || [];

    const note = this.notesEngine.generateNote(this.activeCollection, chunks, noteType, title);
    const noteList = this.notes.get(this.activeCollection.id) || [];
    noteList.push(note);
    this.notes.set(this.activeCollection.id, noteList);

    return note;
  }

  /**
   * Generates flashcards for the active collection.
   */
  public generateFlashcards(): Flashcard[] {
    if (!this.activeCollection) throw new Error('No active study collection');
    const chunks = this.cachedChunks.get(this.activeCollection.id) || [];

    const cards = this.flashcardEngine.generateCardsFromChunks(this.activeCollection, chunks);
    const existing = this.flashcards.get(this.activeCollection.id) || [];
    const combined = [...existing, ...cards];
    this.flashcards.set(this.activeCollection.id, combined);

    return cards;
  }

  /**
   * Reviews a flashcard with rating (0-5) using SM-2 algorithm.
   */
  public reviewFlashcard(cardId: string, rating: number): Flashcard {
    if (!this.activeCollection) throw new Error('No active study collection');
    const cards = this.flashcards.get(this.activeCollection.id) || [];
    const card = cards.find((c) => c.id === cardId);
    if (!card) throw new Error(`Flashcard ${cardId} not found`);

    const updated = this.flashcardEngine.reviewCard(card, rating);
    return updated;
  }

  /**
   * Generates quizzes for the active collection.
   */
  public generateQuizQuestions(): QuizQuestion[] {
    if (!this.activeCollection) throw new Error('No active study collection');
    const chunks = this.cachedChunks.get(this.activeCollection.id) || [];

    const questions = this.quizEngine.generateQuestionsFromChunks(this.activeCollection, chunks);
    const existing = this.quizzes.get(this.activeCollection.id) || [];
    const combined = [...existing, ...questions];
    this.quizzes.set(this.activeCollection.id, combined);

    return questions;
  }

  /**
   * Submits a quiz attempt and grades it deterministically.
   */
  public submitQuizAttempt(
    userAnswers: Record<string, string | string[]>
  ): QuizAttempt {
    if (!this.activeCollection) throw new Error('No active study collection');
    const questions = this.quizzes.get(this.activeCollection.id) || [];

    const attempt = this.quizEngine.gradeAttempt(questions, userAnswers);
    const attempts = this.quizAttempts.get(this.activeCollection.id) || [];
    attempts.push(attempt);
    this.quizAttempts.set(this.activeCollection.id, attempts);

    return attempt;
  }

  /**
   * Starts a timed exam simulation.
   */
  public startExamSimulation(blueprint: ExamBlueprint): ActiveExamSession {
    this.activeExam = this.examEngine.startExam(blueprint);
    return this.activeExam;
  }

  /**
   * Submits an active exam simulation.
   */
  public submitExamSimulation(sessionId: string): ExamResult {
    const result = this.examEngine.submitExam(sessionId);
    this.activeExam = null;
    return result;
  }

  /**
   * Generates a multi-day study plan.
   */
  public generateStudyPlan(dailyMinutes: number = 45): StudyPlan {
    if (!this.activeCollection) throw new Error('No active study collection');
    const chunks = this.cachedChunks.get(this.activeCollection.id) || [];
    const topics = Array.from(new Set(chunks.map((c) => c.chapterTitle || this.activeCollection!.subject)));

    const plan = this.masteryEngine.generateStudyPlan(this.activeCollection, topics, {
      dailyMinutesBudget: dailyMinutes
    });
    this.studyPlans.set(this.activeCollection.id, plan);

    return plan;
  }

  /**
   * Starts a Socratic dialogue practice session.
   */
  public startSocraticSession(mode: DebatePracticeMode, topic: string): SocraticSession {
    if (!this.activeCollection) throw new Error('No active study collection');
    const session = this.socraticEngine.startSession(this.activeCollection, mode, topic);
    const list = this.socraticSessions.get(this.activeCollection.id) || [];
    list.push(session);
    this.socraticSessions.set(this.activeCollection.id, list);

    return session;
  }

  /**
   * Submits student turn in Socratic session.
   */
  public submitSocraticTurn(sessionId: string, text: string): SocraticSession {
    if (!this.activeCollection) throw new Error('No active study collection');
    const list = this.socraticSessions.get(this.activeCollection.id) || [];
    const session = list.find((s) => s.sessionId === sessionId);
    if (!session) throw new Error(`Socratic session ${sessionId} not found`);

    const chunks = this.cachedChunks.get(this.activeCollection.id) || [];
    const result = this.socraticEngine.submitStudentResponse(session, text, chunks);

    return result.session;
  }

  /**
   * Generates an audio lesson/podcast script.
   */
  public generateAudioLesson(
    format: 'chapter_audio' | 'qa_lesson' | 'short_recap' | 'two_host_dialogue' = 'two_host_dialogue'
  ): StudyAudioLesson {
    if (!this.activeCollection) throw new Error('No active study collection');
    const chunks = this.cachedChunks.get(this.activeCollection.id) || [];

    const lesson = this.audioEngine.generateAudioLesson(this.activeCollection, chunks, format);
    const list = this.audioLessons.get(this.activeCollection.id) || [];
    list.push(lesson);
    this.audioLessons.set(this.activeCollection.id, list);

    return lesson;
  }

  /**
   * Returns current studio state.
   */
  public getStudioState(): StudyStudioState {
    const colId = this.activeCollection?.id || '';
    const notes = this.notes.get(colId) || [];
    const flashcards = this.flashcards.get(colId) || [];
    const quizzes = this.quizzes.get(colId) || [];
    const studyPlan = this.studyPlans.get(colId) || null;
    const socraticSessions = this.socraticSessions.get(colId) || [];
    const audioLessons = this.audioLessons.get(colId) || [];
    const attempts = this.quizAttempts.get(colId) || [];

    const masterySummary: Record<string, TopicMastery> = {};
    if (this.activeCollection) {
      masterySummary[this.activeCollection.subject] = this.masteryEngine.computeTopicMastery(
        this.activeCollection.subject,
        attempts,
        flashcards
      );
    }

    return {
      collection: this.activeCollection,
      notes,
      flashcards,
      quizzes,
      studyPlan,
      activeExam: this.activeExam,
      socraticSessions,
      audioLessons,
      masterySummary
    };
  }

  // Accessors
  public getCollectionModel(): StudyCollectionModel {
    return this.collectionModel;
  }
  public getIngestEngine(): StudySourceIngestEngine {
    return this.ingestEngine;
  }
  public getNotesEngine(): StructuredNotesEngine {
    return this.notesEngine;
  }
  public getFlashcardEngine(): FlashcardEngine {
    return this.flashcardEngine;
  }
  public getQuizEngine(): QuizEngine {
    return this.quizEngine;
  }
  public getExamEngine(): ExamSimulationEngine {
    return this.examEngine;
  }
  public getMasteryEngine(): MasteryModelEngine {
    return this.masteryEngine;
  }
  public getSocraticEngine(): SocraticDebateEngine {
    return this.socraticEngine;
  }
  public getAudioEngine(): StudyAudioLessonEngine {
    return this.audioEngine;
  }
  public getEducatorControls(): EducatorReviewControls {
    return this.educatorControls;
  }
}
