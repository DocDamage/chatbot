import {
  voiceInputPayloadSchema,
  textToSpeechResultSchema,
  integrationMessagePayloadSchema,
} from './input-adapters';

describe('input-adapters schemas', () => {
  it('validates voice input payload and privacy constraints', () => {
    const payload = {
      sessionId: 'sess-123',
      microphoneConsent: true,
      transcript: 'Hello assistant',
      sttMetadata: {
        sttProvider: 'whisper',
        sttModel: 'whisper-large-v3',
        confidence: 0.98,
        rawTranscript: 'Hello assistant',
        userEdited: false,
      },
    };
    const parsed = voiceInputPayloadSchema.parse(payload);
    expect(parsed.microphoneConsent).toBe(true);
    expect(parsed.privacyPolicy.retainAudio).toBe(false);
  });

  it('validates text to speech result schema with unaltered text guarantee', () => {
    const tts = {
      requestId: 'req-456',
      originalText: 'Here is your answer.',
      durationSec: 1.8,
      voiceModel: 'tts-1-hd',
      unalteredResponseText: 'Here is your answer.',
    };
    const parsed = textToSpeechResultSchema.parse(tts);
    expect(parsed.unalteredResponseText).toBe(parsed.originalText);
  });

  it('validates integration message schema', () => {
    const msg = {
      sourceSystem: 'slack',
      externalMessageId: 'msg-999',
      senderId: 'user-77',
      channelId: 'proj-engineering',
      content: 'Can you debug this bug?',
    };
    const parsed = integrationMessagePayloadSchema.parse(msg);
    expect(parsed.sourceSystem).toBe('slack');
  });
});
