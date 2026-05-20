export interface ReviewCardState {
  easeFactor: number;
  repetitions: number;
  intervalDays: number;
  lastReviewed?: Date;
  nextReview?: Date;
}

export class SpacedRepetitionService {
  review(card: ReviewCardState, quality: number, reviewedAt = new Date()): ReviewCardState {
    const boundedQuality = Math.max(0, Math.min(5, quality));
    let easeFactor = card.easeFactor || 2.5;
    let repetitions = card.repetitions || 0;
    let intervalDays = card.intervalDays || 0;

    if (boundedQuality < 3) {
      repetitions = 0;
      intervalDays = 1;
    } else {
      repetitions += 1;
      if (repetitions === 1) intervalDays = 1;
      else if (repetitions === 2) intervalDays = 6;
      else intervalDays = Math.round(intervalDays * easeFactor);
      easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - boundedQuality) * (0.08 + (5 - boundedQuality) * 0.02)));
    }

    const nextReview = new Date(reviewedAt);
    nextReview.setDate(nextReview.getDate() + intervalDays);

    return {
      easeFactor,
      repetitions,
      intervalDays,
      lastReviewed: reviewedAt,
      nextReview
    };
  }
}
