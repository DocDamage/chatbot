/**
 * Entertainment Source - Movies, Cartoons, Comics, Manga
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export type EntertainmentType = 'movie' | 'cartoon' | 'comic' | 'manga' | 'anime' | 'all';

export class EntertainmentSource implements KnowledgeSource {
  name = 'entertainment';
  private type: EntertainmentType;
  private tmdbApiKey?: string;
  private omdbApiKey?: string;

  constructor(type: EntertainmentType = 'all', tmdbApiKey?: string, omdbApiKey?: string) {
    this.type = type;
    this.tmdbApiKey = tmdbApiKey || process.env.TMDB_API_KEY;
    this.omdbApiKey = omdbApiKey || process.env.OMDB_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    // Check if at least one API is available
    return !!(this.tmdbApiKey || this.omdbApiKey);
  }

  async search(query: string, options: { limit?: number; type?: EntertainmentType; year?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10, type = this.type, year } = options;
    const results: KnowledgeResult[] = [];

    try {
      if ((type === 'movie' || type === 'all') && this.tmdbApiKey) {
        const movieResults = await this.searchMovies(query, limit, year);
        results.push(...movieResults);
      }

      if ((type === 'cartoon' || type === 'all') && this.tmdbApiKey) {
        const cartoonResults = await this.searchCartoons(query, limit);
        results.push(...cartoonResults);
      }

      if ((type === 'comic' || type === 'all')) {
        const comicResults = await this.searchComics(query, limit);
        results.push(...comicResults);
      }

      if ((type === 'manga' || type === 'anime' || type === 'all')) {
        const mangaResults = await this.searchManga(query, limit);
        results.push(...mangaResults);
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Entertainment search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      if (id.startsWith('movie_')) {
        return await this.getMovie(id.replace('movie_', ''));
      } else if (id.startsWith('comic_')) {
        return await this.getComic(id.replace('comic_', ''));
      }
      return null;
    } catch (error: any) {
      logger.warn('Failed to fetch entertainment item', { id, error: error.message });
      return null;
    }
  }

  /**
   * Search movies using TMDb API
   */
  private async searchMovies(query: string, limit: number, year?: number): Promise<KnowledgeResult[]> {
    try {
      let url = `https://api.themoviedb.org/3/search/movie?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}&page=1`;
      if (year) {
        url += `&year=${year}`;
      }

      const response = await axios.get(url);
      const movies = response.data.results || [];

      return movies.slice(0, limit).map((movie: any) => ({
        id: `movie_${movie.id}`,
        title: movie.title,
        content: `${movie.overview || ''}\n\nRelease Date: ${movie.release_date}\nRating: ${movie.vote_average}/10`.substring(0, 2000),
        source: 'tmdb',
        url: `https://www.themoviedb.org/movie/${movie.id}`,
        metadata: {
          movieId: movie.id,
          releaseDate: movie.release_date,
          rating: movie.vote_average,
          popularity: movie.popularity,
          genreIds: movie.genre_ids,
        },
        confidence: 0.9,
      }));
    } catch (error: any) {
      logger.error('Movie search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search cartoons (animated movies/TV)
   */
  private async searchCartoons(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      // Search TMDb with animation filter
      const url = `https://api.themoviedb.org/3/search/movie?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}&with_genres=16&page=1`;
      const response = await axios.get(url);
      const cartoons = response.data.results || [];

      return cartoons.slice(0, limit).map((cartoon: any) => ({
        id: `cartoon_${cartoon.id}`,
        title: cartoon.title,
        content: `${cartoon.overview || ''}\n\nRelease: ${cartoon.release_date}`.substring(0, 2000),
        source: 'tmdb_cartoon',
        url: `https://www.themoviedb.org/movie/${cartoon.id}`,
        metadata: {
          releaseDate: cartoon.release_date,
          rating: cartoon.vote_average,
        },
        confidence: 0.85,
      }));
    } catch (error: any) {
      logger.error('Cartoon search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search comics
   */
  private async searchComics(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      // Use ComicVine API (free tier available) or web scraping
      // For now, provide structured search
      const results: KnowledgeResult[] = [];

      // ComicVine API (requires API key)
      if (process.env.COMICVINE_API_KEY) {
        const url = `https://comicvine.gamespot.com/api/search/?api_key=${process.env.COMICVINE_API_KEY}&query=${encodeURIComponent(query)}&resources=issue,volume&format=json`;
        const response = await axios.get(url);
        const comics = response.data.results || [];

        for (const comic of comics.slice(0, limit)) {
          results.push({
            id: `comic_${comic.id}`,
            title: comic.name || comic.title,
            content: `${comic.description || ''}`.substring(0, 2000),
            source: 'comicvine',
            url: comic.site_detail_url,
            metadata: {
              publisher: comic.publisher?.name,
              issueNumber: comic.issue_number,
            },
            confidence: 0.8,
          });
        }
      } else {
        // Fallback: provide search URLs
        results.push({
          id: `comic_search_${query}`,
          title: `Comic Search: ${query}`,
          content: `Search for comics about "${query}" on ComicVine, Marvel, DC Comics, or other comic databases.`,
          source: 'comic_search',
          url: `https://comicvine.gamespot.com/search/?q=${encodeURIComponent(query)}`,
          metadata: { searchQuery: query },
          confidence: 0.7,
        });
      }

      return results;
    } catch (error: any) {
      logger.error('Comic search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search manga/anime
   */
  private async searchManga(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      // Use MyAnimeList API or Jikan API (free, no key required)
      const url = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=${limit}`;
      const response = await axios.get(url);
      const mangas = response.data.data || [];

      return mangas.map((manga: any) => ({
        id: `manga_${manga.mal_id}`,
        title: manga.title,
        content: `${manga.synopsis || ''}\n\nChapters: ${manga.chapters || 'Ongoing'}\nStatus: ${manga.status}`.substring(0, 2000),
        source: 'jikan_manga',
        url: manga.url,
        metadata: {
          malId: manga.mal_id,
          chapters: manga.chapters,
          status: manga.status,
          score: manga.score,
          genres: manga.genres?.map((g: any) => g.name) || [],
        },
        confidence: 0.85,
      }));
    } catch (error: any) {
      logger.error('Manga search failed', { error: error.message });
      return [];
    }
  }

  private async getMovie(movieId: string): Promise<KnowledgeResult | null> {
    try {
      const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${this.tmdbApiKey}`;
      const response = await axios.get(url);
      const movie = response.data;

      return {
        id: `movie_${movieId}`,
        title: movie.title,
        content: `${movie.overview}\n\nRelease: ${movie.release_date}\nRuntime: ${movie.runtime} minutes\nRating: ${movie.vote_average}/10`,
        source: 'tmdb',
        url: `https://www.themoviedb.org/movie/${movieId}`,
        metadata: {
          genres: movie.genres?.map((g: any) => g.name) || [],
          budget: movie.budget,
          revenue: movie.revenue,
        },
        confidence: 0.9,
      };
    } catch (error: any) {
      return null;
    }
  }

  private async getComic(comicId: string): Promise<KnowledgeResult | null> {
    try {
      if (process.env.COMICVINE_API_KEY) {
        const url = `https://comicvine.gamespot.com/api/issue/4000-${comicId}/?api_key=${process.env.COMICVINE_API_KEY}&format=json`;
        const response = await axios.get(url);
        const comic = response.data.results;
        if (comic) {
          return {
            id: `comic_${comicId}`,
            title: comic.name || comic.volume?.name || 'Unknown Comic',
            content: (comic.description || '').replace(/<[^>]*>/g, '').substring(0, 3000),
            source: 'comicvine',
            url: comic.site_detail_url,
            metadata: { publisher: comic.publisher?.name, issueNumber: comic.issue_number },
            confidence: 0.85
          };
        }
      }
      return null;
    } catch (error: any) { logger.warn('Failed to get comic', { comicId, error: error.message }); return null; }
  }
}

