/**
 * Translation Variant Service (PX13-T05)
 *
 * Implements multi-language translation variant tracks, glossary lock rules,
 * subtitle reading speed (characters per second) validation, and line-length constraints
 * without overwriting the primary source cues.
 */

import { SubtitleCue } from './MediaAccessibilityTypes';

export interface TranslationVariantOptions {
  targetLanguage: string;
  sourceCues: SubtitleCue[];
  glossary?: Record<string, string>; // e.g. { "ChatBot": "ChatBot", "API": "API" }
  maxCharsPerLine?: number; // e.g. 42 chars
  maxCps?: number; // Characters per second (e.g. 20 cps)
}

export interface SubtitleTranslationBackend {
  translate(text: string, targetLanguage: string): Promise<string>;
}

export class TranslationVariantService {
  constructor(private readonly backend?: SubtitleTranslationBackend) {}

  public isAvailable(): boolean {
    return Boolean(this.backend);
  }

  /**
   * Generates translated variant cues while preserving cue timing windows.
   */
  public async generateVariant(options: TranslationVariantOptions): Promise<{
    variantCues: SubtitleCue[];
    warnings: string[];
    language: string;
  }> {
    const warnings: string[] = [];
    const maxChars = options.maxCharsPerLine || 42;
    const maxCps = options.maxCps || 20;

    if (!this.backend) {
      throw new Error('TRANSLATION_BACKEND_UNAVAILABLE: configure a verified translation provider before generating subtitle variants.');
    }

    const variantCues: SubtitleCue[] = [];
    for (const cue of options.sourceCues) {
      let translatedText = await this.backend.translate(cue.text, options.targetLanguage);

      // Apply glossary locks
      if (options.glossary) {
        for (const [orig, locked] of Object.entries(options.glossary)) {
          const regex = new RegExp(`\\b${orig}\\b`, 'gi');
          translatedText = translatedText.replace(regex, locked);
        }
      }

      // Check line length constraint
      if (translatedText.length > maxChars * 2) {
        warnings.push(`Cue #${cue.index} exceeds max reading length (${translatedText.length} chars).`);
      }

      // Check reading speed (CPS)
      const duration = Math.max(0.1, cue.endSec - cue.startSec);
      const cps = translatedText.length / duration;
      if (cps > maxCps) {
        warnings.push(`Cue #${cue.index} reading speed too fast (${cps.toFixed(1)} CPS > max ${maxCps} CPS).`);
      }

      variantCues.push({
        ...cue,
        id: `var-${options.targetLanguage}-${cue.id}`,
        text: translatedText
      });
    }

    return {
      variantCues,
      warnings,
      language: options.targetLanguage
    };
  }

}
