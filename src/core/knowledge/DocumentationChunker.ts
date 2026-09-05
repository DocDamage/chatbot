/**
 * Semantic Documentation Chunker (CRK-P07-T04)
 *
 * Chunks technical documentation by semantic structure:
 * product -> version -> page -> heading -> subsection -> code/example.
 * Preserves heading hierarchy, code blocks, API symbol names, anchors, version,
 * and deprecation notes without splitting signatures from parameter descriptions.
 */

import { OfficialDocChunk } from '../../types/official-docs';

export interface DocChunkInput {
  product: string;
  version: string;
  page: string;
  markdownContent: string;
}

export class DocumentationChunker {
  /**
   * Chunk markdown document into semantic chunks preserving structure
   */
  public chunkDocument(input: DocChunkInput): OfficialDocChunk[] {
    const { product, version, page, markdownContent } = input;
    const lines = markdownContent.split('\n');
    const chunks: OfficialDocChunk[] = [];

    let currentHeadingHierarchy: string[] = [];
    let currentSubsection = '';
    let currentContentLines: string[] = [];
    let currentCodeBlocks: string[] = [];
    let currentSymbols: Set<string> = new Set();
    let currentAnchors: Set<string> = new Set();
    let currentDeprecations: Set<string> = new Set();

    let inCodeBlock = false;
    let codeBlockBuffer: string[] = [];
    let chunkSeq = 0;

    const flushChunk = () => {
      const fullContent = currentContentLines.join('\n').trim();
      if (!fullContent && currentCodeBlocks.length === 0) return;

      chunkSeq += 1;
      const chunkId = `${product}-${version}-${page}-${chunkSeq}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

      // Include symbols from current heading hierarchy
      for (const h of currentHeadingHierarchy) {
        this.extractSymbolsFromLine(h, currentSymbols);
      }

      chunks.push({
        id: chunkId,
        product,
        version,
        page,
        headingHierarchy: [...currentHeadingHierarchy],
        subsection: currentSubsection || (currentHeadingHierarchy[currentHeadingHierarchy.length - 1] ?? page),
        content: fullContent,
        codeExamples: [...currentCodeBlocks],
        apiSymbols: Array.from(currentSymbols),
        anchors: Array.from(currentAnchors),
        deprecationNotes: Array.from(currentDeprecations),
        tokenCount: Math.ceil(fullContent.split(/\s+/).filter(Boolean).length * 1.3),
      });

      currentContentLines = [];
      currentCodeBlocks = [];
      currentSymbols = new Set();
      currentAnchors = new Set();
      currentDeprecations = new Set();
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (!inCodeBlock) {
          const code = codeBlockBuffer.join('\n');
          currentCodeBlocks.push(code);
          codeBlockBuffer = [];
        }
        currentContentLines.push(line);
        continue;
      }

      if (inCodeBlock) {
        codeBlockBuffer.push(line);
        currentContentLines.push(line);
        this.extractSymbolsFromLine(line, currentSymbols);
        continue;
      }

      // Check for markdown headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();
        const anchor = '#' + title.toLowerCase().replace(/[^\w-]/g, '-');

        // Heading 1 or 2 with existing content initiates a new semantic chunk
        if (level <= 3 && currentContentLines.length > 0) {
          flushChunk();
        }

        // Adjust heading hierarchy based on depth
        currentHeadingHierarchy = currentHeadingHierarchy.slice(0, level - 1);
        currentHeadingHierarchy[level - 1] = title;
        currentSubsection = title;
        currentAnchors.add(anchor);
        this.extractSymbolsFromLine(title, currentSymbols);
      }

      // Detect deprecation notes
      if (/deprecated/i.test(trimmed) && (trimmed.startsWith('>') || trimmed.startsWith('*') || trimmed.includes('@deprecated'))) {
        currentDeprecations.add(trimmed);
      }

      this.extractSymbolsFromLine(line, currentSymbols);
      currentContentLines.push(line);
    }

    flushChunk();
    return chunks;
  }

  private extractSymbolsFromLine(line: string, set: Set<string>): void {
    // Match function/class keywords, backticked identifiers, and PascalCase identifiers
    const symbolMatches = [
      /(?:function|class|interface|type|fn|def|func|struct|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g,
      /`([A-Za-z_][A-Za-z0-9_]*(?:\(\))?)`/g,
      /\b([A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*)\b/g, // PascalCase symbols like CharacterBody2D, KinematicBody2D
    ];

    for (const regex of symbolMatches) {
      let m: RegExpExecArray | null;
      while ((m = regex.exec(line)) !== null) {
        const sym = m[1].replace('()', '');
        if (sym.length > 1 && !['const', 'let', 'var', 'public', 'private', 'return'].includes(sym)) {
          set.add(sym);
        }
      }
    }
  }
}
