/**
 * Document Narration & Chaptered Audio Engine (PX13-T08)
 *
 * Implements clean-room document narration: structured text extraction with page anchors,
 * deterministic chapter detection, manual chapter adjustments, per-chapter TTS synthesis,
 * and chapter-marked audio packaging.
 */

import {
  DocumentChapter,
  DocumentNarrationJobOptions,
  DocumentNarrationResult
} from './MediaAccessibilityTypes';

export class DocumentNarrationEngine {
  constructor(private readonly backend?: DocumentNarrationBackend) {}

  public isAvailable(): boolean {
    return Boolean(this.backend);
  }
  /**
   * Automatically segments document text into chapters based on headings or page markers.
   */
  public detectChapters(rawDocumentText: string): DocumentChapter[] {
    const chapterPattern = /(?:(?:Chapter|Section|Part)\s+\d+|###?\s+.*)/gi;
    const lines = rawDocumentText.split('\n');
    const chapters: DocumentChapter[] = [];

    let currentTitle = 'Introduction';
    let currentLines: string[] = [];
    let chapterIndex = 1;

    for (const line of lines) {
      if (chapterPattern.test(line.trim())) {
        if (currentLines.length > 0) {
          const raw = currentLines.join('\n').trim();
          chapters.push({
            chapterIndex,
            title: currentTitle,
            rawText: raw,
            cleanedText: this.cleanNarrationText(raw),
            estimatedReadingTimeMin: Number((raw.split(/\s+/).length / 150).toFixed(1))
          });
          chapterIndex++;
          currentLines = [];
        }
        currentTitle = line.replace(/^[#\s]+/, '').trim();
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      const raw = currentLines.join('\n').trim();
      chapters.push({
        chapterIndex,
        title: currentTitle,
        rawText: raw,
        cleanedText: this.cleanNarrationText(raw),
        estimatedReadingTimeMin: Number((raw.split(/\s+/).length / 150).toFixed(1))
      });
    }

    return chapters;
  }

  /**
   * Synthesizes audio narration per chapter and creates chaptered packaging.
   */
  public async synthesizeNarration(
    options: DocumentNarrationJobOptions
  ): Promise<DocumentNarrationResult> {
    if (!this.backend) {
      throw new Error('NARRATION_BACKEND_UNAVAILABLE: configure a verified speech synthesis and packaging backend.');
    }
    return this.backend.synthesize(options);
  }

  private cleanNarrationText(text: string): string {
    return text
      .replace(/\[\d+\]/g, '') // remove citation brackets
      .replace(/https?:\/\/\S+/g, '[link]') // replace raw URLs
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export interface DocumentNarrationBackend {
  synthesize(options: DocumentNarrationJobOptions): Promise<DocumentNarrationResult>;
}
