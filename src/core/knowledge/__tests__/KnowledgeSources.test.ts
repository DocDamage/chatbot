import { describe, expect, it, jest } from '@jest/globals';
import axios from 'axios';
import { BookSource } from '../BookSource';
import { EntertainmentSource } from '../EntertainmentSource';
import { ResultRanker } from '../ResultRanker';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RT-KNOW-003: BookSource, EntertainmentSource and ResultRanker Suite', () => {
  describe('BookSource', () => {
    it('searches Google Books and Open Library and Project Gutenberg', async () => {
      mockedAxios.get.mockImplementation(((async (url: string) => {
        if (url.includes('googleapis.com')) {
          return {
            data: {
              id: 'book123',
              volumeInfo: {
                title: 'The Great Gatsby',
                description: 'A classic 1925 novel.',
                authors: ['F. Scott Fitzgerald'],
                publishedDate: '1925',
                industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780743273565' }],
                pageCount: 180,
                categories: ['Fiction']
              },
              items: [
                {
                  id: 'book123',
                  volumeInfo: {
                    title: 'The Great Gatsby',
                    description: 'A classic 1925 novel.',
                    authors: ['F. Scott Fitzgerald'],
                    publishedDate: '1925',
                    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780743273565' }],
                    pageCount: 180,
                    categories: ['Fiction']
                  }
                }
              ]
            }
          };
        }
        if (url.includes('openlibrary.org/search')) {
          return {
            data: {
              docs: [
                {
                  key: '/works/OL123W',
                  title: '1984',
                  author_name: ['George Orwell'],
                  first_publish_year: 1949,
                  isbn: ['9780451524935']
                }
              ]
            }
          };
        }
        if (url.includes('openlibrary.org/works/OL123W')) {
          return {
            data: {
              title: '1984',
              description: 'Dystopian classic.',
              first_publish_date: '1949',
              authors: [{ author: { key: '/authors/OL111A' } }]
            }
          };
        }
        if (url.includes('/authors/OL111A')) {
          return { data: { name: 'George Orwell' } };
        }
        return { data: {} };
      }) as any));

      const bookSource = new BookSource('all', 'mock-google-key');
      expect(await bookSource.isAvailable()).toBe(true);

      const results = await bookSource.search('classic novels', { limit: 5 });
      expect(results.length).toBeGreaterThan(0);

      const googleBook = await bookSource.getById('google_book123');
      expect(googleBook).not.toBeNull();
      expect(googleBook?.title).toBe('The Great Gatsby');

      const openLibBook = await bookSource.getById('openlib_OL123W');
      expect(openLibBook).not.toBeNull();
      expect(openLibBook?.title).toBe('1984');
    });
  });

  describe('EntertainmentSource', () => {
    it('searches movies, cartoons, comics, and manga', async () => {
      mockedAxios.get.mockImplementation(((async (url: string) => {
        if (url.includes('themoviedb.org') || url.includes('api.themoviedb.org')) {
          return {
            data: {
              results: [
                {
                  id: 101,
                  title: 'Inception',
                  overview: 'Dream within a dream.',
                  release_date: '2010-07-16',
                  vote_average: 8.8
                }
              ]
            }
          };
        }
        if (url.includes('api.jikan.moe')) {
          return {
            data: {
              data: [
                {
                  mal_id: 202,
                  title: 'Death Note',
                  synopsis: 'Supernatural notebook.',
                  score: 8.6
                }
              ]
            }
          };
        }
        return { data: {} };
      }) as any));

      const entSource = new EntertainmentSource('all', 'mock-tmdb-key', 'mock-omdb-key');
      expect(await entSource.isAvailable()).toBe(true);

      const results = await entSource.search('Inception', { limit: 5 });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('ResultRanker', () => {
    it('ranks results by recency, authority, completeness, and custom factor weights', async () => {
      const ranker = new ResultRanker();

      const results = [
        {
          id: '1',
          title: 'Recent official docs from Wikipedia',
          content: 'Detailed description of the topic with extensive content '.repeat(20),
          source: 'wikipedia',
          url: 'https://en.wikipedia.org/wiki/Node.js',
          metadata: { publishedAt: new Date().toISOString() },
          confidence: 0.9
        },
        {
          id: '2',
          title: 'Older short post',
          content: 'Short content',
          source: 'unknown',
          metadata: { publishedAt: '2015-01-01T00:00:00Z' },
          confidence: 0.3
        }
      ];

      const ranked = await ranker.rank('Node.js guide', results, { authority: 0.5, recency: 0.3 });
      expect(ranked.length).toBe(2);
      expect(ranked[0].id).toBe('1');
      expect(ranked[0].confidence).toBeGreaterThan(ranked[1].confidence || 0);
    });
  });
});
