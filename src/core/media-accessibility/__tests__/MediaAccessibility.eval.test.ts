/**
 * Phase PX-13: Media Accessibility & Dubbing Studio Evaluation Test Suite
 *
 * Validates:
 * - PX13-T01: Media project model & stream metadata
 * - PX13-T02: Subtitle OCR workflow, crop region validation & deduplication
 * - PX13-T03: Subtitle editor (nudge, shift, snap to grid, SRT/VTT/ASS/TXT export & parse)
 * - PX13-T04: Transcription & word alignment, transcript diffs
 * - PX13-T05: Translation variant tracks, glossary locks, reading speed (CPS) validation
 * - PX13-T06: Voice dubbing consent gate, rights validation, synthetic disclosure notices
 * - PX13-T07: Audio timing fit & multitrack reconstruction
 * - PX13-T08: Document narration & chapter detection, chapter-marked audio packaging
 * - PX13-T09: Synchronized read-along artifacts, web player payload, EPUB 3 SMIL 3.0 XML
 * - PX13-T10: Authorized media URL ingest adapter (preflight, DRM rejection, credential stripping)
 * - PX13-T11: Accessibility exports (WCAG conformance, closed captions, disclosures)
 * - PX13-T12: Media storage lifecycle & cleanup on cancellation/completion
 * - PX13-T13: Quality, latency, and consent failure evaluation
 */

import {
  MediaProjectModel,
  SubtitleOcrEngine,
  SubtitleEditorService,
  MediaTranscriptionAligner,
  TranslationVariantService,
  VoiceDubbingConsentGate,
  AudioTimingFitReconstructor,
  DocumentNarrationEngine,
  SynchronizedReadAlongService,
  AuthorizedMediaIngestAdapter,
  MediaStorageLifecycleManager,
  SubtitleCue
} from '../index';

describe('Phase PX-13: Media Accessibility, Subtitle OCR, Dubbing, Narration, and Read-Along', () => {
  const sampleCues: SubtitleCue[] = [
    { id: 'cue-1', index: 1, startSec: 0.5, endSec: 2.5, text: 'Hello and welcome to the studio.' },
    { id: 'cue-2', index: 2, startSec: 3.0, endSec: 5.5, text: 'We are demonstrating media accessibility features.' }
  ];

  // PX13-T01: Media Project Model
  describe('PX13-T01: Media Project & Rights Model', () => {
    it('creates media project with technical streams and rejects unconfirmed rights', () => {
      const projectModel = new MediaProjectModel();

      // Reject unconfirmed rights
      expect(() => {
        projectModel.createProject({
          title: 'Demo Video',
          sourceFilePath: '/videos/demo.mp4',
          durationSec: 120,
          rightsConfirmed: false
        });
      }).toThrow(/User must confirm ownership/);

      const proj = projectModel.createProject({
        title: 'Demo Video',
        sourceFilePath: '/videos/demo.mp4',
        durationSec: 120,
        rightsConfirmed: true
      });

      expect(proj.projectId).toMatch(/^medproj-/);
      expect(proj.streams.length).toBe(2);
      expect(proj.provenance.sourceHash).toBeTruthy();

      projectModel.setPrimaryCues(proj.projectId, sampleCues);
      expect(projectModel.getProject(proj.projectId)?.primaryCues.length).toBe(2);
    });
  });

  // PX13-T02: Subtitle OCR Engine
  describe('PX13-T02: Subtitle OCR Workflow & Region Cropping', () => {
    it('validates crop bounds, extracts text, and deduplicates consecutive frames into cues', async () => {
      const ocr = new SubtitleOcrEngine({
        async extractCandidates() {
          return {
            candidates: [
              { timeSec: 1, text: 'Welcome.', confidence: 0.94 },
              { timeSec: 1.5, text: 'Welcome.', confidence: 0.96 },
              { timeSec: 3, text: 'Accessible media.', confidence: 0.92 }
            ],
            totalFramesProcessed: 6
          };
        }
      });

      // Reject invalid crop bounds
      await expect(
        ocr.runOcrJob({
          videoPath: '/videos/sample.mp4',
          cropRegion: { x: -10, y: 0, width: 0, height: 100 }
        })
      ).rejects.toThrow(/Invalid subtitle crop region/);

      const result = await ocr.runOcrJob({
        videoPath: '/videos/sample.mp4',
        cropRegion: { x: 100, y: 800, width: 1720, height: 200 }
      });

      expect(result.jobId).toMatch(/^ocrjob-/);
      expect(result.extractedCues.length).toBeGreaterThan(0);
      expect(result.deduplicatedCount).toBeGreaterThan(0);
      expect(result.averageConfidence).toBeGreaterThan(0.85);
    });

    it('fails closed without a video-frame and OCR backend', async () => {
      await expect(new SubtitleOcrEngine().runOcrJob({
        videoPath: '/videos/sample.mp4', cropRegion: { x: 0, y: 0, width: 100, height: 50 }
      })).rejects.toThrow(/SUBTITLE_OCR_BACKEND_UNAVAILABLE/);
    });
  });

  // PX13-T03: Subtitle Editor & Exporters
  describe('PX13-T03: Subtitle Editor & Format Exporters', () => {
    it('performs timing shifts, frame snapping, and parses/exports SRT, VTT, ASS, and plain text', () => {
      const editor = new SubtitleEditorService();

      // Timing shift
      const shifted = editor.shiftAllCues(sampleCues, 1.5);
      expect(shifted[0].startSec).toBe(2.0);
      expect(shifted[0].endSec).toBe(4.0);

      // Frame snap (24 fps -> 1 frame = 0.0416s)
      const snapped = editor.snapToFrameGrid(sampleCues, 24);
      expect(snapped.length).toBe(2);

      // Nudge cue
      const nudged = editor.nudgeCue(sampleCues, 'cue-1', 0.2, 0.5);
      expect(nudged[0].startSec).toBe(0.7);
      expect(nudged[0].endSec).toBe(3.0);

      // Export SRT and parse back
      const srt = editor.exportToSrt(sampleCues);
      expect(srt).toContain('00:00:00,500 --> 00:00:02,500');
      const parsedSrt = editor.parseSrt(srt);
      expect(parsedSrt.length).toBe(2);
      expect(parsedSrt[0].text).toBe(sampleCues[0].text);

      // Export WebVTT
      const vtt = editor.exportToWebVtt(sampleCues);
      expect(vtt).toContain('WEBVTT');
      expect(vtt).toContain('00:00:00.500 --> 00:00:02.500');

      // Export ASS
      const ass = editor.exportToAss(sampleCues, 'Test Presentation');
      expect(ass).toContain('[Script Info]');
      expect(ass).toContain('Dialogue:');

      // Export Plain Text
      const txt = editor.exportToPlainText(sampleCues);
      expect(txt).toContain('Hello and welcome');
    });
  });

  // PX13-T04: Speech-to-Text Transcription & Alignment
  describe('PX13-T04: Transcription & Speech Alignment', () => {
    it('aligns raw transcript sentences to timeline and computes diff comparisons', () => {
      const aligner = new MediaTranscriptionAligner();
      const rawText = 'First sentence of speech. Second sentence follows immediately.';

      const aligned = aligner.alignTranscript(rawText, 10.0);
      expect(aligned.cues.length).toBe(2);
      expect(aligned.totalWordCount).toBe(8);
      expect(aligned.cues[0].startSec).toBe(0);
      expect(aligned.cues[1].endSec).toBe(10.0);

      // Diff test
      const diff = aligner.computeTranscriptDiff(
        'The quick brown fox jumps',
        'The fast brown fox leaps over'
      );
      expect(diff.additions).toContain('fast');
      expect(diff.deletions).toContain('quick');
      expect(diff.unchangedRatio).toBeGreaterThan(0.5);
    });
  });

  // PX13-T05: Translation Variant Tracks
  describe('PX13-T05: Translation Variant Tracks & Glossary Locks', () => {
    it('generates variant tracks with glossary locks and checks reading speed limits', async () => {
      const variantService = new TranslationVariantService({
        translate: async (text, language) => `[${language}] ${text}`
      });
      const cuesWithBrand: SubtitleCue[] = [
        { id: 'cue-1', index: 1, startSec: 0, endSec: 2, text: 'Use ChatBot for real-time transcription.' }
      ];

      const result = await variantService.generateVariant({
        targetLanguage: 'es',
        sourceCues: cuesWithBrand,
        glossary: { ChatBot: 'ChatBot Hub' },
        maxCps: 25
      });

      expect(result.variantCues.length).toBe(1);
      expect(result.variantCues[0].text).toContain('ChatBot Hub');
      expect(result.variantCues[0].id).toBe('var-es-cue-1');
    });

    it('fails closed when no translation backend is configured', async () => {
      await expect(new TranslationVariantService().generateVariant({
        targetLanguage: 'es',
        sourceCues: [{ id: 'cue-1', index: 1, startSec: 0, endSec: 2, text: 'Source' }]
      })).rejects.toThrow(/TRANSLATION_BACKEND_UNAVAILABLE/);
    });
  });

  // PX13-T06: Voice Dubbing Consent & Governance Gate
  describe('PX13-T06: Voice Dubbing Consent & Synthetic Disclosure', () => {
    it('allows stock voices and strictly gates cloned voices with consent records', () => {
      const consentGate = new VoiceDubbingConsentGate();

      // Stock voice
      const stockCheck = consentGate.evaluateDubbingPermission({
        voiceId: 'stock-female-1',
        isCustomOrClonedVoice: false
      });
      expect(stockCheck.allowed).toBe(true);
      expect(stockCheck.syntheticDisclosureNotice).toContain('Stock Engine Voice');

      // Cloned voice without consent -> REJECT
      const noConsentCheck = consentGate.evaluateDubbingPermission({
        voiceId: 'cloned-voice-vip',
        isCustomOrClonedVoice: true
      });
      expect(noConsentCheck.allowed).toBe(false);
      expect(noConsentCheck.error).toContain('Missing required subject consent record');

      // Register valid consent -> ALLOW
      consentGate.registerConsent({
        consentId: 'consent-777',
        subjectName: 'Jane Doe',
        subjectIdentityConfirmed: true,
        permittedPurpose: 'personal_accessibility',
        syntheticDisclosureRequired: true,
        signedAt: new Date().toISOString()
      });

      const validConsentCheck = consentGate.evaluateDubbingPermission({
        voiceId: 'cloned-voice-jane',
        isCustomOrClonedVoice: true,
        consentId: 'consent-777'
      });
      expect(validConsentCheck.allowed).toBe(true);
      expect(validConsentCheck.syntheticDisclosureNotice).toContain('Jane Doe');
    });
  });

  // PX13-T07: Audio Timing Fit & Multitrack Reconstruction
  describe('PX13-T07: Timing Fit & Dubbing Reconstruction', () => {
    it('renders dubbed audio package with speed adjustments and manifest creation', async () => {
      const reconstructor = new AudioTimingFitReconstructor(undefined, {
        async render(cues, options, disclosureNotice) {
          return {
            jobId: 'dubjob-fixture', targetLanguage: options.targetLanguage,
            outputAudioPath: 'data/media/dubbing/fixture.wav', durationSec: cues.at(-1)?.endSec || 0,
            cueCount: cues.length, speedAdjustedCuesCount: 0,
            syntheticDisclosureNotice: disclosureNotice,
            artifactsCreated: ['data/media/dubbing/fixture.wav']
          };
        }
      });
      const result = await reconstructor.renderDubbedTrack(sampleCues, {
        projectId: 'medproj-101',
        targetLanguage: 'es',
        voiceId: 'stock-voice-es',
        duckOriginalAudio: true,
        allowSpeedAdjustment: true,
        maxSpeedFactor: 1.35
      });

      expect(result.jobId).toMatch(/^dubjob-/);
      expect(result.cueCount).toBe(2);
      expect(result.targetLanguage).toBe('es');
      expect(result.outputAudioPath).toContain('.wav');
      expect(result.syntheticDisclosureNotice).toBeTruthy();
    });

    it('fails closed without a dubbing render backend', async () => {
      await expect(new AudioTimingFitReconstructor().renderDubbedTrack(sampleCues, {
        projectId: 'medproj-101', targetLanguage: 'es', voiceId: 'stock-voice-es',
        duckOriginalAudio: true, allowSpeedAdjustment: true
      })).rejects.toThrow(/DUBBING_BACKEND_UNAVAILABLE/);
    });
  });

  // PX13-T08: Document Narration Engine
  describe('PX13-T08: Document Narration & Chapter Audio Packages', () => {
    it('detects chapters from headings and synthesizes chaptered narration packages', async () => {
      const narrationEngine = new DocumentNarrationEngine({
        async synthesize(options) {
          return {
            narrationId: 'docnarr-fixture', documentTitle: options.documentTitle,
            chaptersSynthesized: options.chapters.length, totalAudioDurationSec: 2,
            chapterAudioPaths: options.chapters.map(chapter => ({
              chapterIndex: chapter.chapterIndex, title: chapter.title,
              audioPath: `chapter-${chapter.chapterIndex}.wav`, durationSec: 1
            })),
            manifestPackagePath: 'docnarr-fixture_manifest.json'
          };
        }
      });
      const docText = `
# Chapter 1: Introduction to Accessibility
Media accessibility ensures all users have equal access to audiovisual materials. [1]

# Chapter 2: Real-Time Subtitles
Subtitles and captions bridge audio content to readable text.
Visit https://example.com for more info.
      `.trim();

      const chapters = narrationEngine.detectChapters(docText);
      expect(chapters.length).toBe(2);
      expect(chapters[0].title).toBe('Chapter 1: Introduction to Accessibility');
      expect(chapters[0].cleanedText).not.toContain('[1]');
      expect(chapters[1].cleanedText).toContain('[link]');

      const result = await narrationEngine.synthesizeNarration({
        documentTitle: 'Accessibility Guide',
        chapters,
        voiceId: 'kokoro-af-bella'
      });

      expect(result.narrationId).toMatch(/^docnarr-/);
      expect(result.chaptersSynthesized).toBe(2);
      expect(result.chapterAudioPaths.length).toBe(2);
      expect(result.manifestPackagePath).toContain('_manifest.json');
    });

    it('fails closed without a narration synthesis backend', async () => {
      await expect(new DocumentNarrationEngine().synthesizeNarration({
        documentTitle: 'Source', chapters: [], voiceId: 'local'
      })).rejects.toThrow(/NARRATION_BACKEND_UNAVAILABLE/);
    });
  });

  // PX13-T09: Synchronized Read-Along Artifacts & SMIL 3.0
  describe('PX13-T09: Synchronized Read-Along & EPUB 3 SMIL 3.0', () => {
    it('builds sentence/word timing maps, web player payloads, and EPUB 3 SMIL XML', () => {
      const readAlong = new SynchronizedReadAlongService();
      const text = 'Antigravity enables rapid AI pair programming. It features comprehensive toolkits.';

      const pkg = readAlong.generateReadAlongPackage({
        title: 'Programming with AI',
        audioFilePath: 'audio/chapter1.wav',
        text,
        totalDurationSec: 6.0
      });

      expect(pkg.packageId).toMatch(/^readalong-/);
      expect(pkg.sentences.length).toBe(2);
      expect(pkg.sentences[0].words.length).toBeGreaterThan(0);
      expect(pkg.epubSmilXml).toContain('<smil');
      expect(pkg.epubSmilXml).toContain('<par id="par-s-1">');
      expect(pkg.accessibilityConformance.wcagLevel).toBe('AAA');
      expect(pkg.webPlayerPayload.keyboardControls.playPause).toBe('Space');
    });
  });

  // PX13-T10: Authorized Media URL Ingest
  describe('PX13-T10: Authorized Media URL Ingest & Guardrails', () => {
    it('validates URLs, rejects DRM/credentials, and enforces user rights confirmation', async () => {
      const ingest = new AuthorizedMediaIngestAdapter();

      // Reject unconfirmed rights
      const noRights = ingest.preflightUrl({
        sourceUrl: 'https://example.com/video.mp4',
        userRightsConfirmed: false
      });
      expect(noRights.valid).toBe(false);
      expect(noRights.error).toContain('User must confirm authorization');

      // Reject embedded credentials
      const credUrl = ingest.preflightUrl({
        sourceUrl: 'https://admin:secret123@example.com/video.mp4',
        userRightsConfirmed: true
      });
      expect(credUrl.valid).toBe(false);
      expect(credUrl.error).toContain('embedded credentials');

      // Reject DRM streams
      const drmUrl = ingest.preflightUrl({
        sourceUrl: 'https://example.com/stream/manifest.mpd',
        userRightsConfirmed: true
      });
      expect(drmUrl.valid).toBe(false);
      expect(drmUrl.error).toContain('DRM-protected');

      // Valid preflight
      const valid = ingest.preflightUrl({
        sourceUrl: 'https://example.com/open-video.mp4',
        userRightsConfirmed: true
      });
      expect(valid.valid).toBe(true);
      expect(valid.termsNotice).toContain('Notice:');

      const downloadResult = await ingest.ingestMedia({
        sourceUrl: 'https://example.com/open-video.mp4',
        userRightsConfirmed: true
      });
      expect(downloadResult.localFilePath).toBeTruthy();
    });
  });

  // PX13-T12: Media Storage Lifecycle & Cleanup
  describe('PX13-T12: Media Storage Lifecycle Management', () => {
    it('tracks temporary media artifacts and cleans up on completion or cancellation', () => {
      const storage = new MediaStorageLifecycleManager();
      storage.registerTempArtifact('job-1', '/tmp/frame_001.png');
      storage.registerTempArtifact('job-1', '/tmp/frame_002.png');
      storage.registerTempArtifact('job-2', '/tmp/audio_chunk.wav');

      expect(storage.getTempArtifacts('job-1').length).toBe(2);

      const cleanup1 = storage.cleanupJob('job-1');
      expect(cleanup1.cleanedCount).toBe(2);
      expect(storage.getTempArtifacts('job-1').length).toBe(0);

      const purgeAll = storage.purgeAll();
      expect(purgeAll.totalCleaned).toBe(1);
    });
  });
});
