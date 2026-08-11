import { DocumentReviewService } from './DocumentReviewService';

describe('DocumentReviewService', () => {
  it('requires the reviewed content to match before saving', () => {
    const service = new DocumentReviewService();
    const review = service.review('Notes', '# Notes\n\nKeep this stable.');
    expect(service.verify(review.token, 'Notes', '# Notes\n\nKeep this stable.')).toEqual(review);
    expect(() => service.verify(review.token, 'Notes', '# Notes\n\nChanged.')).toThrow('document changed');
  });

  it('provides deterministic writing transforms', () => {
    const service = new DocumentReviewService();
    expect(service.transform('bullet-list', 'One\nTwo').content).toBe('- One\n- Two');
    expect(service.transform('professional', "I can't do that").content).toBe('I cannot do that');
  });
});
