import { SpecializedTopicSource } from '../SpecializedTopicSource';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RT-SPEC-001: SpecializedTopicSource Domain Knowledge & Research Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('verifies availability and curated sources for each topic', async () => {
    const source = new SpecializedTopicSource('all');
    expect(await source.isAvailable()).toBe(true);

    const civilRightsSource = new SpecializedTopicSource('civil_rights');
    expect(civilRightsSource.name).toBe('specialized_topics');

    const sources = (civilRightsSource as any).topicSources.civil_rights;
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0].url).toContain('archives.gov');
  });

  it('searches topics with query enhancement and curated items', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        title: 'Civil Rights Movement',
        extract: 'The civil rights movement was a nonviolent social movement.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Civil_Rights_Movement' } }
      }
    } as any);

    const source = new SpecializedTopicSource('civil_rights');
    const results = await source.search('voting rights', { limit: 5 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBeDefined();
    expect(results[0].source).toBeDefined();
  });

  it('fetches entity by ID for wiki, curated, and LOC references', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        title: 'Hip Hop Culture',
        extract: 'Hip hop is a culture and art movement.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Hip_hop' } }
      }
    } as any);

    const source = new SpecializedTopicSource('hip_hop_history');

    // 1. Wiki ID
    const wikiResult = await source.getById('wiki_hip_hop_history_Hip_hop');
    expect(wikiResult).toMatchObject({
      title: 'Hip Hop Culture',
      source: 'wikipedia'
    });

    // 2. Curated ID
    const curatedResult = await source.getById('compliance_SEC_Compliance');
    expect(curatedResult).toMatchObject({
      metadata: expect.objectContaining({ topic: 'compliance' })
    });

    // 3. Fallback unknown ID
    const unknown = await source.getById('invalid_id');
    expect(unknown).toBeNull();
  });

  it('handles network errors gracefully during search and fetch', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network offline'));

    const source = new SpecializedTopicSource('connecticut_history');
    const searchResults = await source.search('Hartford history', { limit: 2 });
    expect(Array.isArray(searchResults)).toBe(true);

    const nullResult = await source.getById('wiki_connecticut_history_unknown');
    expect(nullResult).toBeNull();
  });
});
