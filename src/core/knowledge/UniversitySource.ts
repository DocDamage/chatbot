/**
 * University Knowledge Source - Fetch course materials, research papers, and resources
 * Supports: MIT, Harvard, Stanford, Brown
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export type University = 'mit' | 'harvard' | 'stanford' | 'brown';

export class UniversitySource implements KnowledgeSource {
  name = 'university';
  private university: University;
  private baseUrls: Record<University, string> = {
    mit: 'https://ocw.mit.edu',
    harvard: 'https://online-learning.harvard.edu',
    stanford: 'https://online.stanford.edu',
    brown: 'https://www.brown.edu',
  };

  constructor(university: University) {
    this.university = university;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const url = this.getBaseUrl();
      await axios.get(url, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number; type?: 'courses' | 'papers' | 'all' } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10, type = 'all' } = options;
    const results: KnowledgeResult[] = [];

    try {
      // Search courses
      if (type === 'courses' || type === 'all') {
        const courses = await this.searchCourses(query, limit);
        results.push(...courses);
      }

      // Search research papers
      if (type === 'papers' || type === 'all') {
        const papers = await this.searchPapers(query, limit);
        results.push(...papers);
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('University search failed', { university: this.university, error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      const [type, ...rest] = id.split('_');
      const resourceId = rest.join('_');

      if (type === 'course') {
        return await this.getCourse(resourceId);
      } else if (type === 'paper') {
        return await this.getPaper(resourceId);
      }

      return null;
    } catch (error: any) {
      logger.warn('Failed to fetch university resource', { id, error: error.message });
      return null;
    }
  }

  /**
   * Search courses
   */
  private async searchCourses(query: string, limit: number): Promise<KnowledgeResult[]> {
    const results: KnowledgeResult[] = [];

    try {
      // MIT OpenCourseWare
      if (this.university === 'mit') {
        const url = `https://ocw.mit.edu/search/?q=${encodeURIComponent(query)}`;
        // Note: MIT OCW doesn't have a public API, so we'd need to scrape
        // For now, return a placeholder that indicates the resource exists
        results.push({
          id: `course_mit_${query}`,
          title: `MIT Course: ${query}`,
          content: `MIT OpenCourseWare offers free course materials. Search for "${query}" at https://ocw.mit.edu`,
          source: `university_${this.university}`,
          url: url,
          metadata: {
            university: 'MIT',
            type: 'course',
            searchUrl: url,
          },
          confidence: 0.7,
        });
      }

      // Add other universities similarly
      // Note: Most universities don't have public APIs, so we provide search URLs
      // In production, you'd implement web scraping or use official APIs if available

    } catch (error: any) {
      logger.warn('Course search failed', { university: this.university, error: error.message });
    }

    return results;
  }

  /**
   * Search research papers
   */
  private async searchPapers(query: string, limit: number): Promise<KnowledgeResult[]> {
    const results: KnowledgeResult[] = [];

    try {
      // Search university repositories and ArXiv
      // MIT: DSpace, Harvard: DASH, Stanford: SDR, Brown: Digital Repository

      const searchQueries = [
        `site:${this.getDomain()} ${query}`,
        `"${this.university}" ${query} site:arxiv.org`,
      ];

      for (const searchQuery of searchQueries) {
        // Use Google Custom Search API or similar
        // For now, provide structured search URLs
        const searchUrl = this.getPaperSearchUrl(query);

        results.push({
          id: `paper_${this.university}_${Date.now()}`,
          title: `${this.university.toUpperCase()} Research: ${query}`,
          content: `Research papers from ${this.university.toUpperCase()} related to "${query}". Search at ${searchUrl}`,
          source: `university_${this.university}`,
          url: searchUrl,
          metadata: {
            university: this.university,
            type: 'paper',
            searchQuery: query,
          },
          confidence: 0.8,
        });
      }
    } catch (error: any) {
      logger.warn('Paper search failed', { university: this.university, error: error.message });
    }

    return results.slice(0, limit);
  }

  private async getCourse(courseId: string): Promise<KnowledgeResult | null> {
    try {
      // Parse the course ID to extract university and query
      const parts = courseId.split('_');
      if (parts.length < 2) return null;

      const query = parts.slice(1).join('_');

      // For MIT OCW, try to fetch from their API-like endpoints
      if (this.university === 'mit') {
        const url = `https://ocw.mit.edu/search/?q=${encodeURIComponent(query)}`;

        return {
          id: `course_${courseId}`,
          title: `MIT OpenCourseWare: ${query}`,
          content: `MIT offers free course materials on this topic. Visit ${url} to access lectures, assignments, and exams.`,
          source: `university_${this.university}`,
          url,
          metadata: {
            university: 'MIT',
            type: 'course',
            query
          },
          confidence: 0.7
        };
      }

      // For other universities, return search URLs
      const searchUrl = this.getBaseUrl() + `/search?q=${encodeURIComponent(query)}`;

      return {
        id: `course_${courseId}`,
        title: `${this.university.toUpperCase()} Course: ${query}`,
        content: `Course materials from ${this.university.toUpperCase()}. Search at ${searchUrl}`,
        source: `university_${this.university}`,
        url: searchUrl,
        metadata: {
          university: this.university,
          type: 'course'
        },
        confidence: 0.6
      };
    } catch (error: any) {
      logger.warn('Failed to get course', { courseId, error: error.message });
      return null;
    }
  }

  private async getPaper(paperId: string): Promise<KnowledgeResult | null> {
    try {
      // Try to fetch from university digital repositories
      const searchUrl = this.getPaperSearchUrl(paperId);

      // Try ArXiv API for academic papers
      const arxivUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(paperId)}&max_results=1`;

      try {
        const response = await axios.get(arxivUrl, { timeout: 5000 });
        const data = response.data;

        // Simple XML parsing for ArXiv response
        const titleMatch = data.match(/<title>([^<]+)<\/title>/g);
        const summaryMatch = data.match(/<summary>([^<]+)<\/summary>/);
        const linkMatch = data.match(/<id>([^<]+)<\/id>/);

        if (titleMatch && titleMatch.length > 1) {
          const title = titleMatch[1].replace(/<\/?title>/g, '').trim();
          const summary = summaryMatch ? summaryMatch[1].trim() : '';
          const link = linkMatch ? linkMatch[1].trim() : arxivUrl;

          return {
            id: `paper_${paperId}`,
            title,
            content: summary,
            source: `university_${this.university}`,
            url: link,
            metadata: {
              type: 'paper',
              arxivId: paperId,
              university: this.university
            },
            confidence: 0.85
          };
        }
      } catch (arxivError) {
        // ArXiv fetch failed, fall back to search URL
      }

      return {
        id: `paper_${paperId}`,
        title: `Research Paper: ${paperId}`,
        content: `Academic research paper. Search at ${searchUrl}`,
        source: `university_${this.university}`,
        url: searchUrl,
        metadata: {
          type: 'paper',
          searchId: paperId
        },
        confidence: 0.6
      };
    } catch (error: any) {
      logger.warn('Failed to get paper', { paperId, error: error.message });
      return null;
    }
  }

  private getBaseUrl(): string {
    return this.baseUrls[this.university];
  }

  private getDomain(): string {
    const domains: Record<University, string> = {
      mit: 'mit.edu',
      harvard: 'harvard.edu',
      stanford: 'stanford.edu',
      brown: 'brown.edu',
    };
    return domains[this.university];
  }

  private getPaperSearchUrl(query: string): string {
    const urls: Record<University, string> = {
      mit: `https://dspace.mit.edu/discover?query=${encodeURIComponent(query)}`,
      harvard: `https://dash.harvard.edu/discover?query=${encodeURIComponent(query)}`,
      stanford: `https://purl.stanford.edu/search?q=${encodeURIComponent(query)}`,
      brown: `https://repository.library.brown.edu/discover?query=${encodeURIComponent(query)}`,
    };
    return urls[this.university];
  }
}

