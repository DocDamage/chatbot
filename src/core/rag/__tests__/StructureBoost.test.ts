import { RetrievalResult } from '../../../types/rag';
import { applyStructureBoost, BREADCRUMB_BOOST_MAX, CODE_BOOST, isCodingQuery, structureBoost } from '../StructureBoost';
import { LocalKnowledgeAnswerer } from '../../knowledge/LocalKnowledgeAnswerer';

const result = (id: string, score: number, metadata: Record<string, any> = {}): RetrievalResult => ({
  chunk: { id, content: id, metadata },
  score,
  retrievalMethod: 'bm25'
});

describe('structureBoost', () => {
  it('is exactly zero for chunks without structure metadata', () => {
    expect(structureBoost('how do I install it', { source: 'a.md' })).toBe(0);
    expect(structureBoost('install', { breadcrumbs: [], hasCode: false })).toBe(0);
    expect(structureBoost('install', { breadcrumbs: 'not an array' })).toBe(0);
  });

  it('scales the breadcrumb boost with the share of query terms found in the chapter/section path', () => {
    const metadata = { breadcrumbs: ['Chapter 1 Partition Basics', 'Using the Command Line'] };
    expect(structureBoost('command line usage', metadata)).toBeCloseTo(BREADCRUMB_BOOST_MAX * (2 / 3), 5);
    expect(structureBoost('command line', metadata)).toBeCloseTo(BREADCRUMB_BOOST_MAX, 5);
    expect(structureBoost('weather forecast', metadata)).toBe(0);
    expect(structureBoost('the and for', metadata)).toBe(0); // stopwords carry no signal
    expect(structureBoost('command', { breadcrumbs: [42, 'Command Reference'] })).toBeCloseTo(BREADCRUMB_BOOST_MAX, 5);
  });

  it('boosts code chunks only for coding-style queries', () => {
    expect(structureBoost('how do I run the command', { hasCode: true })).toBeCloseTo(CODE_BOOST, 5);
    expect(structureBoost('history of the company', { hasCode: true })).toBe(0);
    expect(isCodingQuery('sudo apt install')).toBe(true);
    expect(isCodingQuery('what does foo() return')).toBe(true);
    expect(isCodingQuery('who wrote this book')).toBe(false);
  });

  it('adds both boosts together', () => {
    const boost = structureBoost('command line', { breadcrumbs: ['Command Line'], hasCode: true });
    expect(boost).toBeCloseTo(BREADCRUMB_BOOST_MAX + CODE_BOOST, 5);
  });
});

describe('applyStructureBoost', () => {
  it('returns the very same array when nothing is boosted (other sources are untouched)', () => {
    const input = [result('a', 0.9), result('b', 0.5)];
    expect(applyStructureBoost('anything', input)).toBe(input);
  });

  it('reorders near-ties toward the chunk whose section matches the query', () => {
    const input = [
      result('plain', 0.50, { source: 'notes.md' }),
      result('structured', 0.46, { breadcrumbs: ['Using the Command Line'], structured: true })
    ];
    const ranked = applyStructureBoost('command line', input);
    expect(ranked.map(r => r.chunk.id)).toEqual(['structured', 'plain']);
    expect(ranked[0].score).toBeCloseTo(0.46 * 1.2, 5);
    expect(ranked[0].retrievalMethod).toBe('bm25+structure');
    expect(input[1].score).toBe(0.46); // inputs are not mutated
  });

  it('does not let a boost overturn a clearly better match, and never double-tags', () => {
    const input = [result('strong', 0.9), result('weak', 0.2, { breadcrumbs: ['Command Line'] })];
    expect(applyStructureBoost('command line', input).map(r => r.chunk.id)).toEqual(['strong', 'weak']);
    const tagged = applyStructureBoost('command line', [{ ...input[1], retrievalMethod: 'dense+structure' }]);
    expect(tagged[0].retrievalMethod).toBe('dense+structure');
  });

  it('handles empty input and chunks with no metadata object', () => {
    expect(applyStructureBoost('x', [])).toEqual([]);
    const bare = { chunk: { id: 'n', content: 'n' }, score: 1, retrievalMethod: 'bm25' } as unknown as RetrievalResult;
    expect(applyStructureBoost('x', [bare])).toEqual([bare]);
  });
});

describe('LocalKnowledgeAnswerer citations for structured PDFs', () => {
  const chunk = (id: string, metadata: Record<string, any>, content: string) => ({
    chunk: { id, content, metadata: { source: 'C:/books/handbook.pdf', title: 'Disk Recovery Handbook', ...metadata } },
    score: 1,
    retrievalMethod: 'keyword'
  });

  const answerWith = async (results: any[]) => {
    const store = { searchKeyword: jest.fn().mockResolvedValue(results) };
    return new LocalKnowledgeAnswerer(store as any).answer('what is the partition table for?', 'ask');
  };

  const body = 'The partition table describes how the disk is divided into partitions and where each partition begins and ends.';

  it('cites Book › Chapter › Section with the page', async () => {
    const answer = await answerWith([chunk('a', {
      structured: true, breadcrumbs: ['Chapter 1 Partition Basics', 'Using the Command Line'], page: 3
    }, body)]);

    expect(answer?.response).toContain('- Disk Recovery Handbook › Chapter 1 Partition Basics › Using the Command Line, p. 3');
    expect(answer?.sources).toEqual(['C:/books/handbook.pdf']);
  });

  it('shows a page range and lists distinct sections of one book separately', async () => {
    const answer = await answerWith([
      chunk('a', { structured: true, breadcrumbs: ['Chapter 1'], page: 3, pageEnd: 5 }, body),
      chunk('b', { structured: true, breadcrumbs: ['Chapter 2'], page: 9 }, `${body} Chapter two repeats the idea of partition tables.`),
      chunk('c', { structured: true, breadcrumbs: ['Chapter 1'], page: 3, pageEnd: 5 }, `${body} A third passage about partition tables.`)
    ]);

    const response = answer!.response;
    expect(response).toContain('- Disk Recovery Handbook › Chapter 1, pp. 3–5');
    expect(response).toContain('- Disk Recovery Handbook › Chapter 2, p. 9');
    expect(response.match(/Chapter 1, pp\. 3–5/g)).toHaveLength(1); // identical citations are not repeated
    expect(answer?.sources).toEqual(['C:/books/handbook.pdf']); // the source list stays unique
  });

  it('leaves non-structured sources exactly as before (one entry per source)', async () => {
    const answer = await answerWith([
      chunk('a', { chapterTitle: 'Chapter 2' }, body),
      chunk('b', { chapterTitle: 'Chapter 3' }, `${body} Another partition table passage.`)
    ]);
    expect(answer?.response).toContain('- Disk Recovery Handbook, Chapter 2');
    expect(answer?.response).not.toContain('Chapter 3');
    expect(answer?.response).not.toContain('›');
  });

  it('ignores a malformed page value rather than printing garbage', async () => {
    const answer = await answerWith([chunk('a', { structured: true, breadcrumbs: ['Chapter 1'], page: 'three' }, body)]);
    expect(answer?.response).toMatch(/- Disk Recovery Handbook › Chapter 1$/);
    expect(answer?.response).not.toContain('p. ');
  });
});
