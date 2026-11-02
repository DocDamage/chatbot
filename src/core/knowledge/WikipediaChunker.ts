/**
 * Wikipedia Ingestion & Chunker (CRK Phase 19: CRK-P19-T01)
 *
 * Implements structural chunking (article -> lead -> heading -> subsection),
 * cleans navigational/template noise, and preserves provenance and section anchors.
 */

import { WikipediaArticle, WikipediaSectionChunk } from '../../types/general-knowledge';

export interface RawWikipediaArticleInput {
  articleId: string;
  title: string;
  canonicalTitle?: string;
  language?: string;
  revisionId: string;
  sourceUrl: string;
  rawWikitextOrMarkdown: string;
  wikidataEntityId?: string;
  categories?: string[];
  redirects?: string[];
  lastModified?: string;
}

export class WikipediaChunker {
  private static readonly NOISE_PATTERNS = [
    /\{\{[^{}]*\}\}/g, // Templates {{...}}
    /\{\|[^{}]*\|\}/g, // Wikitables / infoboxes {|...|}
    /\[\[Category:[^\]]+\]\]/gi, // Category tags
    /\[\[File:[^\]]+\]\]/gi, // File embeds
    /\[\[Image:[^\]]+\]\]/gi, // Image embeds
    /\[edit\]/gi, // [edit] link markers
    /\[\d+\]/g, // Citation footnote tags [1], [2], etc.
    /<!--[\s\S]*?-->/g, // HTML comments
    /<ref[\s\S]*?<\/ref>/gi, // Inline ref blocks
    /<ref[^>]*\/>/gi, // Self-closing ref tags
  ];

  private static readonly EXCLUDED_SECTIONS = new Set([
    'see also',
    'references',
    'external links',
    'further reading',
    'notes',
    'sources',
    'bibliography',
    'navigation',
  ]);

  /**
   * Cleans raw text of navigational and template noise (§3091)
   */
  public cleanText(text: string): string {
    let cleaned = text;
    for (const pattern of WikipediaChunker.NOISE_PATTERNS) {
      cleaned = cleaned.replace(pattern, ' ');
    }
    // Clean remaining internal links [[target|display]] -> display, or [[target]] -> target
    cleaned = cleaned.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');
    // Normalize excessive whitespace
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  /**
   * Chunks a Wikipedia article into structured sections (§3075-3091)
   */
  public chunkArticle(input: RawWikipediaArticleInput): WikipediaArticle {
    const lines = input.rawWikitextOrMarkdown.split(/\r?\n/);
    const sections: WikipediaSectionChunk[] = [];
    const language = input.language || 'en';

    let currentSectionTitle = 'Lead';
    let currentLevel = 1;
    let currentLines: string[] = [];
    let isLead = true;

    const finalizeSection = (index: number) => {
      const rawText = currentLines.join('\n');
      const cleanContent = this.cleanText(rawText);

      if (cleanContent.length > 0) {
        const anchor = this.generateAnchor(currentSectionTitle);
        const chunkId = `${input.articleId}#${anchor || `sec-${index}`}`;
        const sourceUrl = anchor ? `${input.sourceUrl}#${anchor}` : input.sourceUrl;

        sections.push({
          chunkId,
          articleId: input.articleId,
          articleTitle: input.title,
          canonicalTitle: input.canonicalTitle || input.title.replace(/\s+/g, '_'),
          sectionTitle: currentSectionTitle,
          sectionAnchor: anchor,
          sectionLevel: currentLevel,
          leadParagraph: isLead,
          content: cleanContent,
          wordCount: cleanContent.split(/\s+/).filter(Boolean).length,
          language,
          sourceUrl,
          revisionId: input.revisionId,
          wikidataEntityId: input.wikidataEntityId,
          authority: 0.67,
          extractedAt: new Date().toISOString(),
        });
      }
    };

    let sectionIndex = 0;

    for (const line of lines) {
      // Match markdown ## or Wikitext == headers
      const wikiHeaderMatch = line.match(/^(=+)\s*(.*?)\s*\1$/);
      const mdHeaderMatch = line.match(/^(#{2,6})\s+(.*)$/);

      if (wikiHeaderMatch || mdHeaderMatch) {
        finalizeSection(sectionIndex++);
        isLead = false;

        if (wikiHeaderMatch) {
          currentLevel = wikiHeaderMatch[1].length;
          currentSectionTitle = wikiHeaderMatch[2].trim();
        } else if (mdHeaderMatch) {
          currentLevel = mdHeaderMatch[1].length;
          currentSectionTitle = mdHeaderMatch[2].trim();
        }

        // Check if section is excluded
        const normalizedTitle = currentSectionTitle.toLowerCase();
        if (WikipediaChunker.EXCLUDED_SECTIONS.has(normalizedTitle)) {
          currentLines = [];
        } else {
          currentLines = [];
        }
      } else {
        const normalizedTitle = currentSectionTitle.toLowerCase();
        if (!WikipediaChunker.EXCLUDED_SECTIONS.has(normalizedTitle)) {
          currentLines.push(line);
        }
      }
    }

    // Finalize the last section
    finalizeSection(sectionIndex);

    // Extract article summary from lead section if available
    const leadChunk = sections.find((s) => s.leadParagraph);
    const summary = leadChunk ? leadChunk.content.slice(0, 300) : '';

    return {
      articleId: input.articleId,
      title: input.title,
      canonicalTitle: input.canonicalTitle || input.title.replace(/\s+/g, '_'),
      language,
      namespace: 'main',
      revisionId: input.revisionId,
      sourceUrl: input.sourceUrl,
      wikidataEntityId: input.wikidataEntityId,
      summary,
      sections,
      categories: input.categories || [],
      redirects: input.redirects || [],
      lastModified: input.lastModified,
    };
  }

  private generateAnchor(title: string): string {
    if (title.toLowerCase() === 'lead') return '';
    return title.replace(/\s+/g, '_');
  }
}
