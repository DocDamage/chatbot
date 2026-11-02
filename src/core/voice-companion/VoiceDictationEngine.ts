/**
 * Voice Dictation Engine (PX12-T05)
 *
 * Implements dictation processing: raw transcription, punctuation cleanup,
 * target language translation, instruction-mode drafting, and clipboard paste preview.
 */

import crypto from 'node:crypto';
import { LocalSTTProvider } from './LocalSTTProvider';
import { DictationRequest, DictationResult, DictationMode } from './VoiceCompanionTypes';

export interface DictationTransformationBackend {
  transform(input: { mode: DictationMode; text: string; targetLanguage?: string; instructionPrompt?: string }): Promise<string>;
}

export class VoiceDictationEngine {
  private sttProvider: LocalSTTProvider;
  private readonly transformer?: DictationTransformationBackend;

  constructor(sttProvider?: LocalSTTProvider, transformer?: DictationTransformationBackend) {
    this.sttProvider = sttProvider || new LocalSTTProvider();
    this.transformer = transformer;
  }

  public async processDictation(request: DictationRequest): Promise<DictationResult> {
    const sttResult = await this.sttProvider.transcribe(request.audioBuffer, {
      wordTimestamps: true
    });

    const rawText = sttResult.text.trim();
    let processedText = rawText;

    switch (request.mode) {
      case 'raw_transcription':
        processedText = rawText;
        break;

      case 'cleanup_punctuation':
        processedText = this.cleanupAndPunctuate(rawText);
        break;

      case 'translate':
        processedText = await this.transform('translate', rawText, request);
        break;

      case 'instruction_draft':
        processedText = await this.transform('instruction_draft', rawText, request);
        break;

      case 'code_draft':
        processedText = await this.transform('code_draft', rawText, request);
        break;

      default:
        processedText = rawText;
    }

    const digest = crypto
      .createHash('sha256')
      .update(`${request.mode}:${rawText}:${processedText}`)
      .digest('hex')
      .substring(0, 16);

    return {
      rawText,
      processedText,
      mode: request.mode,
      targetLanguage: request.targetLanguage,
      confidence: sttResult.confidence,
      requiresPasteConfirmation: !request.autoPasteConsent,
      digest
    };
  }

  private cleanupAndPunctuate(text: string): string {
    if (!text) return '';
    let cleaned = text
      .replace(/\s+/g, ' ')
      .trim();

    // Capitalize first letter
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

    // Ensure ending period
    if (!/[.!?]$/.test(cleaned)) {
      cleaned += '.';
    }
    return cleaned;
  }

  private async transform(mode: DictationMode, text: string, request: DictationRequest): Promise<string> {
    if (!this.transformer) {
      throw new Error(`DICTATION_TRANSFORM_BACKEND_UNAVAILABLE: ${mode} requires a configured model-backed transformer.`);
    }
    return this.transformer.transform({
      mode,
      text,
      targetLanguage: request.targetLanguage,
      instructionPrompt: request.instructionPrompt
    });
  }
}
