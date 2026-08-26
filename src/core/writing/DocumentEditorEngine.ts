/**
 * Document Editor Engine (PX14-T03)
 *
 * Implements AST parsing, outline generation, readability metrics, and text operations.
 */

import { CanonicalDocumentModel } from './CanonicalDocumentModel';
import { DocumentOutline, HeadingItem, TextRange } from './WritingTypes';

export interface ASTNode {
  type:
    | 'heading'
    | 'paragraph'
    | 'code_block'
    | 'inline_code'
    | 'blockquote'
    | 'callout'
    | 'list_item'
    | 'task_item'
    | 'table'
    | 'horizontal_rule'
    | 'footnote'
    | 'math_block'
    | 'inline_math'
    | 'raw_text';
  text: string;
  range: TextRange;
  level?: number;
  checked?: boolean;
  calloutType?: string;
  language?: string;
  children?: ASTNode[];
}

export class DocumentEditorEngine {
  /**
   * Parses raw markdown text into an AST preserving all ranges.
   */
  public parseAST(rawText: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    const lines = rawText.split(/\r?\n/);
    let currentOffset = 0;
    let inCodeBlock = false;
    let codeBlockStartOffset = 0;
    let codeBlockLanguage = '';
    let codeBlockContent: string[] = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineStartOffset = currentOffset;
      const lineEndOffset = lineStartOffset + line.length;
      const lineNum = lineIdx + 1;

      // Check fenced code block
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockStartOffset = lineStartOffset;
          codeBlockLanguage = line.trim().substring(3).trim();
          codeBlockContent = [];
        } else {
          inCodeBlock = false;
          const blockEndOffset = lineEndOffset;
          nodes.push({
            type: 'code_block',
            text: codeBlockContent.join('\n'),
            language: codeBlockLanguage,
            range: CanonicalDocumentModel.offsetToRange(rawText, codeBlockStartOffset, blockEndOffset)
          });
        }
        currentOffset += line.length + 1; // +1 for newline
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        currentOffset += line.length + 1;
        continue;
      }

      const trimmed = line.trim();

      // Heading: #, ##, etc.
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        nodes.push({
          type: 'heading',
          text,
          level,
          range: CanonicalDocumentModel.offsetToRange(rawText, lineStartOffset, lineEndOffset)
        });
        currentOffset += line.length + 1;
        continue;
      }

      // Callout: > [!NOTE], > [!WARNING], etc.
      const calloutMatch = line.match(/^>\s*\[!([A-Z]+)\]\s*(.*)$/);
      if (calloutMatch) {
        nodes.push({
          type: 'callout',
          calloutType: calloutMatch[1],
          text: calloutMatch[2],
          range: CanonicalDocumentModel.offsetToRange(rawText, lineStartOffset, lineEndOffset)
        });
        currentOffset += line.length + 1;
        continue;
      }

      // Blockquote: > ...
      if (line.startsWith('>')) {
        nodes.push({
          type: 'blockquote',
          text: line.replace(/^>\s*/, ''),
          range: CanonicalDocumentModel.offsetToRange(rawText, lineStartOffset, lineEndOffset)
        });
        currentOffset += line.length + 1;
        continue;
      }

      // Task item: - [x] or - [ ]
      const taskMatch = line.match(/^(\s*[-*+])\s+\[([ xX])\]\s+(.*)$/);
      if (taskMatch) {
        nodes.push({
          type: 'task_item',
          checked: taskMatch[2].toLowerCase() === 'x',
          text: taskMatch[3],
          range: CanonicalDocumentModel.offsetToRange(rawText, lineStartOffset, lineEndOffset)
        });
        currentOffset += line.length + 1;
        continue;
      }

      // List item: - or * or 1.
      const listMatch = line.match(/^(\s*(?:[-*+]|\d+\.))\s+(.*)$/);
      if (listMatch) {
        nodes.push({
          type: 'list_item',
          text: listMatch[2],
          range: CanonicalDocumentModel.offsetToRange(rawText, lineStartOffset, lineEndOffset)
        });
        currentOffset += line.length + 1;
        continue;
      }

      // Math block: $$ ... $$
      if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 2) {
        nodes.push({
          type: 'math_block',
          text: trimmed.slice(2, -2).trim(),
          range: CanonicalDocumentModel.offsetToRange(rawText, lineStartOffset, lineEndOffset)
        });
        currentOffset += line.length + 1;
        continue;
      }

      // Horizontal rule: ---, ***, ___
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
        nodes.push({
          type: 'horizontal_rule',
          text: trimmed,
          range: CanonicalDocumentModel.offsetToRange(rawText, lineStartOffset, lineEndOffset)
        });
        currentOffset += line.length + 1;
        continue;
      }

      // Table line: | ... |
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        nodes.push({
          type: 'table',
          text: trimmed,
          range: CanonicalDocumentModel.offsetToRange(rawText, lineStartOffset, lineEndOffset)
        });
        currentOffset += line.length + 1;
        continue;
      }

      // Footnote: [^1]: ...
      const footnoteMatch = line.match(/^\[\^([^\]]+)\]:\s*(.*)$/);
      if (footnoteMatch) {
        nodes.push({
          type: 'footnote',
          text: footnoteMatch[2],
          range: CanonicalDocumentModel.offsetToRange(rawText, lineStartOffset, lineEndOffset)
        });
        currentOffset += line.length + 1;
        continue;
      }

      // General paragraph or blank line
      if (trimmed.length > 0) {
        nodes.push({
          type: 'paragraph',
          text: line,
          range: CanonicalDocumentModel.offsetToRange(rawText, lineStartOffset, lineEndOffset)
        });
      }

      currentOffset += line.length + 1;
    }

    return nodes;
  }

  /**
   * Generates document outline, reading statistics, and Flesch-Kincaid reading score.
   */
  public generateOutline(rawText: string): DocumentOutline {
    const nodes = this.parseAST(rawText);
    const headings: HeadingItem[] = [];

    for (const node of nodes) {
      if (node.type === 'heading') {
        const anchor = node.text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');
        headings.push({
          id: `heading-${headings.length + 1}`,
          level: node.level || 1,
          text: node.text,
          range: node.range,
          anchor
        });
      }
    }

    const words = rawText.match(/\b[A-Za-z0-9'-]+\b/g) || [];
    const totalWordCount = words.length;
    const totalCharacterCount = rawText.length;
    const estimatedReadingTimeMinutes = Math.max(1, Math.ceil(totalWordCount / 200));

    // Calculate sentences and syllables for Flesch-Kincaid Reading Ease
    const sentences = (rawText.match(/[.!?]+(\s+|$)/g) || []).length || 1;
    let totalSyllables = 0;
    for (const word of words) {
      totalSyllables += this.countSyllables(word);
    }

    // Flesch Reading Ease score = 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
    let fleschKincaidReadingEase = 100;
    if (totalWordCount > 0 && sentences > 0) {
      const score =
        206.835 -
        1.015 * (totalWordCount / sentences) -
        84.6 * (totalSyllables / totalWordCount);
      fleschKincaidReadingEase = Math.max(0, Math.min(100, Math.round(score * 10) / 10));
    }

    return {
      headings,
      totalWordCount,
      totalCharacterCount,
      estimatedReadingTimeMinutes,
      fleschKincaidReadingEase
    };
  }

  /**
   * Simple syllable counter heuristic.
   */
  private countSyllables(word: string): number {
    const w = word.toLowerCase().replace(/(?:[^laeiouy]|ed|es|e)$/, '').replace(/^y/, '');
    const syllables = w.match(/[aeiouy]{1,2}/g);
    return syllables ? Math.max(1, syllables.length) : 1;
  }

  /**
   * Finds occurrences of a string or pattern within raw text.
   */
  public findMatches(
    rawText: string,
    query: string,
    options: { matchCase?: boolean; wholeWord?: boolean; isRegex?: boolean } = {}
  ): TextRange[] {
    if (!query) return [];

    const results: TextRange[] = [];
    let pattern: RegExp;

    try {
      let regexStr = options.isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (options.wholeWord) {
        regexStr = `\\b${regexStr}\\b`;
      }
      const flags = options.matchCase ? 'g' : 'gi';
      pattern = new RegExp(regexStr, flags);
    } catch {
      return [];
    }

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(rawText)) !== null) {
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      results.push(CanonicalDocumentModel.offsetToRange(rawText, startOffset, endOffset));
    }

    return results;
  }

  /**
   * Replaces occurrences of query with replacement string.
   */
  public replaceAll(
    rawText: string,
    query: string,
    replacement: string,
    options: { matchCase?: boolean; wholeWord?: boolean; isRegex?: boolean } = {}
  ): { newText: string; count: number } {
    const matches = this.findMatches(rawText, query, options);
    if (matches.length === 0) {
      return { newText: rawText, count: 0 };
    }

    let regexStr = options.isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (options.wholeWord) regexStr = `\\b${regexStr}\\b`;
    const flags = options.matchCase ? 'g' : 'gi';
    const pattern = new RegExp(regexStr, flags);

    const newText = rawText.replace(pattern, replacement);
    return { newText, count: matches.length };
  }
}
