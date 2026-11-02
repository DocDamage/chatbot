import axios from 'axios';
import { EntertainmentSource } from '../EntertainmentSource';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('B75-08: EntertainmentSource Deep Decision Matrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('checks API availability based on keys', async () => {
    const sourceNoKeys = new EntertainmentSource('all', '', '');
    expect(await sourceNoKeys.isAvailable()).toBe(false);

    const sourceWithKeys = new EntertainmentSource('all', 'tmdb_key_123', 'omdb_key_123');
    expect(await sourceWithKeys.isAvailable()).toBe(true);
  });

  it('searches movies, cartoons, comics, and manga with mocked responses', async () => {
    process.env.COMICVINE_API_KEY = 'mock_comicvine_key';
    const source = new EntertainmentSource('all', 'tmdb_key', 'omdb_key');

    // 1. Movie search response
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        results: [
          { id: 101, title: 'Inception', overview: 'A thief who steals corporate secrets through dream-sharing.', release_date: '2010-07-16', vote_average: 8.8, popularity: 95.5, genre_ids: [28, 878] }
        ]
      }
    });

    // 2. Cartoon search response (TV search)
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        results: [
          { id: 202, title: 'Avatar: The Last Airbender', overview: 'In a war-torn world of elemental magic.', release_date: '2005-02-21', vote_average: 8.9 }
        ]
      }
    });

    // 3. Comic search response (ComicVine API)
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        results: [
          { id: 303, name: 'Batman: Year One', description: 'A dark and gritty origin story.', publisher: { name: 'DC Comics' } }
        ]
      }
    });

    // 4. Manga search response (Jikan / MangaDex API)
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: [
          { mal_id: 404, title: 'Fullmetal Alchemist', synopsis: 'Alchemy the science of understanding.', score: 9.1, published: { from: '2001-07-12' }, authors: [{ name: 'Arakawa, Hiromu' }] }
        ]
      }
    });

    const results = await source.search('hero', { limit: 10, year: 2010 });
    expect(results.length).toBe(4);
    expect(results[0].title).toBe('Inception');
    expect(results[1].title).toBe('Avatar: The Last Airbender');
    expect(results[2].title).toBe('Batman: Year One');
    expect(results[3].title).toBe('Fullmetal Alchemist');
  });

  it('fetches items by ID for movies and comics', async () => {
    const source = new EntertainmentSource('all', 'tmdb_key', 'omdb_key');

    // 1. Movie by ID
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        id: 550,
        title: 'Fight Club',
        overview: 'An insomniac office worker looking for a way to change his life.',
        release_date: '1999-10-15',
        vote_average: 8.4,
        runtime: 139,
        genres: [{ name: 'Drama' }],
        credits: { cast: [{ name: 'Brad Pitt' }, { name: 'Edward Norton' }] }
      }
    });

    const movie = await source.getById('movie_550');
    expect(movie).toBeDefined();
    expect(movie?.title).toBe('Fight Club');

    // 2. Comic by ID
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        results: {
          id: 1234,
          name: 'Watchmen #1',
          description: 'Rorschach investigates the death of Edward Blake.',
          cover_date: '1986-09-01',
          volume: { name: 'Watchmen' }
        }
      }
    });

    const comic = await source.getById('comic_1234');
    expect(comic).toBeDefined();
    expect(comic?.title).toBe('Watchmen #1');

    // 3. Unknown ID prefix
    const unknown = await source.getById('unknown_9999');
    expect(unknown).toBeNull();
  });
});
