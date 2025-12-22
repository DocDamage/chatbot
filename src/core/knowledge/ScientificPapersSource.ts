/**
 * Scientific Papers Source - Fetch from ArXiv, PubMed, and other repositories
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export type PaperSource = 'arxiv' | 'pubmed' | 'biorxiv' | 'all';

export class ScientificPapersSource implements KnowledgeSource {
  name = 'scientific_papers';
  private source: PaperSource;

  constructor(source: PaperSource = 'all') {
    this.source = source;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get('https://export.arxiv.org/api/query?search_query=all:test&max_results=1', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number; source?: PaperSource; maxResults?: number } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10, source = this.source, maxResults } = options;
    const actualLimit = maxResults || limit;
    const results: KnowledgeResult[] = [];

    try {
      if (source === 'arxiv' || source === 'all') {
        const arxivResults = await this.searchArXiv(query, actualLimit);
        results.push(...arxivResults);
      }

      if (source === 'pubmed' || source === 'all') {
        const pubmedResults = await this.searchPubMed(query, actualLimit);
        results.push(...pubmedResults);
      }

      if (source === 'biorxiv' || source === 'all') {
        const biorxivResults = await this.searchBioRxiv(query, actualLimit);
        results.push(...biorxivResults);
      }

      return results.slice(0, actualLimit);
    } catch (error: any) {
      logger.error('Scientific papers search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      if (id.startsWith('arxiv_')) {
        return await this.getArXivPaper(id.replace('arxiv_', ''));
      } else if (id.startsWith('pubmed_')) {
        return await this.getPubMedPaper(id.replace('pubmed_', ''));
      } else if (id.startsWith('biorxiv_')) {
        return await this.getBioRxivPaper(id.replace('biorxiv_', ''));
      }
      return null;
    } catch (error: any) {
      logger.warn('Failed to fetch paper by ID', { id, error: error.message });
      return null;
    }
  }

  /**
   * Search ArXiv
   */
  private async searchArXiv(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${limit}&sortBy=relevance&sortOrder=descending`;
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/atom+xml',
        },
      });

      const parser = require('xml2js');
      const parsed = await parser.parseStringPromise(response.data);
      const entries = parsed.feed?.entry || [];

      const results: KnowledgeResult[] = [];

      for (const entry of entries) {
        const id = entry.id[0].split('/').pop();
        const title = entry.title[0].trim();
        const summary = entry.summary[0].trim();
        const authors = entry.author?.map((a: any) => a.name[0]).join(', ') || '';
        const published = entry.published[0];
        const categories = entry.category?.map((c: any) => c.$.term).join(', ') || '';

        results.push({
          id: `arxiv_${id}`,
          title,
          content: `${title}\n\nAuthors: ${authors}\n\n${summary}`.substring(0, 3000),
          source: 'arxiv',
          url: `https://arxiv.org/abs/${id}`,
          metadata: {
            authors,
            published,
            categories,
            arxivId: id,
          },
          confidence: 0.9, // ArXiv papers are peer-reviewed
        });
      }

      return results;
    } catch (error: any) {
      logger.error('ArXiv search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search PubMed
   */
  private async searchPubMed(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json`;
      const searchResponse = await axios.get(url);
      const pmids = searchResponse.data.esearchresult?.idlist || [];

      if (pmids.length === 0) return [];

      // Fetch details for each paper
      const detailsUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`;
      const detailsResponse = await axios.get(detailsUrl);
      const papers = detailsResponse.data.result || {};

      const results: KnowledgeResult[] = [];

      for (const pmid of pmids) {
        const paper = papers[pmid];
        if (!paper) continue;

        const title = paper.title || '';
        const authors = paper.authors?.map((a: any) => a.name).join(', ') || '';
        const abstract = paper.abstract || '';
        const journal = paper.source || '';
        const published = paper.pubdate || '';

        results.push({
          id: `pubmed_${pmid}`,
          title,
          content: `${title}\n\nAuthors: ${authors}\n\nJournal: ${journal}\n\n${abstract}`.substring(0, 3000),
          source: 'pubmed',
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          metadata: {
            pmid,
            authors,
            journal,
            published,
          },
          confidence: 0.95, // PubMed is highly reliable
        });
      }

      return results;
    } catch (error: any) {
      logger.error('PubMed search failed', { error: error.message });
      return [];
    }
  }

  /**
   * Search BioRxiv
   */
  private async searchBioRxiv(query: string, limit: number): Promise<KnowledgeResult[]> {
    try {
      // BioRxiv uses RSS feed
      const url = `https://connect.biorxiv.org/biorxiv_xml.php?subject=all&search=${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/rss+xml',
        },
      });

      const parser = require('xml2js');
      const parsed = await parser.parseStringPromise(response.data);
      const items = parsed.rss?.channel?.[0]?.item || [];

      const results: KnowledgeResult[] = [];

      for (const item of items.slice(0, limit)) {
        const title = item.title?.[0] || '';
        const description = item.description?.[0] || '';
        const link = item.link?.[0] || '';
        const doi = item['dc:identifier']?.[0]?.replace('doi:', '') || '';
        const authors = item['dc:creator']?.join(', ') || '';

        results.push({
          id: `biorxiv_${doi || link.split('/').pop()}`,
          title,
          content: `${title}\n\nAuthors: ${authors}\n\n${description}`.substring(0, 3000),
          source: 'biorxiv',
          url: link,
          metadata: {
            doi,
            authors,
          },
          confidence: 0.85, // Preprints, slightly lower than published
        });
      }

      return results;
    } catch (error: any) {
      logger.error('BioRxiv search failed', { error: error.message });
      return [];
    }
  }

  private async getArXivPaper(arxivId: string): Promise<KnowledgeResult | null> {
    try {
      const url = `https://export.arxiv.org/api/query?id_list=${arxivId}`;
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/atom+xml',
        },
      });

      const parser = require('xml2js');
      const parsed = await parser.parseStringPromise(response.data);
      const entry = parsed.feed?.entry?.[0];
      if (!entry) return null;

      const title = entry.title[0].trim();
      const summary = entry.summary[0].trim();
      const authors = entry.author?.map((a: any) => a.name[0]).join(', ') || '';

      return {
        id: `arxiv_${arxivId}`,
        title,
        content: `${title}\n\nAuthors: ${authors}\n\n${summary}`,
        source: 'arxiv',
        url: `https://arxiv.org/abs/${arxivId}`,
        metadata: {
          authors,
          arxivId,
        },
        confidence: 0.9,
      };
    } catch (error: any) {
      logger.warn('Failed to fetch ArXiv paper', { arxivId, error: error.message });
      return null;
    }
  }

  private async getPubMedPaper(pmid: string): Promise<KnowledgeResult | null> {
    try {
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;
      const response = await axios.get(url);
      const paper = response.data.result[pmid];
      if (!paper) return null;

      const title = paper.title || '';
      const authors = paper.authors?.map((a: any) => a.name).join(', ') || '';
      const abstract = paper.abstract || '';

      return {
        id: `pubmed_${pmid}`,
        title,
        content: `${title}\n\nAuthors: ${authors}\n\n${abstract}`,
        source: 'pubmed',
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        metadata: {
          pmid,
          authors,
        },
        confidence: 0.95,
      };
    } catch (error: any) {
      logger.warn('Failed to fetch PubMed paper', { pmid, error: error.message });
      return null;
    }
  }

  private async getBioRxivPaper(paperId: string): Promise<KnowledgeResult | null> {
    try {
      // Try to fetch from BioRxiv API
      const url = `https://api.biorxiv.org/details/biorxiv/${paperId}`;
      const response = await axios.get(url);

      const paper = response.data.collection?.[0];
      if (!paper) {
        // Fallback to DOI lookup
        return {
          id: `biorxiv_${paperId}`,
          title: `BioRxiv Paper: ${paperId}`,
          content: `View this paper at BioRxiv`,
          source: 'biorxiv',
          url: `https://www.biorxiv.org/content/${paperId}`,
          metadata: { paperId },
          confidence: 0.7
        };
      }

      return {
        id: `biorxiv_${paperId}`,
        title: paper.title,
        content: `${paper.title}\n\nAuthors: ${paper.authors}\n\n${paper.abstract || ''}`,
        source: 'biorxiv',
        url: `https://www.biorxiv.org/content/${paper.doi}`,
        metadata: {
          doi: paper.doi,
          authors: paper.authors,
          date: paper.date,
          category: paper.category
        },
        confidence: 0.85
      };
    } catch (error: any) {
      logger.warn('Failed to fetch BioRxiv paper', { paperId, error: error.message });
      return null;
    }
  }
}

