import { StudyStudioService } from '../StudyStudioService';

describe('B75-08: StudyStudioService Deep Coverage Matrix', () => {
  let service: StudyStudioService;

  beforeEach(() => {
    service = new StudyStudioService();
  });

  it('orchestrates complete study workflows: source ingestion, notes, flashcards, quizzes, exams, and audio lessons', async () => {
    // 1. Create collection
    const collection = service.createStudyCollection({
      ownerId: 'student_1',
      title: 'Operating Systems',
      subject: 'Computer Science',
      targetLevel: 'beginner',
      learningGoals: ['Virtual memory', 'Concurrency', 'File systems']
    });
    expect(collection.id).toBeDefined();
    expect(service.getActiveCollection()?.id).toBe(collection.id);

    // 2. Ingest source
    const rawText = `Virtual memory gives each process a large, contiguous address space.
Page tables translate virtual addresses to physical addresses using MMU hardware.
TLB caches recent translations for fast lookups.`;

    const { source, chunks } = service.addSourceDocument({
      title: 'OS Virtual Memory Chapter',
      content: rawText,
      format: 'text'
    });
    expect(source.id).toBeDefined();
    expect(chunks.length).toBeGreaterThan(0);

    // 3. Generate structured notes
    const note = service.generateNote('chapter_summary');
    expect(note.contentMarkdown).toBeDefined();

    // 4. Generate flashcards and review
    const flashcards = service.generateFlashcards();
    expect(flashcards.length).toBeGreaterThan(0);

    const reviewed = service.reviewFlashcard(flashcards[0].id, 4);
    expect(reviewed.repetitionState.repetitionCount).toBeGreaterThan(0);

    // 5. Generate quiz and submit attempt
    const questions = service.generateQuizQuestions();
    expect(questions.length).toBeGreaterThan(0);

    const answers: Record<string, string> = {};
    for (const q of questions) {
      answers[q.id] = Array.isArray(q.correctAnswer) ? q.correctAnswer[0] : q.correctAnswer;
    }
    const attempt = service.submitQuizAttempt(answers);
    expect(attempt.percentage).toBeDefined();

    // 6. Socratic debate session
    const socratic = service.startSocraticSession('debate_positions', 'Paging vs Segmentation');
    expect(socratic.sessionId).toBeDefined();

    const turn = service.submitSocraticTurn(socratic.sessionId, 'Explain how multi-level page tables save memory.');
    expect(turn.turns.length).toBeGreaterThan(1);

    // 7. Study plan
    const plan = service.generateStudyPlan(30);
    expect(plan.activities.length).toBeGreaterThan(0);

    // 8. Audio lesson
    const audioLesson = service.generateAudioLesson('two_host_dialogue');
    expect(audioLesson.scriptDialogue.length).toBeGreaterThan(0);

    // 9. Exam simulation
    const exam = service.startExamSimulation({
      title: 'Midterm Exam',
      timeLimitMinutes: 30,
      topics: [{ topic: 'Computer Science', weight: 1.0 }],
      questions,
      allowPause: true
    });
    expect(exam.sessionId).toBeDefined();

    const examResult = service.submitExamSimulation(exam.sessionId);
    expect(examResult.percentage).toBeDefined();

    // 10. Studio state and engine accessors
    const snapshot = service.getStudioState();
    expect(snapshot.collection?.id).toBe(collection.id);
    expect(snapshot.notes.length).toBe(1);
    expect(snapshot.flashcards.length).toBeGreaterThan(0);

    expect(service.getCollectionModel()).toBeDefined();
    expect(service.getIngestEngine()).toBeDefined();
    expect(service.getNotesEngine()).toBeDefined();
    expect(service.getFlashcardEngine()).toBeDefined();
    expect(service.getQuizEngine()).toBeDefined();
    expect(service.getExamEngine()).toBeDefined();
    expect(service.getMasteryEngine()).toBeDefined();
    expect(service.getSocraticEngine()).toBeDefined();
    expect(service.getAudioEngine()).toBeDefined();
    expect(service.getEducatorControls()).toBeDefined();
  });
});
