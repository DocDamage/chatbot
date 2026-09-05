/**
 * Media Accessibility & Dubbing Studio REST API Routes (PX13-T10)
 *
 * Exposes endpoints for:
 * - Media projects & stream metadata
 * - Burned-in Subtitle OCR
 * - Subtitle editing & export (SRT, VTT, ASS, TXT)
 * - Speech alignment & diff comparisons
 * - Translation variant tracks & glossary locks
 * - Voice dubbing consent evaluation & timing fit reconstruction
 * - Document narration & chaptered audio synthesis
 * - Synchronized read-along packages & EPUB 3 SMIL 3.0
 * - Authorized URL ingest preflight
 * - Media storage lifecycle cleanup
 */

import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
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
} from '../../../core/media-accessibility';
import { resolveWorkspacePath } from '../localPathGuard';
import {
  discoverLocalRuntimes,
  FfmpegTesseractSubtitleOcrBackend,
  LocalDocumentNarrationBackend,
  LocalDubbingBackend,
  OllamaLocalAIBackend,
  WindowsSapiTTSBackend
} from '../../../core/native-runtime';
import { LocalTTSProvider } from '../../../core/voice-companion';
import { LocalRuntimeInventory } from '../../../core/native-runtime/RuntimeDiscovery';

export function createMediaAccessibilityRouter(
  workspaceRoot = process.cwd(),
  integrations: { autoDiscover?: boolean; runtimes?: LocalRuntimeInventory; aiBackend?: OllamaLocalAIBackend | null } = {}
): Router {
  const router = Router();
  const projectModel = new MediaProjectModel();
  const runtimes = integrations.runtimes || (integrations.autoDiscover === false
    ? { ollamaEndpoint: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434' }
    : discoverLocalRuntimes(workspaceRoot));
  const ai = integrations.aiBackend === null
    ? undefined
    : integrations.aiBackend || (integrations.autoDiscover === false ? undefined : new OllamaLocalAIBackend(runtimes.ollamaEndpoint, process.env.OLLAMA_MODEL || 'qwen3:8b'));
  const tts = new LocalTTSProvider(
    runtimes.powershell ? new WindowsSapiTTSBackend(runtimes.powershell, workspaceRoot) : undefined
  );
  const ocrEngine = new SubtitleOcrEngine(
    runtimes.ffmpeg ? new FfmpegTesseractSubtitleOcrBackend(runtimes.ffmpeg) : undefined
  );
  const editorService = new SubtitleEditorService();
  const aligner = new MediaTranscriptionAligner();
  const variantService = new TranslationVariantService(ai);
  const consentGate = new VoiceDubbingConsentGate();
  const reconstructor = new AudioTimingFitReconstructor(
    consentGate,
    runtimes.ffmpeg && runtimes.ffprobe && tts.isAvailable()
      ? new LocalDubbingBackend(tts, runtimes.ffmpeg, runtimes.ffprobe, workspaceRoot)
      : undefined
  );
  const narrationEngine = new DocumentNarrationEngine(
    runtimes.ffprobe && tts.isAvailable()
      ? new LocalDocumentNarrationBackend(tts, runtimes.ffprobe, workspaceRoot)
      : undefined
  );
  const readAlongService = new SynchronizedReadAlongService();
  const ingestAdapter = new AuthorizedMediaIngestAdapter();
  const storageManager = new MediaStorageLifecycleManager();

  router.get('/api/media-accessibility/status', asyncHandler(async (_req, res) => {
    const aiHealth = ai ? await ai.health() : { available: false };
    res.json({
      available: true,
      localOnly: true,
      rightsConfirmationRequired: true,
      voiceConsentRequired: true,
      nativeBackends: {
        subtitleOcr: ocrEngine.isAvailable(),
        translation: variantService.isAvailable() && aiHealth.available,
        dubbing: reconstructor.isAvailable(),
        narration: narrationEngine.isAvailable()
      },
      capabilities: [
        'subtitle_ocr', 'subtitle_export', 'transcript_alignment', 'translation_variants',
        'consent_gated_dubbing', 'document_narration', 'read_along', 'authorized_ingest'
      ],
      runtimeDetails: {
        ffmpeg: Boolean(runtimes.ffmpeg),
        ffprobe: Boolean(runtimes.ffprobe),
        tts: tts.isAvailable(),
        ollama: aiHealth.available
      }
    });
  }));

  // 1. Create Media Project
  router.post('/api/media-accessibility/projects', asyncHandler(async (req, res) => {
    const { title, sourceFilePath, originalLanguage, durationSec, rightsConfirmed } = req.body;
    if (!rightsConfirmed) {
      return res.status(400).json({ error: 'User must confirm rights to process media asset.' });
    }
    const safeSourceFilePath = resolveWorkspacePath(
      workspaceRoot,
      sourceFilePath || 'data/media/sample.mp4',
      { label: 'sourceFilePath' }
    );
    const project = projectModel.createProject({
      title: title || 'Untitled Media Project',
      sourceFilePath: safeSourceFilePath,
      originalLanguage: originalLanguage || 'en',
      durationSec: Number(durationSec) || 60,
      rightsConfirmed: true
    });
    res.status(201).json(project);
  }));

  // 2. Get Project
  router.get('/api/media-accessibility/projects/:projectId', asyncHandler(async (req, res) => {
    const project = projectModel.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    res.json(project);
  }));

  // 3. Subtitle OCR Job
  router.post('/api/media-accessibility/ocr', asyncHandler(async (req, res) => {
    const { videoPath, cropRegion, language, confidenceThreshold } = req.body;
    if (!cropRegion) {
      return res.status(400).json({ error: 'cropRegion is required for Subtitle OCR.' });
    }
    if (!ocrEngine.isAvailable()) {
      return res.status(503).json({ error: 'Subtitle OCR requires a configured video-frame and OCR backend.' });
    }
    const safeVideoPath = resolveWorkspacePath(workspaceRoot, videoPath || 'data/media/sample.mp4', {
      label: 'videoPath'
    });
    const result = await ocrEngine.runOcrJob({
      videoPath: safeVideoPath,
      cropRegion,
      language,
      confidenceThreshold
    });
    res.json(result);
  }));

  // 4. Export Subtitles (SRT, VTT, ASS, TXT)
  router.post('/api/media-accessibility/export-subtitles', asyncHandler(async (req, res) => {
    const { cues, format, title } = req.body;
    const cueList: SubtitleCue[] = cues || [];
    let exported = '';

    switch (format) {
      case 'srt':
        exported = editorService.exportToSrt(cueList);
        break;
      case 'vtt':
        exported = editorService.exportToWebVtt(cueList);
        break;
      case 'ass':
        exported = editorService.exportToAss(cueList, title);
        break;
      case 'txt':
      default:
        exported = editorService.exportToPlainText(cueList);
        break;
    }

    res.json({ format: format || 'txt', content: exported });
  }));

  // 5. Speech Transcription Alignment
  router.post('/api/media-accessibility/align-transcript', asyncHandler(async (req, res) => {
    const { transcriptText, totalDurationSec, speakerId } = req.body;
    if (!transcriptText) {
      return res.status(400).json({ error: 'transcriptText is required.' });
    }
    const alignment = aligner.alignTranscript(
      transcriptText,
      Number(totalDurationSec) || 60,
      speakerId
    );
    res.json(alignment);
  }));

  // 6. Translation Variants
  router.post('/api/media-accessibility/translation-variant', asyncHandler(async (req, res) => {
    const { targetLanguage, sourceCues, glossary, maxCps } = req.body;
    if (!targetLanguage || !sourceCues) {
      return res.status(400).json({ error: 'targetLanguage and sourceCues are required.' });
    }
    if (!variantService.isAvailable()) {
      return res.status(503).json({ error: 'Translation variants require a configured translation backend.' });
    }
    if (!ai || !(await ai.health()).available) {
      return res.status(503).json({ error: 'Translation variants require a healthy local Ollama backend.' });
    }
    const variant = await variantService.generateVariant({
      targetLanguage,
      sourceCues,
      glossary,
      maxCps
    });
    res.json(variant);
  }));

  // 7. Dubbing Synthesis & Reconstruction
  router.post('/api/media-accessibility/dubbing', asyncHandler(async (req, res) => {
    const { cues, projectId, targetLanguage, voiceId, consentRecord, duckOriginalAudio } = req.body;
    if (!cues || cues.length === 0) {
      return res.status(400).json({ error: 'cues array is required for dubbing.' });
    }
    if (!reconstructor.isAvailable()) {
      return res.status(503).json({ error: 'Dubbing requires a configured speech synthesis and audio reconstruction backend.' });
    }
    const result = await reconstructor.renderDubbedTrack(cues, {
      projectId: projectId || 'proj-default',
      targetLanguage: targetLanguage || 'es',
      voiceId: voiceId || 'stock-voice',
      consentRecord,
      duckOriginalAudio: duckOriginalAudio !== false,
      allowSpeedAdjustment: true
    });
    res.json(result);
  }));

  // 8. Document Narration
  router.post('/api/media-accessibility/document-narration', asyncHandler(async (req, res) => {
    const { documentText, documentTitle, voiceId } = req.body;
    if (!documentText) {
      return res.status(400).json({ error: 'documentText is required.' });
    }
    if (!narrationEngine.isAvailable()) {
      return res.status(503).json({ error: 'Document narration requires a configured speech synthesis and packaging backend.' });
    }
    const chapters = narrationEngine.detectChapters(documentText);
    const narration = await narrationEngine.synthesizeNarration({
      documentTitle: documentTitle || 'Document Narration',
      chapters,
      voiceId: voiceId || 'kokoro-af-bella'
    });
    res.json(narration);
  }));

  // 9. Synchronized Read-Along Package & SMIL 3.0
  router.post('/api/media-accessibility/read-along', asyncHandler(async (req, res) => {
    const { title, audioFilePath, text, totalDurationSec } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required.' });
    }
    const safeAudioFilePath = resolveWorkspacePath(workspaceRoot, audioFilePath || 'audio/narration.wav', {
      label: 'audioFilePath'
    });
    const pkg = readAlongService.generateReadAlongPackage({
      title: title || 'Synchronized Read-Along',
      audioFilePath: safeAudioFilePath,
      text,
      totalDurationSec: Number(totalDurationSec) || 30
    });
    res.json(pkg);
  }));

  // 10. Authorized URL Ingest Preflight
  router.post('/api/media-accessibility/ingest/preflight', asyncHandler(async (req, res) => {
    const { sourceUrl, userRightsConfirmed, maxDurationSec } = req.body;
    const preflight = ingestAdapter.preflightUrl({
      sourceUrl,
      userRightsConfirmed: userRightsConfirmed === true,
      maxDurationSec
    });
    res.json(preflight);
  }));

  // 11. Storage Cleanup
  router.post('/api/media-accessibility/storage/cleanup', asyncHandler(async (req, res) => {
    const { jobId } = req.body;
    if (jobId) {
      const result = storageManager.cleanupJob(jobId);
      return res.json(result);
    }
    const result = storageManager.purgeAll();
    res.json(result);
  }));

  return router;
}
