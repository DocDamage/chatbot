/**
 * Developer Q&A Evaluation Suite (CRK Phase 13: CRK-P13-T08 & Phase 13 Exit Gate)
 */

import { QAPair } from '../../../types/developer-qa';
import { DeveloperQAPack } from '../DeveloperQAPack';
import { DeveloperQAQualityFilter } from '../DeveloperQAQualityFilter';
import { DeveloperQAVersionExtractor } from '../DeveloperQAVersionExtractor';
import { DeveloperQARefreshService } from '../DeveloperQARefreshService';

describe('Developer Q&A Evaluation & Phase 13 Exit Gate', () => {
  let pack: DeveloperQAPack;
  let filter: DeveloperQAQualityFilter;
  let extractor: DeveloperQAVersionExtractor;
  let refreshService: DeveloperQARefreshService;

  beforeEach(() => {
    filter = new DeveloperQAQualityFilter();
    extractor = new DeveloperQAVersionExtractor();
    pack = new DeveloperQAPack(filter, extractor);
    refreshService = new DeveloperQARefreshService(pack);
  });

  it('Exit Gate Criterion 1: Low-quality content, spam, chatter, and link-only answers are filtered', () => {
    const spamPair: QAPair = {
      id: 'spam-1',
      site: 'stackoverflow',
      externalId: '9001',
      questionTitle: 'Cheap essay writing service online whatsapp me',
      questionBody: 'Visit our site to get high scores guaranteed.',
      tags: ['homework'],
      questionScore: -2,
      answerId: 'a-9001',
      answerBody: 'Contact us on whatsapp for casino crypto pump!',
      answerScore: -1,
      isAccepted: false,
      author: 'spammer',
      creationDate: '2025-01-01T00:00:00Z',
      lastActivityDate: '2025-01-01T00:00:00Z',
      sourceUrl: 'https://stackoverflow.com/q/9001',
      license: 'CC BY-SA 4.0',
    };

    const linkOnlyPair: QAPair = {
      id: 'link-1',
      site: 'stackoverflow',
      externalId: '9002',
      questionTitle: 'How to do X in Python?',
      questionBody: 'How do I do X?',
      tags: ['python'],
      questionScore: 1,
      answerId: 'a-9002',
      answerBody: 'Check this link: https://example.com/how-to-do-x',
      answerScore: 1,
      isAccepted: false,
      author: 'lazyUser',
      creationDate: '2025-01-01T00:00:00Z',
      lastActivityDate: '2025-01-01T00:00:00Z',
      sourceUrl: 'https://stackoverflow.com/q/9002',
      license: 'CC BY-SA 4.0',
    };

    const chatterPair: QAPair = {
      id: 'chatter-1',
      site: 'stackoverflow',
      externalId: '9003',
      questionTitle: 'Error with npm install',
      questionBody: 'npm install fails',
      tags: ['npm'],
      questionScore: 1,
      answerId: 'a-9003',
      answerBody: 'same here, did you solve this?',
      answerScore: 0,
      isAccepted: false,
      author: 'meTooUser',
      creationDate: '2025-01-01T00:00:00Z',
      lastActivityDate: '2025-01-01T00:00:00Z',
      sourceUrl: 'https://stackoverflow.com/q/9003',
      license: 'CC BY-SA 4.0',
    };

    expect(pack.indexQAPair(spamPair)).toBeNull();
    expect(pack.indexQAPair(linkOnlyPair)).toBeNull();
    expect(pack.indexQAPair(chatterPair)).toBeNull();
  });

  it('Exit Gate Criterion 2: Error-message and compiler-error lookup succeeds with high accuracy', () => {
    const errorQAPair: QAPair = {
      id: 'err-1',
      site: 'stackoverflow',
      externalId: '54321',
      questionTitle: "TypeError: Cannot read properties of undefined (reading 'map')",
      questionBody: 'I am getting Cannot read properties of undefined when rendering my list.',
      tags: ['javascript', 'reactjs', 'arrays'],
      questionScore: 45,
      answerId: 'a-54321',
      answerBody:
        'This happens when the array you are mapping over is undefined or not yet loaded from the async API. Use optional chaining `items?.map(...)` or provide a default fallback `(items || []).map(...)`.',
      answerScore: 82,
      isAccepted: true,
      author: 'jsGuru',
      creationDate: '2024-02-10T00:00:00Z',
      lastActivityDate: '2025-01-15T00:00:00Z',
      sourceUrl: 'https://stackoverflow.com/q/54321',
      license: 'CC BY-SA 4.0',
    };

    const chunk = pack.indexQAPair(errorQAPair);
    expect(chunk).not.toBeNull();
    expect(chunk?.authority).toBeGreaterThanOrEqual(0.85);

    const searchResults = pack.search("TypeError: Cannot read properties of undefined reading 'map'");
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].chunkId).toBe('qa-stackoverflow-54321-a-54321');
    expect(searchResults[0].content).toContain('optional chaining');
  });

  it('Exit Gate Criterion 3: Attribution and provenance are preserved completely', () => {
    const validPair: QAPair = {
      id: 'qa-valid-1',
      site: 'stackoverflow',
      externalId: '65432',
      questionTitle: 'How to implement a custom hook in React 18?',
      questionBody: 'What is the idiomatic pattern for useDebounce in React 18?',
      tags: ['react-18', 'typescript'],
      questionScore: 18,
      answerId: 'a-65432',
      answerBody:
        'In React 18, create a custom hook using useEffect and useState with proper cleanup timer return:\n```ts\nexport function useDebounce<T>(value: T, delay = 300): T { ... }\n```',
      answerScore: 24,
      isAccepted: true,
      author: 'reactPro',
      creationDate: '2024-05-01T00:00:00Z',
      lastActivityDate: '2025-02-01T00:00:00Z',
      sourceUrl: 'https://stackoverflow.com/q/65432',
      license: 'CC BY-SA 4.0',
    };

    const chunk = pack.indexQAPair(validPair);
    expect(chunk).not.toBeNull();
    expect(chunk?.attribution).toContain('reactPro');
    expect(chunk?.attribution).toContain('CC BY-SA 4.0');
    expect(chunk?.attribution).toContain('https://stackoverflow.com/q/65432');
    expect(chunk?.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ product: 'react', version: '18' }),
      ])
    );
  });

  it('Exit Gate Criterion 4: Incremental refresh re-indexes modified Q&A and skips unchanged entries', () => {
    const initialBatch: QAPair[] = [
      {
        id: 'inc-1',
        site: 'stackoverflow',
        externalId: '1001',
        questionTitle: 'Python dictionary merge syntax',
        questionBody: 'How to merge two dictionaries in Python 3.9+?',
        tags: ['python-3.9', 'dictionary'],
        questionScore: 30,
        answerId: 'a-1001',
        answerBody: 'Use the pipe operator: `z = x | y` introduced in Python 3.9.',
        answerScore: 45,
        isAccepted: true,
        author: 'pyWizard',
        creationDate: '2023-01-01T00:00:00Z',
        lastActivityDate: '2023-01-01T00:00:00Z',
        sourceUrl: 'https://stackoverflow.com/q/1001',
        license: 'CC BY-SA 4.0',
      },
    ];

    const result1 = refreshService.processBatch(initialBatch);
    expect(result1.indexedCount).toBe(1);
    expect(result1.skippedCount).toBe(0);

    // Second run with identical data -> skipped
    const result2 = refreshService.processBatch(initialBatch);
    expect(result2.indexedCount).toBe(0);
    expect(result2.skippedCount).toBe(1);

    // Modified answer score/body -> updated
    const modifiedBatch: QAPair[] = [
      {
        ...initialBatch[0],
        answerBody: 'Use the pipe operator: `z = x | y` introduced in Python 3.9. For in-place update use `x |= y`.',
        answerScore: 50,
      },
    ];

    const result3 = refreshService.processBatch(modifiedBatch);
    expect(result3.updatedCount).toBe(1);
    expect(result3.skippedCount).toBe(0);
  });
});
