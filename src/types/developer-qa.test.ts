/**
 * Developer Q&A Types Test (CRK Phase 13)
 */
import { QAPair, QAChunk, QAQualityFilterConfig } from './developer-qa';

describe('Developer Q&A Types', () => {
  it('should validate QAPair structure', () => {
    const qa: QAPair = {
      id: 'qa-1',
      site: 'stackoverflow',
      externalId: '12345',
      questionTitle: 'How to sort array in TypeScript?',
      questionBody: 'I want to sort an array of objects by a property in TypeScript.',
      tags: ['typescript', 'sorting', 'javascript'],
      questionScore: 12,
      answerId: 'ans-1',
      answerBody: 'Use the Array.prototype.sort method with a comparator function.',
      answerScore: 18,
      isAccepted: true,
      author: 'devUser',
      creationDate: '2025-01-01T00:00:00Z',
      lastActivityDate: '2025-06-01T00:00:00Z',
      sourceUrl: 'https://stackoverflow.com/q/12345',
      license: 'CC BY-SA 4.0',
    };

    expect(qa.id).toBe('qa-1');
    expect(qa.isAccepted).toBe(true);
    expect(qa.license).toContain('CC BY-SA');
  });

  it('should validate QAChunk and filter config', () => {
    const config: QAQualityFilterConfig = {
      minQuestionScore: 5,
      minAnswerScore: 3,
      requireAcceptedOrScore: true,
      minBodyLength: 50,
      rejectLinkOnly: true,
      rejectSpamPatterns: true,
    };

    const chunk: QAChunk = {
      chunkId: 'chunk-1',
      questionId: 'qa-1',
      answerId: 'ans-1',
      title: 'How to sort array in TypeScript?',
      content: 'Question: How to sort array in TypeScript?\nAnswer: Use sort method.',
      tags: ['typescript'],
      products: [{ product: 'typescript', version: '5.0', confidence: 0.9 }],
      license: 'CC BY-SA 4.0',
      attribution: 'Answer by devUser on Stack Overflow (CC BY-SA 4.0)',
      sourceUrl: 'https://stackoverflow.com/q/12345',
      authority: 0.85,
      freshnessDate: '2025-06-01T00:00:00Z',
    };

    expect(config.minQuestionScore).toBe(5);
    expect(chunk.authority).toBe(0.85);
  });
});
