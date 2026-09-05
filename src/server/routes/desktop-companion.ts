import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  LocalSTTProvider,
  LocalTTSProvider,
  VoiceDictationEngine,
  FloatingAssistantService,
  ScreenContextCaptureService,
  ClipboardActionService,
  DesktopCompanionBriefingService,
  DesktopOSActionPolicy,
  DesktopPrivacyManager,
  DesktopPackagingManifest,
  ScreenCaptureBackend
} from '../../core/voice-companion';
import {
  discoverLocalRuntimes,
  FasterWhisperBackend,
  OllamaLocalAIBackend,
  WindowsSapiTTSBackend,
  WindowsScreenCaptureBackend
} from '../../core/native-runtime';
import { LocalRuntimeInventory } from '../../core/native-runtime/RuntimeDiscovery';

export function createDesktopCompanionRouter(
  workspaceRoot = process.cwd(),
  integrations: {
    autoDiscover?: boolean;
    runtimes?: LocalRuntimeInventory;
    aiBackend?: OllamaLocalAIBackend | null;
    screenCaptureBackend?: ScreenCaptureBackend;
  } = {}
): Router {
  const router = Router();
  const root = path.join(workspaceRoot, 'data', 'desktop-companion');
  fs.mkdirSync(root, { recursive: true });

  const runtimes = integrations.runtimes || (integrations.autoDiscover === false
    ? { ollamaEndpoint: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434' }
    : discoverLocalRuntimes(workspaceRoot));
  const ai = integrations.aiBackend === null
    ? undefined
    : integrations.aiBackend || (integrations.autoDiscover === false ? undefined : new OllamaLocalAIBackend(runtimes.ollamaEndpoint, process.env.OLLAMA_MODEL || 'qwen3:8b'));
  const stt = new LocalSTTProvider(
    runtimes.python ? new FasterWhisperBackend(runtimes.python, workspaceRoot) : undefined,
    workspaceRoot
  );
  const tts = new LocalTTSProvider(
    runtimes.powershell ? new WindowsSapiTTSBackend(runtimes.powershell, workspaceRoot) : undefined
  );
  const dictation = new VoiceDictationEngine(stt, ai);
  const assistant = new FloatingAssistantService(stt, tts);
  const screenCapture = new ScreenContextCaptureService(
    integrations.screenCaptureBackend
      || (runtimes.powershell ? new WindowsScreenCaptureBackend(runtimes.powershell, workspaceRoot) : undefined)
  );
  const clipboard = new ClipboardActionService(ai);
  const briefing = new DesktopCompanionBriefingService();
  const osActionPolicy = new DesktopOSActionPolicy();
  const privacy = new DesktopPrivacyManager();
  const maxAudioBytes = 10 * 1024 * 1024;

  // 1. Capabilities & Packaging
  router.get('/api/desktop-companion/capabilities', asyncHandler(async (_req, res) => {
    const aiHealth = ai ? await ai.health() : { available: false, models: [] };
    res.json({
    integration: 'optional-local-companion',
    available: true,
    nativeBackendsAvailable: stt.isAvailable() || tts.isAvailable() || screenCapture.isAvailable(),
    features: {
      voiceInput: stt.isAvailable(),
      screenContext: screenCapture.isAvailable(),
      pasteIntoApps: true,
      dailyBriefings: true,
      localSTT: stt.isAvailable(),
      localTTS: tts.isAvailable(),
      localAITransforms: aiHealth.available
    },
    consent: {
      screenContext: 'explicit-per-request',
      voiceInput: 'explicit-per-request',
      persistence: 'off-by-default'
    },
    packaging: DesktopPackagingManifest.getWindowsPackagingManifest(),
    runtimes: {
      python: Boolean(runtimes.python),
      powershell: Boolean(runtimes.powershell),
      ollama: aiHealth.available,
      ollamaModels: aiHealth.models || []
    },
    message: 'Local speech, screen capture, and AI transformations are discovered and executed on this device.'
  });
  }));

  // 2. STT Models List
  router.get('/api/desktop-companion/stt-models', (_req, res) => {
    res.json({ models: stt.listModels() });
  });

  // 3. TTS Voices List
  router.get('/api/desktop-companion/tts-voices', (_req, res) => {
    res.json({ voices: tts.listVoices() });
  });

  router.post('/api/desktop-companion/synthesize', asyncHandler(async (req, res) => {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text is required.' });
    if (text.length > 20_000) return res.status(413).json({ error: 'text exceeds the 20,000 character synthesis limit.' });
    if (!tts.isAvailable()) return res.status(503).json({ error: 'Local TTS is unavailable.' });
    const result = await tts.synthesize(text, {
      voiceId: String(req.body.voiceId || 'os-native-default'),
      speed: Number(req.body.speed || 1),
      format: 'wav'
    });
    res.json({
      audioBase64: result.audioBuffer.toString('base64'),
      durationSec: result.durationSec,
      sampleRate: result.sampleRate,
      voiceId: result.voiceId,
      provider: result.provider,
      syntheticDisclosureNotice: result.syntheticDisclosureNotice,
      isLocalOnly: result.isLocalOnly
    });
  }));

  // 4. Voice Dictation
  router.post('/api/desktop-companion/dictate', asyncHandler(async (req, res) => {
    const { mode, targetLanguage, instructionPrompt, autoPasteConsent, audioBase64 } = req.body;
    if (typeof audioBase64 === 'string' && audioBase64.length > Math.ceil(maxAudioBytes * 4 / 3) + 4) {
      return res.status(413).json({ error: 'Audio payload exceeds the 10 MB request limit.' });
    }
    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 is required.' });
    }
    if (!stt.isAvailable()) {
      return res.status(503).json({ error: 'Local STT is unavailable until a verified native backend and model are configured.' });
    }
    if (['translate', 'instruction_draft', 'code_draft'].includes(mode) && (!ai || !(await ai.health()).available)) {
      return res.status(503).json({ error: `${mode} requires a healthy local Ollama transformation backend.` });
    }
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    if (audioBuffer.byteLength > maxAudioBytes) {
      return res.status(413).json({ error: 'Decoded audio exceeds the 10 MB request limit.' });
    }

    const result = await dictation.processDictation({
      audioBuffer,
      mode: mode || 'cleanup_punctuation',
      targetLanguage,
      instructionPrompt,
      autoPasteConsent: autoPasteConsent === true
    });
    res.json(result);
  }));

  // 5. Screen Context Capture
  router.post('/api/desktop-companion/screen-capture', asyncHandler(async (req, res) => {
    const { bounds, redactSensitiveText, userTriggered } = req.body;
    if (!userTriggered) {
      return res.status(403).json({ error: 'Screen capture requires explicit user trigger.' });
    }
    if (!screenCapture.isAvailable()) {
      return res.status(503).json({ error: 'Native screen capture is unavailable; paste an approved screen summary instead.' });
    }

    const capture = await screenCapture.captureScreen({
      bounds,
      redactSensitiveText: redactSensitiveText !== false,
      userTriggered: true
    });

    const rawImageAllowed = redactSensitiveText === false;
    res.json({
      captureId: capture.captureId,
      dimensions: capture.dimensions,
      detectedSnippets: capture.detectedTextSnippets,
      redactedCount: capture.redactedAreasCount,
      isEphemeral: capture.isEphemeral,
      imageBase64: rawImageAllowed ? capture.imageBuffer.toString('base64') : undefined,
      rawImageWithheld: !rawImageAllowed
    });
  }));

  // 6. Clipboard Action
  router.post('/api/desktop-companion/clipboard-action', asyncHandler(async (req, res) => {
    const { action, rawClipboardText, targetLanguage } = req.body;
    if (!rawClipboardText) {
      return res.status(400).json({ error: 'rawClipboardText is required.' });
    }

    const requestedAction = action || 'send_to_chat';
    if (!['summarize', 'translate', 'explain', 'rewrite', 'code_fix', 'send_to_chat'].includes(requestedAction)) {
      return res.status(400).json({ error: 'Unsupported clipboard action.' });
    }
    if (!clipboard.isAvailable(requestedAction)) {
      return res.status(503).json({ error: `${requestedAction} requires a configured model-backed transformer.` });
    }
    if (requestedAction !== 'send_to_chat' && (!ai || !(await ai.health()).available)) {
      return res.status(503).json({ error: `${requestedAction} requires a healthy local Ollama transformation backend.` });
    }

    const result = await clipboard.executeAction({
      action: requestedAction,
      rawClipboardText,
      targetLanguage
    });

    res.json(result);
  }));

  // 7. Daily Briefing & Health
  router.get('/api/desktop-companion/briefing', (_req, res) => {
    const dailyBriefing = briefing.generateDailyBriefing();
    res.json(dailyBriefing);
  });

  // 8. OS Action Validation
  router.post('/api/desktop-companion/validate-os-action', asyncHandler(async (req, res) => {
    const { action } = req.body;
    const validation = osActionPolicy.validateAction(action);
    res.json(validation);
  }));

  // 9. Privacy Settings & Support Bundle Sanitizer
  router.get('/api/desktop-companion/privacy', (_req, res) => {
    res.json(privacy.getSettings());
  });

  router.post('/api/desktop-companion/privacy', asyncHandler(async (req, res) => {
    const updated = privacy.updateSettings(req.body);
    res.json(updated);
  }));

  // Legacy context append route
  router.post('/api/desktop-companion/context', asyncHandler(async (req, res) => {
    const kind = req.body.kind === 'screen-summary' ? 'screen-summary' : 'transcript';
    const content = String(req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'context content is required' });
    if (content.length > 20000) return res.status(413).json({ error: 'context content is too large' });
    const ownerId = req.user?.userId || 'anonymous';
    fs.appendFileSync(path.join(root, 'context.jsonl'), `${JSON.stringify({ ownerId, kind, content, createdAt: new Date().toISOString() })}\n`, 'utf8');
    return res.status(201).json({ accepted: true, kind, persisted: true });
  }));

  return router;
}
