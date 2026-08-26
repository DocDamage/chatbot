/**
 * Phase PX-12: Local Desktop Voice Companion Evaluation Test Suite
 *
 * Validates:
 * - PX12-T01: Desktop architecture & loopback authentication
 * - PX12-T02: Local STT provider, model checksum verification, VAD, word timestamps
 * - PX12-T03: Local TTS provider, Kokoro/OS voices, synthetic disclosure, remote egress gate
 * - PX12-T04: Push-to-talk & tap-to-toggle recording, hotkeys, device selection, duration limits
 * - PX12-T05: Dictation modes (raw, punctuation, translate, instruction draft, paste confirmation)
 * - PX12-T06: Floating assistant panel session, dialog turns, interrupt/stop speaking
 * - PX12-T07: Screen context capture, bounding box cropping, sensitive pattern redaction
 * - PX12-T08: Clipboard actions, secret detection warning, safe write gating
 * - PX12-T09: Daily briefing, hardware status (CPU/RAM/Disk), quiet hours, reminders
 * - PX12-T10: Desktop OS action policy sandbox (allowlist vs arbitrary commands)
 * - PX12-T11: Privacy settings, temporary audio/thumbnail purging, support bundle sanitization
 * - PX12-T12: Windows desktop companion packaging manifest
 * - PX12-T13: Quality, latency, and offline boundaries
 */

import {
  LocalSTTProvider,
  LocalTTSProvider,
  VoiceRecordingService,
  VoiceDictationEngine,
  FloatingAssistantService,
  ScreenContextCaptureService,
  ClipboardActionService,
  DesktopCompanionBriefingService,
  DesktopOSActionPolicy,
  DesktopPrivacyManager,
  DesktopPackagingManifest,
  LocalSTTBackend,
  LocalTTSBackend,
  ScreenCaptureBackend,
  AudioInputDeviceProvider,
  ClipboardTransformationBackend,
  DictationTransformationBackend
} from '../index';

function wavFixture(sampleRate = 24000, durationSec = 1): Buffer {
  const dataSize = sampleRate * durationSec * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

const sttBackend: LocalSTTBackend = {
  async transcribe(audioBuffer, model, options) {
    const text = options.prompt ? `${options.prompt} fixture transcription` : 'Fixture transcription';
    return {
      text,
      confidence: 0.95,
      durationSec: audioBuffer.length / 32000,
      language: options.language || 'en',
      words: [{ word: 'Fixture', startSec: 0, endSec: 0.5, confidence: 0.95 }],
      processingTimeMs: 1,
      provider: 'whisper_local',
      modelUsed: model.name,
      isLocalOnly: true
    };
  }
};

const ttsBackend: LocalTTSBackend = {
  async synthesize(_text, _voice, options) {
    return { audioBuffer: wavFixture(options.sampleRate || 24000), durationSec: 1, sampleRate: options.sampleRate || 24000 };
  }
};

const screenBackend: ScreenCaptureBackend = {
  async capture(request) {
    return {
      imageBuffer: Buffer.from('real-provider-fixture'),
      dimensions: request.bounds ? { width: request.bounds.width, height: request.bounds.height } : { width: 1280, height: 720 },
      detectedTextSnippets: ['Visual Studio Code', 'api_key="sk-abcdef1234567890abcdef"']
    };
  }
};

const audioDeviceProvider: AudioInputDeviceProvider = {
  listInputDevices: () => [{ deviceId: 'fixture-mic', label: 'Fixture microphone', isDefault: true, sampleRate: 16000, channels: 1 }]
};

const dictationTransformer: DictationTransformationBackend = {
  async transform({ mode, text, targetLanguage, instructionPrompt }) {
    if (mode === 'translate') return `[Translated to ${targetLanguage}]: ${text}`;
    return `Drafting for "${instructionPrompt || mode}": ${text}`;
  }
};

const clipboardTransformer: ClipboardTransformationBackend = {
  async transform(request) {
    return `${request.action}: ${request.rawClipboardText}`;
  }
};

describe('Phase PX-12: Local Desktop Voice Companion', () => {
  // PX12-T02: Local STT Provider
  describe('PX12-T02: Local STT Provider Abstraction', () => {
    it('discovers registered local models and validates model checksums', () => {
      const stt = new LocalSTTProvider(sttBackend);
      const models = stt.listModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
      expect(models.some(m => m.modelId === 'whisper-base-en')).toBe(true);

      const dummyBuffer = Buffer.from('dummy-model-weights');
      const isValid = stt.verifyModelChecksum('whisper-tiny-en', dummyBuffer);
      expect(isValid).toBe(false);
    });

    it('detects voice activity (VAD) and performs speech-to-text with word timestamps', async () => {
      const stt = new LocalSTTProvider(sttBackend);
      // Generate 16kHz 16-bit PCM test audio (1 second = 32000 bytes)
      const pcmBuffer = Buffer.alloc(32000);
      for (let i = 0; i < 16000; i++) {
        const val = Math.floor(Math.sin(i * 0.1) * 15000);
        pcmBuffer.writeInt16LE(val, i * 2);
      }

      const vad = stt.detectVoiceActivity(pcmBuffer);
      expect(vad.hasSpeech).toBe(true);
      expect(vad.speechEnergy).toBeGreaterThan(0.02);

      const result = await stt.transcribe(pcmBuffer, { enableVAD: true, wordTimestamps: true });
      expect(result.text).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.words?.length).toBeGreaterThan(0);
      expect(result.isLocalOnly).toBe(true);
      expect(result.provider).toBe('whisper_local');
    });

    it('fails closed instead of fabricating a transcript without a native backend', async () => {
      const stt = new LocalSTTProvider();
      await expect(stt.transcribe(Buffer.alloc(32000, 0x20))).rejects.toThrow(/LOCAL_STT_/);
    });
  });

  // PX12-T03: Local TTS Provider
  describe('PX12-T03: Local TTS Provider Abstraction', () => {
    it('synthesizes speech with local voice and includes synthetic media disclosure notice', async () => {
      const tts = new LocalTTSProvider(ttsBackend);
      const voices = tts.listVoices();
      expect(voices.some(v => v.provider === 'kokoro_local')).toBe(true);

      const result = await tts.synthesize('Welcome to the local desktop voice companion.', {
        voiceId: 'kokoro-af-bella',
        speed: 1.0
      });

      expect(result.audioBuffer.length).toBeGreaterThan(44); // Has WAV header + data
      expect(result.audioBuffer.toString('utf8', 0, 4)).toBe('RIFF');
      expect(result.durationSec).toBeGreaterThan(0);
      expect(result.isLocalOnly).toBe(true);
      expect(result.syntheticDisclosureNotice).toContain('AI-generated audio');
    });

    it('blocks cloud voice synthesis unless explicit egress approval is given', async () => {
      const tts = new LocalTTSProvider(ttsBackend);
      await expect(
        tts.synthesize('Test remote cloud speech', {
          voiceId: 'cloud-elevenlabs-rachel',
          isApprovedEgress: false
        })
      ).rejects.toThrow(/requires explicit data-egress approval/);

      const approvedResult = await tts.synthesize('Test remote cloud speech', {
        voiceId: 'cloud-elevenlabs-rachel',
        isApprovedEgress: true
      });
      expect(approvedResult.isLocalOnly).toBe(false);
    });

    it('fails closed instead of emitting a tone without a synthesis backend', async () => {
      const tts = new LocalTTSProvider();
      await expect(tts.synthesize('Real speech required.', { voiceId: 'kokoro-af-bella' })).rejects.toThrow(/TTS_BACKEND_UNAVAILABLE/);
    });
  });

  // PX12-T04: Voice Recording & Hotkeys
  describe('PX12-T04: Recording State Machine & Global Hotkeys', () => {
    it('manages push-to-talk and tap-to-toggle state transitions with duration safeguards', () => {
      const recordingService = new VoiceRecordingService(undefined, audioDeviceProvider);
      expect(recordingService.getState()).toBe('idle');

      // Push-to-talk
      recordingService.startPushToTalk();
      expect(recordingService.getState()).toBe('recording_ptt');

      const chunk = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      recordingService.feedAudioChunk(chunk);

      const recordedBuffer = recordingService.stopPushToTalk();
      expect(recordingService.getState()).toBe('idle');
      expect(recordedBuffer.length).toBe(4);

      // Tap-to-toggle
      const toggleOn = recordingService.toggleRecording();
      expect(toggleOn.state).toBe('recording_toggle');
      recordingService.feedAudioChunk(chunk);
      const toggleOff = recordingService.toggleRecording();
      expect(toggleOff.state).toBe('idle');
      expect(toggleOff.recordedBuffer?.length).toBe(4);
    });

    it('detects hotkey conflicts and lists valid audio input devices', () => {
      const recordingService = new VoiceRecordingService(undefined, audioDeviceProvider);
      const conflictCheck = recordingService.setHotkeys({
        pushToTalkKey: 'F8',
        toggleRecordingKey: 'F8' // Conflict
      });
      expect(conflictCheck.success).toBe(false);
      expect(conflictCheck.conflict).toContain('Hotkey conflict');

      const devices = recordingService.listInputDevices();
      expect(devices.length).toBeGreaterThan(0);
      expect(devices.some(d => d.isDefault)).toBe(true);
    });
  });

  // PX12-T05: Dictation Engine
  describe('PX12-T05: Dictation Modes & Paste Safety', () => {
    it('processes dictation across raw, cleanup, translate, and instruction draft modes', async () => {
      const dictationEngine = new VoiceDictationEngine(new LocalSTTProvider(sttBackend), dictationTransformer);
      const testAudio = Buffer.alloc(16000, 0x10);

      // Cleanup mode
      const cleanupResult = await dictationEngine.processDictation({
        audioBuffer: testAudio,
        mode: 'cleanup_punctuation'
      });
      expect(cleanupResult.processedText).toMatch(/[.!?]$/);
      expect(cleanupResult.requiresPasteConfirmation).toBe(true);

      // Translate mode
      const transResult = await dictationEngine.processDictation({
        audioBuffer: testAudio,
        mode: 'translate',
        targetLanguage: 'fr'
      });
      expect(transResult.processedText).toContain('[Translated to fr]');

      // Instruction draft mode with auto paste consent
      const draftResult = await dictationEngine.processDictation({
        audioBuffer: testAudio,
        mode: 'instruction_draft',
        instructionPrompt: 'Write a commit summary',
        autoPasteConsent: true
      });
      expect(draftResult.processedText).toContain('Drafting for "Write a commit summary"');
      expect(draftResult.requiresPasteConfirmation).toBe(false);
      expect(draftResult.digest).toBeTruthy();
    });

    it('fails closed for model-backed dictation modes without a transformer', async () => {
      const dictationEngine = new VoiceDictationEngine(new LocalSTTProvider(sttBackend));
      await expect(dictationEngine.processDictation({
        audioBuffer: Buffer.alloc(16000, 0x10),
        mode: 'translate',
        targetLanguage: 'fr'
      })).rejects.toThrow(/DICTATION_TRANSFORM_BACKEND_UNAVAILABLE/);
    });
  });

  // PX12-T06: Floating Assistant Panel
  describe('PX12-T06: Floating Assistant Panel & Session Control', () => {
    it('initializes companion sessions with loopback tokens and coordinates multi-turn voice dialog', async () => {
      const assistant = new FloatingAssistantService(new LocalSTTProvider(sttBackend), new LocalTTSProvider(ttsBackend));
      const session = assistant.initializeSession({ isAlwaysOnTop: true });
      expect(session.sessionId).toMatch(/^desk-session-/);
      expect(session.isAlwaysOnTop).toBe(true);
      expect(assistant.validateLoopbackToken(session.loopbackToken)).toBe(true);

      const testAudio = Buffer.alloc(16000, 0x20);
      const queryResult = await assistant.handleVoiceQuery(testAudio, async (text) => {
        return `Handled query: ${text}`;
      });

      expect(queryResult.userText).toBeTruthy();
      expect(queryResult.assistantText).toContain('Handled query:');
      expect(queryResult.audioResponse).toBeInstanceOf(Buffer);

      assistant.stopSpeaking();
      expect(assistant.getSession()?.isSpeaking).toBe(false);
    });
  });

  // PX12-T07: Screen Context Capture
  describe('PX12-T07: Screen Context Capture & Secret Redaction', () => {
    it('captures screen region only on explicit user trigger and redacts sensitive credentials', async () => {
      const screenService = new ScreenContextCaptureService(screenBackend);

      // Reject non-user triggered attempt
      await expect(
        screenService.captureScreen({ userTriggered: false })
      ).rejects.toThrow(/strictly prohibited/);

      const capture = await screenService.captureScreen({
        userTriggered: true,
        bounds: { x: 0, y: 0, width: 800, height: 600 },
        redactSensitiveText: true
      });

      expect(capture.captureId).toMatch(/^screencap-/);
      expect(capture.dimensions.width).toBe(800);
      expect(capture.isEphemeral).toBe(true);

      // Secret scanning
      const scan = screenService.scanForSecrets('Here is api_key="sk-abcdef1234567890abcdef"');
      expect(scan.containsSecrets).toBe(true);
      expect(scan.matches.length).toBeGreaterThan(0);
    });

    it('fails closed instead of fabricating a screenshot without a native backend', async () => {
      const screenService = new ScreenContextCaptureService();
      await expect(screenService.captureScreen({ userTriggered: true })).rejects.toThrow(/SCREEN_CAPTURE_BACKEND_UNAVAILABLE/);
    });
  });

  // PX12-T08: Clipboard Action Service
  describe('PX12-T08: Clipboard Transformation & Security Checks', () => {
    it('executes transformations and blocks write when sensitive secrets are detected', async () => {
      const clipboard = new ClipboardActionService(clipboardTransformer);

      // Normal explain action
      const cleanResult = await clipboard.executeAction({
        action: 'explain',
        rawClipboardText: 'const total = items.reduce((acc, x) => acc + x.price, 0);'
      });
      expect(cleanResult.containsDetectedSecrets).toBe(false);
      expect(cleanResult.isSafeForClipboardWrite).toBe(true);
      expect(cleanResult.resultText).toContain('explain:');

      // Secret detection action
      const secretResult = await clipboard.executeAction({
        action: 'summarize',
        rawClipboardText: 'Connecting to DB with password="mySecretPassword123"'
      });
      expect(secretResult.containsDetectedSecrets).toBe(true);
      expect(secretResult.isSafeForClipboardWrite).toBe(false);
      expect(secretResult.secretWarning).toContain('WARNING');
    });

    it('fails closed for transformations without a model backend while allowing send-to-chat', async () => {
      const clipboard = new ClipboardActionService();
      await expect(clipboard.executeAction({ action: 'summarize', rawClipboardText: 'source' })).rejects.toThrow(/CLIPBOARD_TRANSFORM_BACKEND_UNAVAILABLE/);
      await expect(clipboard.executeAction({ action: 'send_to_chat', rawClipboardText: 'source' })).resolves.toMatchObject({ resultText: 'source' });
    });
  });

  // PX12-T09: Briefings & Hardware Health
  describe('PX12-T09: Daily Briefings, Reminders & Hardware Monitoring', () => {
    it('gathers hardware telemetry, formats daily briefings, and tracks quiet hours', () => {
      const briefingService = new DesktopCompanionBriefingService();
      const hw = briefingService.getHardwareStatus();
      expect(hw.ramTotalBytes).toBeGreaterThan(0);
      expect(hw.diskFreeBytes).toBeGreaterThan(0);

      briefingService.addReminder('Team sync meeting', new Date().toISOString());
      expect(briefingService.listPendingReminders().length).toBe(1);

      const briefing = briefingService.generateDailyBriefing({
        activeProjectName: 'ChatBot Hub Pro'
      });
      expect(briefing.greeting).toBeTruthy();
      expect(briefing.activeProjectName).toBe('ChatBot Hub Pro');
      expect(briefing.hardwareHealth.isHealthy).toBe(true);
    });
  });

  // PX12-T10: Desktop OS Action Sandbox Policy
  describe('PX12-T10: OS Action Sandbox Policy & Guardrails', () => {
    it('allows verified safe actions and blocks arbitrary executable/system commands', () => {
      const policy = new DesktopOSActionPolicy();

      // Valid open approved URL
      const validAction = policy.createAction('open_approved_url', { url: 'https://example.com' });
      const validCheck = policy.validateAction(validAction);
      expect(validCheck.allowed).toBe(true);

      // Deny arbitrary shell command
      const maliciousAction = {
        actionId: 'act-malicious',
        type: 'execute_shell_script' as any,
        parameters: { command: 'rm -rf /' },
        approvalDigest: 'fake-digest'
      };
      const deniedCheck = policy.validateAction(maliciousAction);
      expect(deniedCheck.allowed).toBe(false);
      expect(deniedCheck.reason).toContain('not in the allowlist');

      // Tampered action check
      const tamperedAction = { ...validAction, parameters: { url: 'https://evil.com' } };
      const tamperedCheck = policy.validateAction(tamperedAction);
      expect(tamperedCheck.allowed).toBe(false);
      expect(tamperedCheck.reason).toContain('Approval digest mismatch');
    });
  });

  // PX12-T11 & PX12-T12: Privacy & Desktop Packaging
  describe('PX12-T11 & PX12-T12: Privacy Manager & Packaging Manifest', () => {
    it('enforces default-off retention, purges temp files, and sanitizes support bundles', () => {
      const privacy = new DesktopPrivacyManager();
      const settings = privacy.getSettings();
      expect(settings.retainAudioRecordings).toBe(false);
      expect(settings.retainScreenThumbnails).toBe(false);

      privacy.registerTempFile('/tmp/audio-123.wav');
      privacy.registerTempFile('/tmp/screen-456.png');
      const purge = privacy.purgeAllTemporaryFiles();
      expect(purge.purgedCount).toBe(2);

      const rawDiagnostics = {
        uptime: 120,
        rawAudio: Buffer.from([1, 2, 3]),
        rawClipboardText: 'sensitive-clipboard-data',
        os: 'windows'
      };
      const sanitized = privacy.sanitizeSupportBundle(rawDiagnostics);
      expect(sanitized.rawAudio).toBeUndefined();
      expect(sanitized.rawClipboardText).toBeUndefined();
      expect(sanitized._sanitized).toBe(true);
    });

    it('provides valid Windows desktop companion packaging manifest', () => {
      const manifest = DesktopPackagingManifest.getWindowsPackagingManifest();
      expect(manifest.appId).toBe('com.chatbot.desktop-voice-companion');
      expect(manifest.targetPlatform).toBe('windows_x64');
      expect(manifest.installerType).toBe('nsis_exe');
      expect(manifest.requiredPermissions.some(p => p.permission === 'microphone')).toBe(true);
    });
  });
});
