/**
 * Flashcard & Spaced Repetition Engine (PX15-T04)
 *
 * Generates flashcards with source grounding, deduplication scoring,
 * and implements transparent SuperMemo SM-2 spaced repetition scheduling.
 */

import * as crypto from 'crypto';
import { Flashcard, SourceChunk, SpacedRepetitionState, StudyCollection } from './StudyTypes';

export class FlashcardEngine {
  /**
   * Generates flashcards from source chunks.
   */
  public generateCardsFromChunks(collection: StudyCollection, chunks: SourceChunk[]): Flashcard[] {
    const cards: Flashcard[] = [];

    for (const chunk of chunks) {
      // Create QA flashcard from chunk content
      const sentences = chunk.text.split(/[.!?]+\s+/).filter((s) => s.trim().length > 15);
      if (sentences.length > 0) {
        const prompt = `What is the core principle of ${chunk.chapterTitle || collection.subject}?`;
        const answer = `${sentences[0].trim()} (${chunk.anchor.citationText})`;

        const initialRepetition: SpacedRepetitionState = {
          intervalDays: 1,
          easeFactor: 2.5,
          repetitionCount: 0,
          nextDueDate: new Date().toISOString(),
          history: []
        };

        cards.push({
          id: `card-${crypto.randomUUID()}`,
          collectionId: collection.id,
          frontPrompt: prompt,
          backAnswer: answer,
          sourceAnchors: [chunk.anchor],
          difficulty: 'medium',
          tags: [collection.subject, chunk.chapterTitle || 'General'],
          repetitionState: initialRepetition,
          isSuspended: false,
          reviewedByEducator: false,
          createdAt: new Date().toISOString(),
          isStale: false
        });
      }
    }

    return cards;
  }

  /**
   * Calculates similarity score (0.0 to 1.0) between two flashcard prompts to detect duplicates.
   */
  public calculateDuplicateScore(cardA: Flashcard, cardB: Flashcard): number {
    const wordsA = new Set(cardA.frontPrompt.toLowerCase().match(/\b\w+\b/g) || []);
    const wordsB = new Set(cardB.frontPrompt.toLowerCase().match(/\b\w+\b/g) || []);

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }

    const union = new Set([...wordsA, ...wordsB]).size;
    return intersection / union;
  }

  /**
   * Merges two duplicate cards into a consolidated card.
   */
  public mergeCards(primaryCard: Flashcard, duplicateCard: Flashcard): Flashcard {
    return {
      ...primaryCard,
      backAnswer: `${primaryCard.backAnswer}\n\n*Additional Context*: ${duplicateCard.backAnswer}`,
      sourceAnchors: [...primaryCard.sourceAnchors, ...duplicateCard.sourceAnchors],
      tags: Array.from(new Set([...primaryCard.tags, ...duplicateCard.tags]))
    };
  }

  /**
   * Implements SuperMemo SM-2 spaced repetition algorithm.
   * Rating scale:
   * 5: perfect response
   * 4: correct response after a hesitation
   * 3: correct response recalled with serious difficulty
   * 2: incorrect response; where the correct one seemed easy to recall
   * 1: incorrect response; the correct one remembered
   * 0: complete blackout
   */
  public reviewCard(card: Flashcard, rating: number): Flashcard {
    const validRating = Math.max(0, Math.min(5, Math.round(rating)));
    const state = { ...card.repetitionState };

    let { intervalDays, easeFactor, repetitionCount } = state;

    if (validRating >= 3) {
      // Correct response
      if (repetitionCount === 0) {
        intervalDays = 1;
      } else if (repetitionCount === 1) {
        intervalDays = 6;
      } else {
        intervalDays = Math.round(intervalDays * easeFactor);
      }
      repetitionCount++;
    } else {
      // Incorrect response: reset interval to 1 day
      repetitionCount = 0;
      intervalDays = 1;
    }

    // Update Ease Factor: EF' = EF + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
    easeFactor = easeFactor + (0.1 - (5 - validRating) * (0.08 + (5 - validRating) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    // Compute next due date
    const now = new Date();
    const nextDue = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    state.intervalDays = intervalDays;
    state.easeFactor = Math.round(easeFactor * 100) / 100;
    state.repetitionCount = repetitionCount;
    state.lastReviewedAt = now.toISOString();
    state.nextDueDate = nextDue.toISOString();
    state.history.push({
      reviewedAt: now.toISOString(),
      rating: validRating,
      intervalDays
    });

    return {
      ...card,
      repetitionState: state
    };
  }

  /**
   * Suspends or resumes a flashcard from review queue.
   */
  public toggleCardSuspension(card: Flashcard, suspend?: boolean): Flashcard {
    const isSuspended = suspend !== undefined ? suspend : !card.isSuspended;
    return { ...card, isSuspended };
  }
}
