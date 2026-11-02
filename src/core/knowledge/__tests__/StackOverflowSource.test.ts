import axios from 'axios';
import { StackOverflowSource } from '../StackOverflowSource';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('StackOverflowSource', () => {
  let source: StackOverflowSource;

  beforeEach(() => {
    jest.clearAllMocks();
    source = new StackOverflowSource('test-api-key');
  });

  it('checks availability correctly', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { items: [] } } as any);
    const available = await source.isAvailable();
    expect(available).toBe(true);

    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
    const unavailable = await source.isAvailable();
    expect(unavailable).toBe(false);
  });

  it('searches StackOverflow with filters, tags, and accepted answers', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              question_id: 12345,
              title: 'How to sort array in TypeScript?',
              body: '<p>How do I &quot;sort&quot; an &lt;array&gt; in <b>TypeScript</b>?&nbsp;&amp;&nbsp;more</p>',
              link: 'https://stackoverflow.com/q/12345',
              tags: ['typescript', 'arrays'],
              score: 15,
              view_count: 5000,
              answer_count: 3,
              is_answered: true,
              accepted_answer_id: 67890,
              creation_date: 1672531199,
            },
            {
              question_id: 12346,
              title: 'Low score unanswered question',
              body: '<p>Help please</p>',
              link: 'https://stackoverflow.com/q/12346',
              tags: [],
              score: 5,
              view_count: 50,
              answer_count: 0,
              is_answered: false,
              creation_date: 1672531199,
            },
            {
              question_id: 12347,
              title: 'Zero score question',
              body: '<p>Zero score</p>',
              link: 'https://stackoverflow.com/q/12347',
              score: 0,
              view_count: 10,
              answer_count: 0,
              is_answered: false,
              creation_date: 1672531199,
            }
          ]
        }
      } as any)
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              answer_id: 67890,
              body: '<p>Use <code>arr.sort()</code></p>'
            }
          ]
        }
      } as any);

    const results = await source.search('sort array', { limit: 5, tagged: ['typescript'], sort: 'votes' });

    expect(results).toHaveLength(3);
    expect(results[0].id).toBe('stackoverflow_12345');
    expect(results[0].content).toContain('Use arr.sort()');
    expect(results[0].confidence).toBeCloseTo(1.0, 5); // 0.5 + 0.2 (score>10) + 0.2 (is_answered) + 0.1 (view>1000) = 1.0
    expect(results[1].confidence).toBeCloseTo(0.6, 5); // 0.5 + 0.1 (score>0) = 0.6
    expect(results[2].confidence).toBeCloseTo(0.5, 5);
  });

  it('handles search errors gracefully and answer fetch failures', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              question_id: 999,
              title: 'Error Answer Question',
              accepted_answer_id: 888,
              creation_date: 1672531199,
              score: 0
            }
          ]
        }
      } as any)
      .mockRejectedValueOnce(new Error('Answer API failure'));

    const results = await source.search('error answer');
    expect(results).toHaveLength(1);

    mockedAxios.get.mockRejectedValueOnce(new Error('Search API down'));
    const failedResults = await source.search('down');
    expect(failedResults).toEqual([]);
  });

  it('fetches by ID including accepted answer and error handling', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              question_id: 111,
              title: 'Question title',
              body: '<p>Question body</p>',
              link: 'https://stackoverflow.com/q/111',
              accepted_answer_id: 222,
              score: 12,
              view_count: 2000
            }
          ]
        }
      } as any)
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              body: '<p>Accepted answer body</p>'
            }
          ]
        }
      } as any);

    const item = await source.getById('stackoverflow_111');
    expect(item).not.toBeNull();
    expect(item?.title).toBe('Question title');
    expect(item?.content).toContain('Accepted Answer:\nAccepted answer body');

    // Not found
    mockedAxios.get.mockResolvedValueOnce({ data: { items: [] } } as any);
    const notFound = await source.getById('stackoverflow_none');
    expect(notFound).toBeNull();

    // Exception
    mockedAxios.get.mockRejectedValueOnce(new Error('Network drop'));
    const errorItem = await source.getById('stackoverflow_err');
    expect(errorItem).toBeNull();
  });
});
