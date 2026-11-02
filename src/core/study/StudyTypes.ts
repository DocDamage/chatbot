/**
 * Study Studio Types (PX-15)
 * Source-grounded study collections, notes, flashcards, quizzes, exams, mastery, and audio lessons.
 */

export type TargetLevel = 'beginner' | 'intermediate' | 'advanced' | 'mastery';

export type NoteType =
  | 'outline'
  | 'cornell'
  | 'key_concepts'
  | 'glossary'
  | 'formula_sheet'
  | 'timeline'
  | 'comparison_table'
  | 'chapter_summary';

export type QuestionType =
  | 'multiple_choice'
  | 'multi_select'
  | 'true_false'
  | 'short_answer'
  | 'matching'
  | 'code_problem';

export type DebatePracticeMode =
  | 'explain_back'
  | 'socratic_questioning'
  | 'debate_positions'
  | 'oral_answer'
  | 'misconception_review'
  | 'evidence_challenge';

export interface StudySourceAnchor {
  sourceId: string;
  sourceTitle: string;
  sectionTitle?: string;
  pageNumber?: number;
  startOffset?: number;
  endOffset?: number;
  citationText: string;
}

export interface StudySource {
  id: string;
  title: string;
  author?: string;
  content: string;
  format: 'markdown' | 'text' | 'pdf' | 'url';
  originalUrl?: string;
  sha256Digest: string;
  addedAt: string;
  updatedAt: string;
  byteSize: number;
  isStale?: boolean;
}

export interface StudyCollection {
  id: string;
  ownerId: string;
  title: string;
  subject: string;
  targetLevel: TargetLevel;
  learningGoals: string[];
  scheduleDeadline?: string;
  sources: StudySource[];
  createdAt: string;
  updatedAt: string;
  version: string;
}

export interface SourceChunk {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  chapterTitle?: string;
  text: string;
  startOffset: number;
  endOffset: number;
  anchor: StudySourceAnchor;
}

export interface StructuredNote {
  id: string;
  collectionId: string;
  title: string;
  noteType: NoteType;
  contentMarkdown: string;
  sourceAnchors: StudySourceAnchor[];
  coveragePercent: number;
  unsupportedClaimWarnings: string[];
  createdAt: string;
  isStale: boolean;
}

export interface SpacedRepetitionState {
  intervalDays: number;
  easeFactor: number; // default 2.5
  repetitionCount: number;
  lastReviewedAt?: string;
  nextDueDate: string;
  history: Array<{
    reviewedAt: string;
    rating: number; // 0-5
    intervalDays: number;
  }>;
}

export interface Flashcard {
  id: string;
  collectionId: string;
  frontPrompt: string;
  backAnswer: string;
  sourceAnchors: StudySourceAnchor[];
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  repetitionState: SpacedRepetitionState;
  isSuspended: boolean;
  reviewedByEducator: boolean;
  createdAt: string;
  isStale: boolean;
}

export interface QuizDistractor {
  text: string;
  rationale: string;
}

export interface MatchingPair {
  id: string;
  leftPrompt: string;
  rightMatch: string;
}

export interface QuizQuestion {
  id: string;
  collectionId: string;
  questionType: QuestionType;
  prompt: string;
  options?: string[]; // for multiple_choice & multi_select
  correctAnswer: string | string[]; // string or array for multi_select
  distractors?: QuizDistractor[];
  matchingPairs?: MatchingPair[];
  hints: string[];
  explanation: string;
  sourceAnchors: StudySourceAnchor[];
  points: number;
  rubricCriteria?: string[];
  topic: string;
  isStale: boolean;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  startedAt: string;
  submittedAt: string;
  userAnswers: Record<string, string | string[]>;
  score: number;
  totalPoints: number;
  percentage: number;
  itemResults: Array<{
    questionId: string;
    correct: boolean;
    pointsAwarded: number;
    feedback: string;
  }>;
}

export interface ExamBlueprint {
  title: string;
  timeLimitMinutes: number;
  topics: Array<{ topic: string; weight: number }>;
  questions: QuizQuestion[];
  allowPause: boolean;
  accommodationsMultiplier?: number;
}

export interface ActiveExamSession {
  sessionId: string;
  blueprintTitle: string;
  startedAt: string;
  timeLimitMinutes: number;
  remainingSeconds: number;
  isPaused: boolean;
  answers: Record<string, string | string[]>;
  questionsCount: number;
  isSubmitted: boolean;
}

export interface ExamResult {
  sessionId: string;
  submittedAt: string;
  score: number;
  totalPoints: number;
  percentage: number;
  topicBreakdown: Record<string, { earned: number; total: number; percentage: number }>;
  sourceBackedReview: Array<{
    questionId: string;
    prompt: string;
    userAnswer: string | string[];
    correctAnswer: string | string[];
    explanation: string;
    anchors: StudySourceAnchor[];
  }>;
  disclaimerNotice: string;
}

export interface TopicMastery {
  topic: string;
  masteryScore: number; // 0 - 100
  level: TargetLevel;
  quizSuccessRate: number;
  flashcardRecallRate: number;
  lastAssessedAt: string;
}

export interface StudyPlanActivity {
  id: string;
  dayNumber: number;
  title: string;
  activityType: 'read' | 'notes' | 'flashcards' | 'quiz' | 'exam_sim' | 'debate';
  targetTopic: string;
  estimatedMinutes: number;
  completed: boolean;
}

export interface StudyPlan {
  id: string;
  collectionId: string;
  goal: string;
  deadline?: string;
  dailyMinutesBudget: number;
  activities: StudyPlanActivity[];
  masteryStatus: Record<string, TopicMastery>;
  disclaimer: string;
}

export interface SocraticTurn {
  turnId: string;
  role: 'tutor' | 'student';
  content: string;
  sourceCitations?: StudySourceAnchor[];
  identifiedMisconceptions?: string[];
  feedback?: string;
  timestamp: string;
}

export interface SocraticSession {
  sessionId: string;
  collectionId: string;
  mode: DebatePracticeMode;
  topic: string;
  turns: SocraticTurn[];
  summaryFeedback?: string;
  isCompleted: boolean;
}

export interface PodcastCuePoint {
  timeSec: number;
  speaker: string;
  text: string;
  topic: string;
}

export interface StudyAudioLesson {
  id: string;
  collectionId: string;
  title: string;
  format: 'chapter_audio' | 'qa_lesson' | 'short_recap' | 'two_host_dialogue';
  speakers: string[];
  scriptDialogue: Array<{ speaker: string; text: string }>;
  fullTranscript: string;
  cuePoints: PodcastCuePoint[];
  durationSec: number;
  audioArtifactUrl?: string;
  sourceNotes: string;
}

export interface EducatorReviewAction {
  itemId: string;
  itemType: 'note' | 'flashcard' | 'quiz_question';
  action: 'approved' | 'rejected' | 'modified';
  educatorId: string;
  timestamp: string;
  notes?: string;
}

export interface StudyStudioState {
  collection: StudyCollection | null;
  notes: StructuredNote[];
  flashcards: Flashcard[];
  quizzes: QuizQuestion[];
  studyPlan: StudyPlan | null;
  activeExam: ActiveExamSession | null;
  socraticSessions: SocraticSession[];
  audioLessons: StudyAudioLesson[];
  masterySummary: Record<string, TopicMastery>;
}
