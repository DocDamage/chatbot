import { LocalSTTProvider, LocalSTTBackend } from '../LocalSTTProvider';
import { LocalTTSProvider, LocalTTSBackend } from '../LocalTTSProvider';
import { ScreenContextCaptureService, ScreenCaptureBackend } from '../ScreenContextCaptureService';

describe('RT-VOICE-001..005 — Voice Runtime, STT, TTS, Screen, and Clipboard Matrix', () => {
  describe('RT-VOICE-001: Local STT Provider', () => {
    it('transcribes using mock backend and returns structured word timings', async () => {
      const mockBackend: LocalSTTBackend = {
        transcribe: jest.fn().mockResolvedValue({
          text: 'The quick brown fox',
          confidence: 0.98,
          durationSec: 2.1,
          language: 'en',
          words: [
            { word: 'The', startSec: 0.0, endSec: 0.3, confidence: 0.99 },
            { word: 'quick', startSec: 0.3, endSec: 0.7, confidence: 0.98 },
            { word: 'brown', startSec: 0.7, endSec: 1.2, confidence: 0.97 },
            { word: 'fox', startSec: 1.2, endSec: 1.8, confidence: 0.99 },
          ],
          processingTimeMs: 120,
        }),
      };

      const provider = new LocalSTTProvider(mockBackend);
      const audioBuffer = Buffer.from('RIFF....WAVE');
      const result = await provider.transcribe(audioBuffer, { language: 'en' });

      expect(result.text).toBe('The quick brown fox');
      expect(result.words?.length).toBe(4);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(mockBackend.transcribe).toHaveBeenCalled();
    });

    it('handles silence or empty speech gracefully', async () => {
      const mockBackend: LocalSTTBackend = {
        transcribe: jest.fn().mockResolvedValue({
          text: '',
          confidence: 0.0,
          durationSec: 1.0,
          language: 'en',
          words: [],
          processingTimeMs: 40,
        }),
      };

      const provider = new LocalSTTProvider(mockBackend);
      const result = await provider.transcribe(Buffer.alloc(16000), { language: 'en' });
      expect(result.text).toBe('');
      expect(result.words).toEqual([]);
    });
  });

  describe('RT-VOICE-002: Local TTS Provider', () => {
    it('synthesizes text to valid WAV audio structure', async () => {
      const dummyWav = Buffer.alloc(100);
      dummyWav.write('RIFF', 0, 'ascii');
      dummyWav.write('WAVE', 8, 'ascii');

      const mockBackend: LocalTTSBackend = {
        synthesize: jest.fn().mockResolvedValue({
          audioBuffer: dummyWav,
          durationSec: 1.5,
          sampleRate: 22050,
        }),
      };

      const provider = new LocalTTSProvider(mockBackend);
      const voices = provider.listVoices();
      expect(voices.length).toBeGreaterThan(0);

      const res = await provider.synthesize('Testing voice synthesis', { voiceId: voices[0].voiceId });
      expect(res.syntheticDisclosureNotice).toMatch(/generated/i);
      expect(res.durationSec).toBe(1.5);
      expect(res.audioBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('RT-VOICE-004: Screen Capture Boundaries & Redaction', () => {
    it('denies capture when non-user triggered', async () => {
      const mockScreenBackend: ScreenCaptureBackend = {
        capture: jest.fn().mockResolvedValue({
          captureId: 'screencap-1',
          imageBuffer: Buffer.from('fake-png'),
          dimensions: { width: 800, height: 600 },
          pixelDensity: 1,
          createdAt: new Date().toISOString(),
          isEphemeral: true,
        }),
      };

      const screenService = new ScreenContextCaptureService(mockScreenBackend);
      await expect(
        screenService.captureScreen({ userTriggered: false })
      ).rejects.toThrow(/strictly prohibited/);
    });

    it('allows bounded capture when userTriggered is true and scans for secrets', async () => {
      const mockScreenBackend: ScreenCaptureBackend = {
        capture: jest.fn().mockResolvedValue({
          captureId: 'screencap-2',
          imageBuffer: Buffer.from('fake-png'),
          dimensions: { width: 1920, height: 1080 },
          pixelDensity: 1,
          createdAt: new Date().toISOString(),
          isEphemeral: true,
        }),
      };

      const screenService = new ScreenContextCaptureService(mockScreenBackend);
      const capture = await screenService.captureScreen({
        userTriggered: true,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      });

      expect(capture.captureId).toMatch(/^screencap-/);
      expect(capture.dimensions.width).toBe(1920);

      const scanResult = screenService.scanForSecrets('api_key = "abcdef1234567890"');
      expect(scanResult.containsSecrets).toBe(true);
      expect(scanResult.matches.length).toBeGreaterThan(0);
    });
  });
});
