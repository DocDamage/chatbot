import { ChatInputAdapterFactory } from '../ChatInputAdapterFactory';
import { VoiceInputAdapter } from '../VoiceInputAdapter';
import { VoiceOutputAdapter } from '../VoiceOutputAdapter';
import { ChatRuntimeResult } from '../../../types/chat-runtime';

describe('Phase 22: Voice and External Input/Output Adapters', () => {
  describe('VoiceInputAdapter', () => {
    it('rejects input without explicit microphone consent', async () => {
      const adapter = new VoiceInputAdapter();
      await expect(
        adapter.normalize({
          sessionId: 'sess-1',
          microphoneConsent: false,
          transcript: 'Hello voice',
        })
      ).rejects.toThrow('MICROPHONE_CONSENT_REQUIRED');
    });

    it('normalizes voice input and stores STT metadata separately', async () => {
      const adapter = new VoiceInputAdapter();
      const normalized = await adapter.normalize({
        sessionId: 'sess-voice-123',
        userId: 'user-voice-456',
        microphoneConsent: true,
        transcript: 'How do I write a binary search in TypeScript?',
        sttMetadata: {
          sttProvider: 'openai-whisper',
          sttModel: 'whisper-large-v3',
          confidence: 0.97,
          rawTranscript: 'How do I write a binary search in TypeScript?',
          userEdited: false,
        },
        privacyPolicy: {
          retainAudio: false,
          retentionTtlSeconds: 0,
          allowServerSideStorage: false,
        },
      });

      expect(normalized.sessionId).toBe('sess-voice-123');
      expect(normalized.message).toBe('How do I write a binary search in TypeScript?');
      expect(normalized.metadata.entryChannel).toBe('voice');
      expect(normalized.metadata.sttProvider).toBe('openai-whisper');
      expect(normalized.metadata.sttModel).toBe('whisper-large-v3');
      expect(normalized.metadata.audioRetained).toBe(false);
    });
  });

  describe('ChatInputAdapterFactory', () => {
    it('normalizes web input through WebTextInputAdapter', async () => {
      const adapter = ChatInputAdapterFactory.getAdapter('web');
      const req = await adapter.normalize({
        sessionId: 'sess-web-1',
        message: 'Hello from web',
      });
      expect(req.sessionId).toBe('sess-web-1');
      expect(req.message).toBe('Hello from web');
    });

    it('normalizes integration message from external system', async () => {
      const adapter = ChatInputAdapterFactory.getAdapter('integration');
      const req = await adapter.normalize({
        sourceSystem: 'github-webhook',
        externalMessageId: 'evt-1002',
        senderId: 'octocat',
        channelId: 'repo-issues',
        content: 'Review pull request #42',
      });
      expect(req.sessionId).toBe('sess-integ-repo-issues');
      expect(req.userId).toBe('octocat');
      expect(req.message).toBe('Review pull request #42');
      expect(req.metadata.sourceSystem).toBe('github-webhook');
    });

    it('normalizes desktop companion input', async () => {
      const adapter = ChatInputAdapterFactory.getAdapter('desktop_companion');
      const req = await adapter.normalize({
        sessionId: 'sess-companion-1',
        message: 'Focus mode command',
        companionVersion: '2.4.0',
      });
      expect(req.message).toBe('Focus mode command');
      expect(req.metadata.companionAppVersion).toBe('2.4.0');
    });
  });

  describe('VoiceOutputAdapter', () => {
    it('synthesizes speech without altering or modifying the canonical response', async () => {
      const adapter = new VoiceOutputAdapter();
      const mockResult: ChatRuntimeResult = {
        requestId: 'req-audio-test-1',
        traceId: 'tr-audio-test-1',
        response: 'Binary search operates in logarithmic O(log n) time complexity.',
        model: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet',
          policy: 'balanced',
          fallbackUsed: false,
        },
        grounding: { attempted: false, sufficient: true },
        citations: [],
        toolResults: [],
        warnings: [],
        latencyMs: 320,
      };

      const tts = await adapter.synthesize(mockResult);
      expect(tts.requestId).toBe('req-audio-test-1');
      expect(tts.unalteredResponseText).toBe(mockResult.response);
      expect(tts.originalText).toBe(mockResult.response);
      expect(tts.durationSec).toBeGreaterThan(0);
      expect(tts.audioUrl).toBeDefined();
    });

    it('rejects empty response', async () => {
      const adapter = new VoiceOutputAdapter();
      const emptyResult = {
        requestId: 'req-audio-test-2',
        response: '   ',
        model: { provider: 'test', model: 'test', policy: 'default', fallbackUsed: false },
        citations: [],
        toolResults: [],
        warnings: [],
        latencyMs: 10,
      };
      await expect(adapter.synthesize(emptyResult as any)).rejects.toThrow('TTS_EMPTY_RESPONSE');
    });
  });
});
