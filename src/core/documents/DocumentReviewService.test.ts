import { DocumentReviewService } from './DocumentReviewService';

describe('DocumentReviewService', () => {
  it('requires the reviewed content to match before saving and supports token consumption', () => {
    const service = new DocumentReviewService();
    const review = service.review('Notes', '# Notes\n\nKeep this stable.');
    expect(service.verify(review.token, 'Notes', '# Notes\n\nKeep this stable.')).toEqual(review);
    expect(() => service.verify(review.token, 'Notes', '# Notes\n\nChanged.')).toThrow('document changed');
    expect(() => service.verify(review.token, 'Other Title', '# Notes\n\nKeep this stable.')).toThrow('document changed');

    service.consume(review.token);
    expect(() => service.verify(review.token, 'Notes', '# Notes\n\nKeep this stable.')).toThrow('review token is missing or expired');

    // Empty content error
    expect(() => service.review('Title', '   ')).toThrow('content is required');

    // Untitled default
    const untitled = service.review('   ', '# Header\nContent');
    expect(untitled.title).toBe('Untitled document');
  });

  it('provides deterministic writing transforms and validates inputs', () => {
    const service = new DocumentReviewService();
    expect(service.transform('concise', 'This  is    a   sentence   .').content).toBe('This is a sentence.');
    expect(service.transform('bullet-list', 'One\n- Two\nThree').content).toBe('- One\n- Two\n- Three');
    expect(service.transform('professional', "I can't, won't, and don't agree").content).toBe('I cannot, will not, and do not agree');

    expect(() => service.transform('concise', '   ')).toThrow('content is required');
    expect(() => service.transform('unknown-transform', 'text')).toThrow('unsupported transform: unknown-transform');
  });

  it('detects structural findings including long lines, TODOs, missing headings, and gaps', () => {
    const service = new DocumentReviewService();
    const longLine = 'A'.repeat(190);
    const contentWithIssues = `Some text without heading\nTODO: complete section\n\n\n\n${longLine}`;

    const review = service.review('Draft', contentWithIssues);
    expect(review.findings.some(f => f.id.startsWith('long-'))).toBe(true);
    expect(review.findings.some(f => f.id.startsWith('todo-'))).toBe(true);
    expect(review.findings.some(f => f.id === 'title')).toBe(true);
    expect(review.findings.some(f => f.id === 'spacing')).toBe(true);
  });
});
