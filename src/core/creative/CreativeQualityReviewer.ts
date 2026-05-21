import type { StoryBibleContext } from './CreativeTypes';

export interface CreativeQualityReviewInput {
  draft: string;
  prompt: string;
  genre?: string;
  storyBible?: StoryBibleContext;
}

export interface CreativeQualityScores {
  continuity: number;
  sensoryDetail: number;
  pacing: number;
  dialogueNaturalness: number;
  genreFit: number;
  originality: number;
  instructionAdherence: number;
}

export interface CreativeQualityReview {
  overallScore: number;
  scores: CreativeQualityScores;
  strengths: string[];
  issues: string[];
  revisionPlan: string;
}

export class CreativeQualityReviewer {
  review(input: CreativeQualityReviewInput): CreativeQualityReview {
    const draft = input.draft || '';
    const lowerDraft = draft.toLowerCase();
    const promptTerms = significantTerms(input.prompt);
    const continuityTerms = [
      ...(input.storyBible?.characters || []),
      ...(input.storyBible?.locations || []),
      ...(input.storyBible?.continuityNotes || []),
    ].flatMap(significantTerms);

    const scores: CreativeQualityScores = {
      continuity: scoreTermCoverage(lowerDraft, continuityTerms, continuityTerms.length === 0 ? 80 : 45),
      sensoryDetail: scoreSensoryDetail(lowerDraft),
      pacing: scorePacing(draft),
      dialogueNaturalness: scoreDialogue(draft),
      genreFit: scoreGenreFit(lowerDraft, input.genre),
      originality: scoreOriginality(lowerDraft),
      instructionAdherence: scoreTermCoverage(lowerDraft, promptTerms, 50),
    };

    const overallScore = Math.round(Object.values(scores).reduce((sum, score) => sum + score, 0) / 7);
    const strengths = buildStrengths(scores);
    const issues = buildIssues(scores);
    const revisionPlan = [
      'Preserve established continuity and strongest images.',
      ...issues.map(issue => `Improve ${issue}.`),
      'Run one focused pass for voice, pacing, and instruction adherence.',
    ].join(' ');

    return {
      overallScore,
      scores,
      strengths,
      issues,
      revisionPlan,
    };
  }
}

function significantTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9'-]+/)
    .filter(term => term.length >= 4)
    .filter(term => !['with', 'that', 'this', 'from', 'scene', 'draft', 'again', 'under', 'through'].includes(term));
}

function scoreTermCoverage(draft: string, terms: string[], fallback: number): number {
  if (terms.length === 0) return fallback;
  const uniqueTerms = Array.from(new Set(terms));
  const hits = uniqueTerms.filter(term => draft.includes(term)).length;
  return clamp(35 + Math.round((hits / uniqueTerms.length) * 65));
}

function scoreSensoryDetail(draft: string): number {
  const sensoryWords = ['cold', 'warm', 'brass', 'ice', 'groan', 'sound', 'smell', 'light', 'shadow', 'blood', 'salt', 'dust', 'voice'];
  const hits = sensoryWords.filter(word => draft.includes(word)).length;
  return clamp(35 + hits * 12);
}

function scorePacing(draft: string): number {
  const sentences = draft.split(/[.!?]+/).map(sentence => sentence.trim()).filter(Boolean);
  if (sentences.length === 0) return 30;
  const averageLength = draft.split(/\s+/).filter(Boolean).length / sentences.length;
  if (averageLength >= 6 && averageLength <= 24) return 85;
  if (averageLength < 6) return 62;
  return 68;
}

function scoreDialogue(draft: string): number {
  const quoteCount = (draft.match(/"/g) || []).length;
  if (quoteCount >= 2) return 82;
  return 65;
}

function scoreGenreFit(draft: string, genre?: string): number {
  if (!genre) return 75;
  const genreTerms: Record<string, string[]> = {
    dark_horror: ['dark', 'dread', 'shadow', 'groan', 'ice', 'blood', 'signal', 'cold'],
    horror: ['dark', 'dread', 'shadow', 'groan', 'blood', 'door'],
    space_opera: ['orbital', 'station', 'fleet', 'faction', 'star', 'ship', 'market'],
    romance: ['heart', 'touch', 'voice', 'want', 'trust', 'kiss'],
    mystery: ['clue', 'drawer', 'secret', 'archive', 'suspect', 'locked'],
  };
  const terms = genreTerms[genre] || significantTerms(genre.replace(/_/g, ' '));
  return scoreTermCoverage(draft, terms, 70);
}

function scoreOriginality(draft: string): number {
  const genericPhrases = ['something happens', 'it continues', 'very interesting', 'suddenly everything'];
  const penalty = genericPhrases.filter(phrase => draft.includes(phrase)).length * 20;
  return clamp(82 - penalty);
}

function buildStrengths(scores: CreativeQualityScores): string[] {
  return Object.entries(scores)
    .filter(([, score]) => score >= 75)
    .map(([key]) => key);
}

function buildIssues(scores: CreativeQualityScores): string[] {
  return Object.entries(scores)
    .filter(([, score]) => score < 70)
    .map(([key]) => key.replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`));
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, score));
}
