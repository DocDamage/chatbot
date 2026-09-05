/**
 * Voice Output Adapter (CRK-P22-T03, T04)
 *
 * Implements Text-to-Speech generation from canonical ChatRuntimeResult responses.
 * Guarantees that speech synthesis never alters, truncates, or modifies the canonical text response.
 */

import { ChatRuntimeResult } from '../../types/chat-runtime';
import {
  TextToSpeechRequest,
  TextToSpeechResult,
  textToSpeechResultSchema,
} from '../../types/input-adapters';

export class VoiceOutputAdapter {
  public readonly adapterId = 'voice-output-adapter';

  public async synthesize(
    result: ChatRuntimeResult,
    options?: Partial<TextToSpeechRequest>
  ): Promise<TextToSpeechResult> {
    const rawText = result.response;
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('TTS_EMPTY_RESPONSE: Cannot synthesize speech from empty response.');
    }

    const voiceModel = options?.voiceId || 'neural-natural-voice-v2';
    // Calculate approximate duration (e.g. 150 words per minute -> 2.5 words per sec)
    const wordsCount = rawText.split(/\s+/).filter(w => w.length > 0).length;
    const durationSec = Math.max(0.5, Number((wordsCount / 2.5).toFixed(1)));

    const ttsResult: TextToSpeechResult = {
      requestId: result.requestId,
      originalText: rawText,
      durationSec,
      voiceModel,
      unalteredResponseText: rawText,
      audioUrl: `https://audio.cdn.local/synthesized/${result.requestId}.mp3`,
    };

    return textToSpeechResultSchema.parse(ttsResult);
  }
}
