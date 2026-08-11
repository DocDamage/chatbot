import axios from 'axios';
import { NewsSource } from './NewsSource';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() }
}));

describe('NewsSource provider coverage', () => {
  const get = axios.get as jest.Mock;

  beforeEach(() => get.mockReset());

  it('checks provider availability and searches all configured providers', async () => {
    expect(await new NewsSource('newsapi', 'news-key').isAvailable()).toBe(true);
    expect(await new NewsSource('guardian', undefined, 'guardian-key').isAvailable()).toBe(true);
    expect(await new NewsSource('nytimes', undefined, undefined, 'nyt-key').isAvailable()).toBe(true);
    expect(await new NewsSource('all').isAvailable()).toBe(false);

    get
      .mockResolvedValueOnce({ data: { articles: [{ title: 'News', url: 'https://news/item', description: 'desc', content: 'body', source: { name: 'Wire' } }] } })
      .mockResolvedValueOnce({ data: { response: { results: [{ id: 'guardian/item', webTitle: 'Guardian', webUrl: 'https://guardian/item', fields: { trailText: 'trail', body: 'body' } }] } } })
      .mockResolvedValueOnce({ data: { response: { docs: [{ _id: 'nyt/item', headline: { main: 'Times' }, web_url: 'https://nyt/item' }] } } });
    const source = new NewsSource('all', 'news-key', 'guardian-key', 'nyt-key');
    const results = await source.search('ai', { limit: 5 });
    expect(results.map(result => result.source)).toEqual(['newsapi', 'guardian', 'nytimes']);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('maps provider article reads and returns safe fallbacks on failures', async () => {
    const source = new NewsSource('all', 'news-key', 'guardian-key', 'nyt-key');
    get
      .mockResolvedValueOnce({ data: { articles: [{ url: 'https://news/item', title: 'News' }] } })
      .mockResolvedValueOnce({ data: { response: { content: { webTitle: 'Guardian', webUrl: 'https://guardian/item', fields: {} } } } })
      .mockResolvedValueOnce({ data: { response: { docs: [{ headline: { main: 'Times' }, web_url: 'https://nyt/item' }] } } });
    await expect(source.getById('newsapi_item')).resolves.toMatchObject({ source: 'newsapi' });
    await expect(source.getById('guardian_guardian/item')).resolves.toMatchObject({ source: 'guardian', title: 'Guardian' });
    await expect(source.getById('nytimes_nyt/item')).resolves.toMatchObject({ source: 'nytimes', title: 'Times' });
    await expect(source.getById('unknown')).resolves.toBeNull();
    await expect(new NewsSource('guardian').getById('guardian_missing')).resolves.toBeNull();

    get.mockRejectedValue(new Error('network down'));
    await expect(source.search('failure', { provider: 'newsapi' })).resolves.toEqual([]);
    await expect(source.getById('guardian_failure')).resolves.toBeNull();
    await expect(source.getById('nytimes_failure')).resolves.toBeNull();
  });
});
