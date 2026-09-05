import { SubtitleEditorService } from '../SubtitleEditorService';
import { TranslationVariantService } from '../TranslationVariantService';
import { VoiceDubbingConsentGate } from '../VoiceDubbingConsentGate';
import { DocumentNarrationEngine } from '../DocumentNarrationEngine';
import { SubtitleCue } from '../MediaAccessibilityTypes';

describe('RT-MEDIA-001..006 — Media Accessibility Pipeline Suite', () => {
  const sampleCues: SubtitleCue[] = [
    { id: 'cue-1', index: 1, startSec: 1.0, endSec: 3.5, text: 'Hello, welcome to the show.' },
    { id: 'cue-2', index: 2, startSec: 4.0, endSec: 6.5, text: 'Today we discuss AI accessibility.' },
  ];

  describe('RT-MEDIA-003: Subtitle Editor and Export', () => {
    const editor = new SubtitleEditorService();

    it('exports cues to valid SRT and WebVTT formats', () => {
      const srt = editor.exportToSrt(sampleCues);
      expect(srt).toContain('00:00:01,000 --> 00:00:03,500');
      expect(srt).toContain('Hello, welcome to the show.');

      const vtt = editor.exportToWebVtt(sampleCues);
      expect(vtt).toContain('WEBVTT');
      expect(vtt).toContain('00:00:01.000 --> 00:00:03.500');
    });

    it('shifts and snaps cues correctly', () => {
      const shifted = editor.shiftAllCues(sampleCues, 1.0);
      expect(shifted[0].startSec).toBe(2.0);
      expect(shifted[0].endSec).toBe(4.5);

      const snapped = editor.snapToFrameGrid(sampleCues, 24);
      expect(snapped[0].startSec).toBeCloseTo(1.0, 1);
    });
  });

  describe('RT-MEDIA-004: Translation Variants', () => {
    it('creates translation variant preserving cue timestamps', async () => {
      const translationService = new TranslationVariantService({
        translate: async (text, lang) => `[${lang}] ${text}`,
      });
      const variant = await translationService.generateVariant({
        targetLanguage: 'es',
        sourceCues: sampleCues,
      });

      expect(variant.variantCues.length).toBe(2);
      expect(variant.language).toBe('es');
      expect(variant.variantCues[0].startSec).toBe(1.0);
      expect(variant.variantCues[0].endSec).toBe(3.5);
    });
  });

  describe('RT-MEDIA-005: Voice Dubbing Consent Gate', () => {
    it('requires explicit user consent record before cloned voice dubbing synthesis', () => {
      const consentGate = new VoiceDubbingConsentGate();
      const noConsent = consentGate.evaluateDubbingPermission({
        voiceId: 'cloned-voice-123',
        isCustomOrClonedVoice: true,
      });
      expect(noConsent.allowed).toBe(false);

      consentGate.registerConsent({
        consentId: 'consent-123',
        subjectName: 'Test Speaker',
        subjectIdentityConfirmed: true,
        permittedPurpose: 'personal_accessibility',
        syntheticDisclosureRequired: true,
        signedAt: new Date().toISOString(),
      });

      const withConsent = consentGate.evaluateDubbingPermission({
        voiceId: 'cloned-voice-123',
        isCustomOrClonedVoice: true,
        consentId: 'consent-123',
      });
      expect(withConsent.allowed).toBe(true);
    });
  });

  describe('RT-MEDIA-006: Document Narration Engine', () => {
    it('detects document chapters and estimates reading time', () => {
      const narrationEngine = new DocumentNarrationEngine();
      const markdown = '# Chapter 1\nThis is the first paragraph.\n## Section 1.1\nMore details follow.';

      const chapters = narrationEngine.detectChapters(markdown);
      expect(chapters.length).toBeGreaterThanOrEqual(1);
      expect(chapters[0].title).toBeDefined();
      expect(chapters[0].estimatedReadingTimeMin).toBeGreaterThanOrEqual(0);
    });
  });
});
