import { CreativeQualityReviewer } from './CreativeQualityReviewer';

describe('CreativeQualityReviewer', () => {
  it('scores a draft across creative quality dimensions', () => {
    const reviewer = new CreativeQualityReviewer();

    const review = reviewer.review({
      draft: 'Mara gripped the cold brass rail. The lighthouse groaned. "It is calling again," she said, and the signal answered from under the ice.',
      genre: 'dark_horror',
      prompt: 'Draft an eerie lighthouse scene with Mara and the repeating signal.',
      storyBible: {
        characters: ['Mara'],
        locations: ['lighthouse'],
        continuityNotes: ['The signal repeats under the ice.'],
      },
    });

    expect(review.overallScore).toBeGreaterThanOrEqual(70);
    expect(review.scores).toEqual(expect.objectContaining({
      continuity: expect.any(Number),
      sensoryDetail: expect.any(Number),
      pacing: expect.any(Number),
      dialogueNaturalness: expect.any(Number),
      genreFit: expect.any(Number),
      originality: expect.any(Number),
      instructionAdherence: expect.any(Number),
    }));
    expect(review.strengths.length).toBeGreaterThan(0);
    expect(review.revisionPlan).toContain('Preserve');
  });

  it('flags missing continuity and sparse sensory detail', () => {
    const reviewer = new CreativeQualityReviewer();

    const review = reviewer.review({
      draft: 'Something happens. Then it continues.',
      genre: 'dark_horror',
      prompt: 'Draft a scene with Mara at the lighthouse.',
      storyBible: {
        characters: ['Mara'],
        locations: ['lighthouse'],
      },
    });

    expect(review.overallScore).toBeLessThan(70);
    expect(review.issues).toEqual(expect.arrayContaining([
      expect.stringContaining('continuity'),
      expect.stringContaining('sensory'),
    ]));
  });
});
