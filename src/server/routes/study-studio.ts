import { Request, Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { DebatePracticeMode, NoteType, StudyStudioService, TargetLevel } from '../../core/study';
import { AppError } from '../../utils/errors';

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
type StudySourceFormat = 'markdown' | 'text' | 'pdf' | 'url';
type AudioLessonFormat = 'chapter_audio' | 'qa_lesson' | 'short_recap' | 'two_host_dialogue';

function boundedText(value: unknown, fallback: string, maxLength = 300): string {
  return (sanitizeInput(String(value ?? fallback)).trim() || fallback).slice(0, maxLength);
}

export function createStudyStudioRouter(): Router {
  const router = Router();
  const studios = new Map<string, StudyStudioService>();
  const getStudio = (userId: string) => {
    let studio = studios.get(userId);
    if (!studio) {
      studio = new StudyStudioService();
      studios.set(userId, studio);
    }
    return studio;
  };
  const studioFor = (req: Request) => getStudio(req.user?.userId || 'local-operator');
  const activeStudioFor = (req: Request) => {
    const studio = studioFor(req);
    if (!studio.getActiveCollection()) throw new AppError('No active Study Studio collection.', 409, 'NO_ACTIVE_COLLECTION');
    return studio;
  };

  router.get('/api/study-studio/state', asyncHandler(async (req, res) => {
    res.json(studioFor(req).getStudioState());
  }));

  router.post('/api/study-studio/collections', asyncHandler(async (req, res) => {
    const title = boundedText(req.body.title, '');
    const subject = boundedText(req.body.subject, '');
    if (!title || !subject) return res.status(400).json({ error: 'title and subject are required' });
    const allowedLevels = new Set<TargetLevel>(['beginner', 'intermediate', 'advanced', 'mastery']);
    const requestedLevel = boundedText(req.body.targetLevel, 'intermediate', 30);
    if (!allowedLevels.has(requestedLevel as TargetLevel)) return res.status(400).json({ error: `Unsupported target level '${requestedLevel}'.` });
    const collection = studioFor(req).createStudyCollection({
      ownerId: req.user?.userId || 'local-operator',
      title,
      subject,
      targetLevel: requestedLevel as TargetLevel,
      learningGoals: Array.isArray(req.body.learningGoals)
        ? req.body.learningGoals.slice(0, 50).map((goal: unknown) => boundedText(goal, '', 500)).filter(Boolean)
        : []
    });
    res.status(201).json({ collection });
  }));

  router.post('/api/study-studio/sources', asyncHandler(async (req, res) => {
    const content = typeof req.body.content === 'string' ? req.body.content : '';
    if (!content.trim()) return res.status(400).json({ error: 'content is required' });
    if (Buffer.byteLength(content, 'utf8') > MAX_SOURCE_BYTES) {
      return res.status(413).json({ error: 'content exceeds the 2 MB study-source limit' });
    }
    const allowedFormats = new Set<StudySourceFormat>(['markdown', 'text', 'pdf', 'url']);
    const format = boundedText(req.body.format, 'markdown', 20);
    if (!allowedFormats.has(format as StudySourceFormat)) return res.status(400).json({ error: `Unsupported source format '${format}'.` });
    const result = activeStudioFor(req).addSourceDocument({
      title: boundedText(req.body.title, 'Study source'),
      content,
      format: format as StudySourceFormat,
      author: req.body.author ? boundedText(req.body.author, '', 200) : undefined
    });
    res.status(201).json(result);
  }));

  router.post('/api/study-studio/notes', asyncHandler(async (req, res) => {
    const allowedTypes = new Set<NoteType>([
      'outline', 'cornell', 'key_concepts', 'glossary', 'formula_sheet',
      'timeline', 'comparison_table', 'chapter_summary'
    ]);
    const noteType = boundedText(req.body.noteType, 'outline', 40);
    if (!allowedTypes.has(noteType as NoteType)) return res.status(400).json({ error: `Unsupported note type '${noteType}'.` });
    const note = activeStudioFor(req).generateNote(noteType as NoteType, req.body.title ? boundedText(req.body.title, '', 300) : undefined);
    res.status(201).json({ note });
  }));

  router.post('/api/study-studio/flashcards/generate', asyncHandler(async (req, res) => {
    res.status(201).json({ flashcards: activeStudioFor(req).generateFlashcards() });
  }));

  router.post('/api/study-studio/quizzes/generate', asyncHandler(async (req, res) => {
    res.status(201).json({ questions: activeStudioFor(req).generateQuizQuestions() });
  }));

  router.post('/api/study-studio/quizzes/submit', asyncHandler(async (req, res) => {
    if (!req.body.answers || typeof req.body.answers !== 'object' || Array.isArray(req.body.answers)) {
      return res.status(400).json({ error: 'answers object is required' });
    }
    res.json({ attempt: activeStudioFor(req).submitQuizAttempt(req.body.answers) });
  }));

  router.post('/api/study-studio/plan', asyncHandler(async (req, res) => {
    const dailyMinutes = Math.max(5, Math.min(480, Number(req.body.dailyMinutes || 45)));
    res.status(201).json({ plan: activeStudioFor(req).generateStudyPlan(dailyMinutes) });
  }));

  router.post('/api/study-studio/socratic', asyncHandler(async (req, res) => {
    const allowedModes = new Set<DebatePracticeMode>([
      'explain_back', 'socratic_questioning', 'debate_positions',
      'oral_answer', 'misconception_review', 'evidence_challenge'
    ]);
    const mode = boundedText(req.body.mode, 'socratic_questioning', 40);
    if (!allowedModes.has(mode as DebatePracticeMode)) return res.status(400).json({ error: `Unsupported practice mode '${mode}'.` });
    const topic = boundedText(req.body.topic, '');
    if (!topic) return res.status(400).json({ error: 'topic is required' });
    res.status(201).json({ session: activeStudioFor(req).startSocraticSession(mode as DebatePracticeMode, topic) });
  }));

  router.post('/api/study-studio/socratic/:sessionId/turns', asyncHandler(async (req, res) => {
    const text = boundedText(req.body.text, '', 5000);
    if (!text) return res.status(400).json({ error: 'text is required' });
    res.json({ session: activeStudioFor(req).submitSocraticTurn(req.params.sessionId, text) });
  }));

  router.post('/api/study-studio/audio-lessons', asyncHandler(async (req, res) => {
    const allowedFormats = new Set<AudioLessonFormat>(['chapter_audio', 'qa_lesson', 'short_recap', 'two_host_dialogue']);
    const format = boundedText(req.body.format, 'two_host_dialogue', 40);
    if (!allowedFormats.has(format as AudioLessonFormat)) return res.status(400).json({ error: `Unsupported audio lesson format '${format}'.` });
    res.status(201).json({ lesson: activeStudioFor(req).generateAudioLesson(format as AudioLessonFormat) });
  }));

  return router;
}
