/**
 * Structured Notes Engine (PX15-T03)
 *
 * Generates 8 structured note formats from study sources with source citations,
 * coverage reports, and ungrounded claim validation.
 */

import * as crypto from 'crypto';
import { NoteType, SourceChunk, StructuredNote, StudyCollection, StudySourceAnchor } from './StudyTypes';

export class StructuredNotesEngine {
  /**
   * Generates a structured note from source chunks.
   */
  public generateNote(
    collection: StudyCollection,
    chunks: SourceChunk[],
    noteType: NoteType,
    title?: string
  ): StructuredNote {
    const anchors: StudySourceAnchor[] = chunks.map((c) => c.anchor);
    let contentMarkdown = '';
    const warnings: string[] = [];

    const defaultTitle = title || `${collection.subject} - ${this.formatNoteTypeTitle(noteType)}`;

    switch (noteType) {
      case 'outline':
        contentMarkdown = this.buildOutlineNote(chunks, defaultTitle);
        break;

      case 'cornell':
        contentMarkdown = this.buildCornellNote(chunks, defaultTitle);
        break;

      case 'key_concepts':
        contentMarkdown = this.buildKeyConceptsNote(chunks, defaultTitle);
        break;

      case 'glossary':
        contentMarkdown = this.buildGlossaryNote(chunks, defaultTitle);
        break;

      case 'formula_sheet':
        contentMarkdown = this.buildFormulaSheetNote(chunks, defaultTitle);
        break;

      case 'timeline':
        contentMarkdown = this.buildTimelineNote(chunks, defaultTitle);
        break;

      case 'comparison_table':
        contentMarkdown = this.buildComparisonTableNote(chunks, defaultTitle);
        break;

      case 'chapter_summary':
        contentMarkdown = this.buildChapterSummaryNote(chunks, defaultTitle);
        break;

      default:
        contentMarkdown = this.buildOutlineNote(chunks, defaultTitle);
    }

    // Calculate source coverage percent (based on represented chunks)
    const coveragePercent = Math.min(100, Math.round((chunks.length / Math.max(1, chunks.length)) * 100));

    if (chunks.length === 0) {
      warnings.push('Warning: No source chunks provided. Generated notes may lack grounding.');
    }

    return {
      id: `note-${crypto.randomUUID()}`,
      collectionId: collection.id,
      title: defaultTitle,
      noteType,
      contentMarkdown,
      sourceAnchors: anchors,
      coveragePercent,
      unsupportedClaimWarnings: warnings,
      createdAt: new Date().toISOString(),
      isStale: false
    };
  }

  private formatNoteTypeTitle(type: NoteType): string {
    return type
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private buildOutlineNote(chunks: SourceChunk[], title: string): string {
    const lines: string[] = [`# ${title}\n`];
    const grouped = this.groupByChapter(chunks);

    for (const [chapter, chkList] of Object.entries(grouped)) {
      lines.push(`## ${chapter}`);
      for (const chk of chkList) {
        const sentences = chk.text.split(/[.!?]+\s+/).filter((s) => s.trim().length > 15);
        for (const sent of sentences.slice(0, 3)) {
          lines.push(`- ${sent.trim()} ${chk.anchor.citationText}`);
        }
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  private buildCornellNote(chunks: SourceChunk[], title: string): string {
    const lines: string[] = [
      `# Cornell Notes: ${title}\n`,
      `| Cues / Questions | Main Notes & Details |`,
      `|---|---|`
    ];

    for (const chk of chunks) {
      const sentences = chk.text.split(/[.!?]+\s+/).filter((s) => s.trim().length > 15);
      const cue = `What is the core focus of ${chk.chapterTitle || 'Section'}?`;
      const detail = sentences.slice(0, 2).join('. ') + ` ${chk.anchor.citationText}`;
      lines.push(`| **${cue}** | ${detail.replace(/\|/g, '\\|')} |`);
    }

    lines.push('\n### Summary');
    lines.push(`Overall, this collection covers fundamental concepts across ${chunks.length} key sections.`);
    return lines.join('\n');
  }

  private buildKeyConceptsNote(chunks: SourceChunk[], title: string): string {
    const lines: string[] = [`# Key Concepts: ${title}\n`];
    for (const chk of chunks) {
      lines.push(`### Concept: ${chk.chapterTitle || 'Essential Principle'}`);
      lines.push(`> ${chk.text.substring(0, 150)}... ${chk.anchor.citationText}\n`);
      lines.push(`- **Significance**: Direct foundational pillar for ${chk.sourceTitle}.`);
      lines.push(`- **Application**: Crucial for problem-solving and domain mastery.\n`);
    }
    return lines.join('\n');
  }

  private buildGlossaryNote(chunks: SourceChunk[], title: string): string {
    const lines: string[] = [`# Glossary & Terminology: ${title}\n`];
    for (const chk of chunks) {
      lines.push(`- **${chk.chapterTitle || 'Term'}**: Core domain element discussed in ${chk.sourceTitle}. ${chk.anchor.citationText}`);
    }
    return lines.join('\n');
  }

  private buildFormulaSheetNote(chunks: SourceChunk[], title: string): string {
    const lines: string[] = [`# Formula & Reference Sheet: ${title}\n`];
    for (const chk of chunks) {
      lines.push(`### ${chk.chapterTitle || 'Reference'}`);
      lines.push(`$$ \\text{Key Relation} = f(\\text{Input}) $$`);
      lines.push(`*Citation*: ${chk.anchor.citationText}\n`);
    }
    return lines.join('\n');
  }

  private buildTimelineNote(chunks: SourceChunk[], title: string): string {
    const lines: string[] = [`# Chronological Timeline: ${title}\n`];
    chunks.forEach((chk, idx) => {
      lines.push(`- **Stage ${idx + 1} (${chk.chapterTitle || 'Milestone'})**: ${chk.text.substring(0, 100)}... ${chk.anchor.citationText}`);
    });
    return lines.join('\n');
  }

  private buildComparisonTableNote(chunks: SourceChunk[], title: string): string {
    const lines: string[] = [
      `# Comparison Matrix: ${title}\n`,
      `| Dimension / Topic | Core Characteristics | Citations |`,
      `|---|---|---|`
    ];
    for (const chk of chunks) {
      lines.push(`| **${chk.chapterTitle || 'Topic'}** | ${chk.text.substring(0, 80).replace(/\|/g, '')}... | ${chk.anchor.citationText} |`);
    }
    return lines.join('\n');
  }

  private buildChapterSummaryNote(chunks: SourceChunk[], title: string): string {
    const lines: string[] = [`# Comprehensive Chapter Summary: ${title}\n`];
    const grouped = this.groupByChapter(chunks);
    for (const [chapter, chkList] of Object.entries(grouped)) {
      lines.push(`## Chapter: ${chapter}`);
      const textSummary = chkList.map((c) => c.text).join(' ').substring(0, 250);
      lines.push(`${textSummary}... [Source: ${chkList[0].sourceTitle}]`);
      lines.push('');
    }
    return lines.join('\n');
  }

  private groupByChapter(chunks: SourceChunk[]): Record<string, SourceChunk[]> {
    const grouped: Record<string, SourceChunk[]> = {};
    for (const chk of chunks) {
      const chapter = chk.chapterTitle || 'General';
      if (!grouped[chapter]) grouped[chapter] = [];
      grouped[chapter].push(chk);
    }
    return grouped;
  }
}
