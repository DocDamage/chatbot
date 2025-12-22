/**
 * Book Source - Search books from multiple sources
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export type BookSource = 'google_books' | 'open_library' | 'gutenberg' | 'all';

export class BookSource implements KnowledgeSource {
  name = 'books';
  private source: BookSource;
  private googleBooksApiKey?: string;

  constructor(source: BookSource = 'all', googleBooksApiKey?: string) {
    this.source = source;
    this.googleBooksApiKey = googleBooksApiKey || process.env.GOOGLE_BOOKS_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    return true; // At least one source is always available
  }

  async search(query: string, options: { limit?: number; source?: BookSource; author?: string; isbn?: string } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10, source = this.source, author, isbn } = options;
    const results: KnowledgeResult[] = [];

    try {
      if ((source === 'google_books' || source === 'all') && this.googleBooksApiKey) {
        const googleResults = await this.searchGoogleBooks(query, limit, author, isbn);
        results.push(...googleResults);
      }

      if (source === 'open_library' || source === 'all') {
        const openLibraryResults = await this.searchOpenLibrary(query, limit, author);
        results.push(...openLibraryResults);
      }

      if (source === 'gutenberg' || source === 'all') {
        const gutenbergResults = await this.searchGutenberg(query, limit);
        results.push(...gutenbergResults);
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Book search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      if (id.startsWith('google_')) {
        return await this.getGoogleBook(id.replace('google_', ''));
      } else if (id.startsWith('openlib_')) {
        return await this.getOpenLibraryBook(id.replace('openlib_', ''));
      }
      return null;
    } catch (error: any) {
      logger.warn('Failed to fetch book', { id, error: error.message });
      return null;
    }
  }

  /**
   * Search Google Books
   */
  private async searchGoogleBooks(query: string, limit: number, author?: string, isbn?: string): Promise<KnowledgeResult[]> {
    try {
      let searchQuery = query;
      if (author) searchQuery += `+inauthor:${author}`;
      if (isbn) searchQuery = `isbn:${isbn}`;

      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=${limit}${this.googleBooksApiKey ? `&key=${this.googleBooksApiKey}` : ''}`;
      const response = await axios.get(url);
      const books = response.data.items || [];

      return books.map((item: any) => {
        const volume = item.volumeInfo;
        return {
          id: `google_${item.id}`,
          title: volume.title,
          content: `${volume.description || ''}\n\nAuthors: ${volume.authors?.join(', ') || 'Unknown'}\nPublished: ${volume.publishedDate || 'Unknown'}`.substring(0, 3000),
          source: 'google_books',
          url: volume.infoLink,
          metadata: {
            authors: volume.authors || [],
            publisher: volume.publisher,
            publishedDate: volume.publishedDate,
            isbn: volume.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier,
            pageCount: volume.pageCount,
            categories: volume.categories || [],
            averageRating: volume.averageRating,
          },
          confidence: 0.9,
        };
      });
    } catch (error: any) {
      logger.error('Google Books search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search Open Library
   */
  private async searchOpenLibrary(query: string, limit: number, author?: string): Promise<KnowledgeResult[]> {
    try {
      let searchQuery = query;
      if (author) searchQuery += ` author:${author}`;

      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=${limit}`;
      const response = await axios.get(url);
      const books = response.data.docs || [];

      return books.map((book: any) => ({
        id: `openlib_${book.key?.replace('/works/', '') || book.cover_edition_key}`,
        title: book.title,
        content: `${book.first_sentence?.[0] || ''}\n\nAuthors: ${book.author_name?.join(', ') || 'Unknown'}\nFirst Published: ${book.first_publish_year || 'Unknown'}`.substring(0, 3000),
        source: 'open_library',
        url: `https://openlibrary.org${book.key || ''}`,
        metadata: {
          authors: book.author_name || [],
          firstPublishYear: book.first_publish_year,
          isbn: book.isbn?.[0],
          language: book.language,
          subject: book.subject || [],
        },
        confidence: 0.85,
      }));
    } catch (error: any) {
      logger.error('Open Library search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search Project Gutenberg
   */
  private async searchGutenberg(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      // Use Gutenberg search (basic implementation)
      const url = `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(query)}`;

      return [{
        id: `gutenberg_search_${query}`,
        title: `Project Gutenberg: ${query}`,
        content: `Search Project Gutenberg for books about "${query}". Project Gutenberg offers over 60,000 free eBooks.`,
        source: 'gutenberg',
        url,
        metadata: { searchQuery: query },
        confidence: 0.8,
      }];
    } catch (error: any) {
      logger.error('Gutenberg search failed', { error: error.message });
      return [];
    }
  }

  private async getGoogleBook(bookId: string): Promise<KnowledgeResult | null> {
    try {
      const url = `https://www.googleapis.com/books/v1/volumes/${bookId}${this.googleBooksApiKey ? `?key=${this.googleBooksApiKey}` : ''}`;
      const response = await axios.get(url);
      const volume = response.data.volumeInfo;

      return {
        id: `google_${bookId}`,
        title: volume.title,
        content: volume.description || '',
        source: 'google_books',
        url: volume.infoLink,
        metadata: {
          authors: volume.authors || [],
          publishedDate: volume.publishedDate,
        },
        confidence: 0.9,
      };
    } catch (error: any) {
      return null;
    }
  }

  private async getOpenLibraryBook(bookId: string): Promise<KnowledgeResult | null> {
    try {
      const url = `https://openlibrary.org/works/${bookId}.json`;
      const response = await axios.get(url);
      const book = response.data;

      // Get author details
      let authorNames: string[] = [];
      if (book.authors && book.authors.length > 0) {
        for (const author of book.authors.slice(0, 3)) {
          const authorKey = author.author?.key;
          if (authorKey) {
            try {
              const authorResponse = await axios.get(`https://openlibrary.org${authorKey}.json`);
              authorNames.push(authorResponse.data.name || 'Unknown');
            } catch {
              authorNames.push('Unknown');
            }
          }
        }
      }

      const description = typeof book.description === 'string'
        ? book.description
        : book.description?.value || '';

      return {
        id: `openlib_${bookId}`,
        title: book.title,
        content: `${book.title}\n\nAuthors: ${authorNames.join(', ')}\n\n${description}`.substring(0, 5000),
        source: 'open_library',
        url: `https://openlibrary.org/works/${bookId}`,
        metadata: {
          subjects: book.subjects?.slice(0, 10) || [],
          firstPublishDate: book.first_publish_date,
          covers: book.covers?.slice(0, 3).map((c: number) => `https://covers.openlibrary.org/b/id/${c}-M.jpg`)
        },
        confidence: 0.85
      };
    } catch (error: any) {
      logger.warn('Failed to fetch Open Library book', { bookId, error: error.message });
      return null;
    }
  }
}

