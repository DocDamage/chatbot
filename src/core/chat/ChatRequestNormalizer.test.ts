/**
 * Unit Tests for ChatRequestNormalizer (CRK-P01-T02)
 *
 * Verifies request normalization, security boundaries, context deduplication,
 * size constraints, and error reporting.
 */

import {
  ChatRequestNormalizer,
  ChatRequestNormalizationError,
} from './ChatRequestNormalizer';

describe('ChatRequestNormalizer (CRK-P01-T02)', () => {
  const minimalValid = {
    message: 'Hello, what is the status of the project?',
    sessionId: 'session-xyz-123',
  };

  describe('valid requests and defaults', () => {
    it('normalizes a minimal valid chat payload with canonical defaults', () => {
      const result = ChatRequestNormalizer.normalize(minimalValid);

      expect(result.message).toBe('Hello, what is the status of the project?');
      expect(result.sessionId).toBe('session-xyz-123');
      expect(result.requestId).toMatch(/^req_/);
      expect(result.botProfileId).toBe('default');
      expect(result.loadedFiles).toEqual([]);
      expect(result.loadedAudio).toEqual([]);
      expect(result.clientCapabilities).toEqual({
        streaming: false,
        citations: false,
        toolApproval: false,
      });
      expect(result.metadata).toEqual({});
      expect(result.userId).toBeUndefined();
      expect(result.activePlan).toBeUndefined();
    });

    it('works both via static method and instantiated normalizer', () => {
      const normalizer = new ChatRequestNormalizer();
      const result = normalizer.normalize(minimalValid);
      expect(result.message).toBe(minimalValid.message);
      expect(result.sessionId).toBe(minimalValid.sessionId);
    });

    it('preserves valid requestedModelPolicy and botProfileId', () => {
      const result = ChatRequestNormalizer.normalize({
        ...minimalValid,
        botProfileId: 'coding-assistant-v1',
        requestedModelPolicy: 'quality-first',
        mode: 'coding',
      });

      expect(result.botProfileId).toBe('coding-assistant-v1');
      expect(result.requestedModelPolicy).toBe('quality-first');
      expect(result.mode).toBe('coding');
    });
  });

  describe('message validation', () => {
    it('rejects empty message or whitespace-only message', () => {
      expect(() => {
        ChatRequestNormalizer.normalize({ ...minimalValid, message: '' });
      }).toThrow(ChatRequestNormalizationError);

      expect(() => {
        ChatRequestNormalizer.normalize({ ...minimalValid, message: '   \n  \t ' });
      }).toThrow(ChatRequestNormalizationError);
    });

    it('rejects non-string message', () => {
      expect(() => {
        ChatRequestNormalizer.normalize({ ...minimalValid, message: 12345 });
      }).toThrow(ChatRequestNormalizationError);
    });

    it('rejects overlong message exceeding maximum allowed length', () => {
      const overlong = 'A'.repeat(50001);
      expect(() => {
        ChatRequestNormalizer.normalize({ ...minimalValid, message: overlong });
      }).toThrow(ChatRequestNormalizationError);
    });

    it('preserves full Unicode, astral plane emojis, and international characters', () => {
      const unicodeMsg = '🚀 Test 🧑‍💻 日本語 🌍 한국어 \u{1F600} \u{1F916} 𝓒𝓸𝓭𝓮';
      const result = ChatRequestNormalizer.normalize({
        ...minimalValid,
        message: unicodeMsg,
      });
      expect(result.message).toBe(unicodeMsg);
    });
  });

  describe('session validation', () => {
    it('rejects missing or empty sessionId', () => {
      expect(() => {
        ChatRequestNormalizer.normalize({ message: 'Hello' });
      }).toThrow(ChatRequestNormalizationError);

      expect(() => {
        ChatRequestNormalizer.normalize({ message: 'Hello', sessionId: '   ' });
      }).toThrow(ChatRequestNormalizationError);
    });
  });

  describe('server context and security boundaries', () => {
    it('preserves auth identity from server context over client claims', () => {
      const result = ChatRequestNormalizer.normalize(
        {
          ...minimalValid,
          userId: 'client-claimed-attacker-id',
        },
        {
          userId: 'server-verified-user-456',
        }
      );

      expect(result.userId).toBe('server-verified-user-456');
    });

    it('falls back to sanitized client userId when server context has no userId', () => {
      const result = ChatRequestNormalizer.normalize({
        ...minimalValid,
        userId: 'client-user-789',
      });
      expect(result.userId).toBe('client-user-789');
    });

    it('uses serverContext.requestId when provided', () => {
      const result = ChatRequestNormalizer.normalize(minimalValid, {
        requestId: 'srv-req-001',
      });
      expect(result.requestId).toBe('srv-req-001');
    });

    it('uses serverContext.defaultBotProfileId when botProfileId is not specified', () => {
      const result = ChatRequestNormalizer.normalize(minimalValid, {
        defaultBotProfileId: 'profile-tenant-default',
      });
      expect(result.botProfileId).toBe('profile-tenant-default');
    });
  });

  describe('context attachment deduplication and bounds', () => {
    it('deduplicates loadedFiles by path and preserves file properties', () => {
      const result = ChatRequestNormalizer.normalize({
        ...minimalValid,
        loadedFiles: [
          { path: 'src/index.ts', content: 'console.log("first");', language: 'typescript' },
          { path: 'src/index.ts', content: 'console.log("second duplicate");' },
          { path: 'src/utils.ts', content: 'export const util = 1;', size: 25 },
        ],
      });

      expect(result.loadedFiles).toHaveLength(2);
      expect(result.loadedFiles[0].path).toBe('src/index.ts');
      expect(result.loadedFiles[0].content).toBe('console.log("first");');
      expect(result.loadedFiles[0].language).toBe('typescript');
      expect(result.loadedFiles[1].path).toBe('src/utils.ts');
    });

    it('deduplicates loadedAudio by path', () => {
      const result = ChatRequestNormalizer.normalize({
        ...minimalValid,
        loadedAudio: [
          { path: 'audio/voice1.wav', duration: 12.5, format: 'wav' },
          { path: 'audio/voice1.wav', duration: 99.0 },
          { path: 'audio/voice2.mp3', duration: 3.2, format: 'mp3' },
        ],
      });

      expect(result.loadedAudio).toHaveLength(2);
      expect(result.loadedAudio[0].path).toBe('audio/voice1.wav');
      expect(result.loadedAudio[0].duration).toBe(12.5);
      expect(result.loadedAudio[1].path).toBe('audio/voice2.mp3');
    });

    it('applies file and audio limits and content truncation for large context', () => {
      const bigContent = 'x'.repeat(30000);
      const result = ChatRequestNormalizer.normalize(
        {
          ...minimalValid,
          loadedFiles: [
            { path: 'big.txt', content: bigContent },
          ],
        },
        undefined,
        {
          maxFileContentLength: 500,
        }
      );

      expect(result.loadedFiles[0].content?.length).toBe(500);
    });
  });

  describe('activePlan resolution and validation', () => {
    it('normalizes valid structured activePlan', () => {
      const result = ChatRequestNormalizer.normalize({
        ...minimalValid,
        activePlan: {
          id: 'plan-prod-v1',
          content: '# Implementation Plan\nStep 1: Build normalizer.',
        },
      });

      expect(result.activePlan).toEqual({
        id: 'plan-prod-v1',
        content: '# Implementation Plan\nStep 1: Build normalizer.',
      });
    });

    it('normalizes legacy activePlanId and activePlanContent', () => {
      const result = ChatRequestNormalizer.normalize({
        ...minimalValid,
        activePlanId: 'plan-legacy-88',
        activePlanContent: 'Step A: Legacy task',
      });

      expect(result.activePlan).toEqual({
        id: 'plan-legacy-88',
        content: 'Step A: Legacy task',
      });
    });

    it('rejects invalid activePlan structure with empty id or non-string content', () => {
      expect(() => {
        ChatRequestNormalizer.normalize({
          ...minimalValid,
          activePlan: { id: '', content: 'some plan' },
        });
      }).toThrow(ChatRequestNormalizationError);

      expect(() => {
        ChatRequestNormalizer.normalize({
          ...minimalValid,
          activePlan: 'invalid-string-instead-of-object',
        });
      }).toThrow(ChatRequestNormalizationError);
    });
  });

  describe('security: prototype pollution and malicious metadata', () => {
    it('strips prototype pollution keys from metadata', () => {
      const maliciousPayload = JSON.parse(
        '{"message": "Hello", "sessionId": "s1", "metadata": {"safeKey": 123, "__proto__": {"polluted": true}, "constructor": {"polluted": true}}}'
      );

      const result = ChatRequestNormalizer.normalize(maliciousPayload);
      expect(result.metadata).toEqual({ safeKey: 123 });
      expect((Object.prototype as unknown as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('rejects malformed metadata that is not an object', () => {
      expect(() => {
        ChatRequestNormalizer.normalize({
          ...minimalValid,
          metadata: 'invalid-string-metadata',
        });
      }).toThrow(ChatRequestNormalizationError);

      expect(() => {
        ChatRequestNormalizer.normalize({
          ...minimalValid,
          metadata: [1, 2, 3],
        });
      }).toThrow(ChatRequestNormalizationError);
    });

    it('rejects non-object root payload', () => {
      expect(() => {
        ChatRequestNormalizer.normalize('just-a-string');
      }).toThrow(ChatRequestNormalizationError);

      expect(() => {
        ChatRequestNormalizer.normalize(null);
      }).toThrow(ChatRequestNormalizationError);

      expect(() => {
        ChatRequestNormalizer.normalize([1, 2, 3]);
      }).toThrow(ChatRequestNormalizationError);
    });
  });
});
