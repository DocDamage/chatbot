/**
 * Project Gutenberg Source - Load books from Project Gutenberg
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class ProjectGutenbergSource implements KnowledgeSource {
  name = 'gutenberg';
  private baseUrl = 'https://www.gutenberg.org';
  private catalogUrl = 'https://www.gutenberg.org/ebooks/search/?query=';

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number } = {}): Promise<KnowledgeResult[]> {
    try {
      const limit = options.limit || 10;

      // Search Gutenberg catalog
      const searchUrl = `${this.catalogUrl}${encodeURIComponent(query)}`;

      // Note: Gutenberg doesn't have a public API, so we'd need to scrape
      // For now, provide structured search results
      const results: KnowledgeResult[] = [];

      // In production, you would:
      // 1. Scrape the search results page
      // 2. Extract book IDs and metadata
      // 3. Fetch book content from Gutenberg's text files

      // Placeholder implementation
      results.push({
        id: `gutenberg_search_${query}`,
        title: `Project Gutenberg Books: ${query}`,
        content: `Search Project Gutenberg for books about "${query}" at ${searchUrl}. Project Gutenberg offers over 60,000 free eBooks.`,
        source: 'gutenberg',
        url: searchUrl,
        metadata: {
          searchQuery: query,
          note: 'Use Gutenberg text file URLs to load full books',
        },
        confidence: 0.8,
      });

      return results;
    } catch (error: any) {
      logger.error('Project Gutenberg search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      // Extract book ID from our internal ID format
      // ID format: gutenberg_12345 or gutenberg_search_query
      const parts = id.replace('gutenberg_', '').split('_');

      if (parts[0] === 'search') {
        // This is a search result, not a specific book
        const query = parts.slice(1).join('_');
        return {
          id,
          title: `Project Gutenberg Search: ${query}`,
          content: `Search Project Gutenberg for books about "${query}" at ${this.catalogUrl}${encodeURIComponent(query)}`,
          source: 'gutenberg',
          url: `${this.catalogUrl}${encodeURIComponent(query)}`,
          metadata: { type: 'search' },
          confidence: 0.7
        };
      }

      // Try to fetch actual book by numeric ID
      const bookId = parseInt(parts[0]);
      if (!isNaN(bookId)) {
        // Gutenberg text file URL pattern
        const textUrl = `https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`;
        const metadataUrl = `https://www.gutenberg.org/ebooks/${bookId}`;

        try {
          // Try to fetch the text file
          const response = await axios.get(textUrl, {
            headers: { 'User-Agent': 'KnowledgeBot/1.0' },
            timeout: 10000
          });

          const text = response.data;
          // Extract title from the text (usually near the beginning)
          const titleMatch = text.match(/Title:\s*([^\r\n]+)/i);
          const authorMatch = text.match(/Author:\s*([^\r\n]+)/i);

          const title = titleMatch ? titleMatch[1].trim() : `Gutenberg Book #${bookId}`;
          const author = authorMatch ? authorMatch[1].trim() : 'Unknown';

          // Get first 1000 characters as excerpt
          const contentStart = text.indexOf('*** START');
          const excerpt = contentStart > 0
            ? text.substring(contentStart, contentStart + 1500).substring(0, 1000)
            : text.substring(0, 1000);

          return {
            id,
            title: `${title} by ${author}`,
            content: excerpt + '...',
            source: 'gutenberg',
            url: metadataUrl,
            metadata: {
              bookId,
              author,
              fullTextUrl: textUrl,
              textLength: text.length
            },
            confidence: 0.95
          };
        } catch (textError) {
          // Text file not found with -0.txt pattern, try alternate
          logger.debug('Primary text URL failed, trying alternate', { bookId });
        }
      }

      // Fallback: return a reference to the book page
      return {
        id,
        title: `Gutenberg Book: ${id}`,
        content: `View this book on Project Gutenberg`,
        source: 'gutenberg',
        url: `${this.baseUrl}/ebooks/${parts[0]}`,
        metadata: { bookIdRaw: parts[0] },
        confidence: 0.6
      };
    } catch (error: any) {
      logger.warn('Failed to fetch Gutenberg book', { id, error: error.message });
      return null;
    }
  }

  /**
   * Load a book from Gutenberg text file URL
   */
  async loadBookFromUrl(textFileUrl: string): Promise<string> {
    try {
      const response = await axios.get(textFileUrl, {
        headers: {
          'User-Agent': 'KnowledgeBot/1.0',
        },
      });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to load Gutenberg book', { url: textFileUrl, error: error.message });
      throw error;
    }
  }
}

