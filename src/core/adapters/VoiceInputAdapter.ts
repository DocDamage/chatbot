/**
 * Voice Input Adapter (CRK-P22-T01, T02, T04, T05)
 *
 * Implements the ChatInputAdapter contract for speech-to-text.
 * Enforces explicit microphone consent, records STT provider metadata separately,
 * handles transcript correction, and adheres to zero-retention audio privacy policies.
 */

import { randomUUID } from 'crypto';
import { NormalizedChatRequest } from '../../types/chat-runtime';
import {
  ChatInputAdapter,
  VoiceInputPayload,
  voiceInputPayloadSchema,
} from '../../types/input-adapters';
import { ChatRequestNormalizer } from '../chat/ChatRequestNormalizer';

export class VoiceInputAdapter implements ChatInputAdapter {
  public readonly adapterId = 'voice-input-adapter';
  public readonly channel = 'voice' as const;

  public async normalize(input: unknown): Promise<NormalizedChatRequest> {
    const parsed = voiceInputPayloadSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`INVALID_VOICE_INPUT: ${parsed.error.message}`);
    }

    const payload: VoiceInputPayload = parsed.data;

    if (!payload.microphoneConsent) {
      throw new Error('MICROPHONE_CONSENT_REQUIRED: Microphone access must be explicitly granted by user.');
    }

    // Process STT or extract preview/corrected transcript
    let messageText = payload.transcript?.trim() || '';
    if (!messageText && payload.audioBufferBase64) {
      // Mock STT translation if raw audio provided without transcript
      messageText = this.transcribeAudio(payload.audioBufferBase64);
    }

    if (!messageText) {
      throw new Error('STT_TRANSCRIPTION_FAILED: Unable to produce text from voice input.');
    }

    // Audio retention policy check: zero-retention cleans raw buffer
    if (!payload.privacyPolicy.retainAudio) {
      payload.audioBufferBase64 = undefined;
    }

    const requestId = `req-voice-${randomUUID().slice(0, 8)}`;

    return ChatRequestNormalizer.normalize({
      requestId,
      sessionId: payload.sessionId,
      userId: payload.userId,
      message: messageText,
      metadata: {
        entryChannel: 'voice',
        sttProvider: payload.sttMetadata?.sttProvider || 'internal-stt',
        sttModel: payload.sttMetadata?.sttModel || 'stt-whisper-default',
        sttConfidence: payload.sttMetadata?.confidence ?? 1.0,
        userEditedTranscript: payload.sttMetadata?.userEdited ?? false,
        audioRetained: payload.privacyPolicy.retainAudio,
      },
    });
  }

  private transcribeAudio(base64Data: string): string {
    if (base64Data.length < 10) {
      throw new Error('AUDIO_BUFFER_CORRUPTED');
    }
    // Simulation / stub for audio transcription decoding
    return 'Voice transcribed query';
  }
}
