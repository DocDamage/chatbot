import { UniversitySource, University } from '../UniversitySource';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RT-UNIV-001: UniversitySource Multi-Institutional Academic Retrieval Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks availability against university base URL', async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 200 } as any);
    const mitSource = new UniversitySource('mit');
    expect(await mitSource.isAvailable()).toBe(true);

    mockedAxios.get.mockRejectedValueOnce(new Error('Connection timed out'));
    expect(await mitSource.isAvailable()).toBe(false);
  });

  it('searches courses and papers across MIT, Harvard, Stanford, and Brown', async () => {
    const universities: University[] = ['mit', 'harvard', 'stanford', 'brown'];

    for (const uni of universities) {
      const source = new UniversitySource(uni);
      const results = await source.search('linear algebra', { limit: 4, type: 'all' });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].source).toContain(`university_${uni}`);
      expect(results[0].url).toBeDefined();
    }
  });

  it('retrieves courses and research papers by ID', async () => {
    const source = new UniversitySource('stanford');

    const course = await source.getById('course_stanford_cs229');
    expect(course).toMatchObject({
      id: 'course_stanford_cs229',
      source: 'university_stanford'
    });

    const paper = await source.getById('paper_stanford_deep_learning');
    expect(paper).toMatchObject({
      id: 'paper_stanford_deep_learning',
      source: 'university_stanford'
    });

    const unknown = await source.getById('unknown_type_123');
    expect(unknown).toBeNull();
  });

  it('handles search and retrieval errors gracefully', async () => {
    const source = new UniversitySource('harvard');
    const results = await source.search('quantum computing', { type: 'courses' });
    expect(Array.isArray(results)).toBe(true);

    const empty = await (source as any).getById('');
    expect(empty).toBeNull();
  });
});
