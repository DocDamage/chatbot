/**
 * Voice Companion Types & Interfaces (PX-12)
 *
 * Defines contracts for local desktop voice companion, STT/TTS abstractions,
 * global hotkey & recording states, dictation modes, screen capture context,
 * clipboard security gating, briefings, and OS action sandboxing.
 */

export type STTProviderType = 'whisper_local' | 'whisper_cpp' | 'parakeet_local' | 'cloud_whisper';
export type TTSProviderType = 'os_native' | 'kokoro_local' | 'piper_local' | 'cloud_elevenlabs' | 'cloud_cartesia';

export interface ModelChecksumNotice {
  modelId: string;
  name: string;
  checksumSha256: string;
  sizeBytes: number;
  license: string;
  downloadUrl?: string;
  isDownloaded: boolean;
  localPath?: string;
}

export interface STTTranscriptionOptions {
  language?: string;
  enableVAD?: boolean;
  vadThreshold?: number; // 0.0 to 1.0
  wordTimestamps?: boolean;
  temperature?: number;
  prompt?: string;
}

export interface WordTimestamp {
  word: string;
  startSec: number;
  endSec: number;
  confidence: number;
}

export interface STTTranscriptionResult {
  text: string;
  confidence: number;
  durationSec: number;
  language: string;
  words?: WordTimestamp[];
  processingTimeMs: number;
  provider: STTProviderType;
  modelUsed: string;
  isLocalOnly: boolean;
}

export interface TTSSynthesisOptions {
  voiceId: string;
  speed?: number; // 0.5 to 2.0
  pitch?: number; // -10 to +10
  format?: 'wav' | 'mp3' | 'pcm';
  sampleRate?: number;
  isApprovedEgress?: boolean;
}

export interface TTSSynthesisResult {
  audioBuffer: Buffer;
  durationSec: number;
  sampleRate: number;
  voiceId: string;
  provider: TTSProviderType;
  syntheticDisclosureNotice: string;
  isLocalOnly: boolean;
}

export interface HotkeyConfig {
  pushToTalkKey?: string;
  toggleRecordingKey?: string;
  summonPanelKey?: string;
  screenCaptureKey?: string;
  clipboardActionKey?: string;
}

export type RecordingState = 'idle' | 'recording_ptt' | 'recording_toggle' | 'processing' | 'paused' | 'error';

export interface AudioInputDevice {
  deviceId: string;
  label: string;
  isDefault: boolean;
  sampleRate: number;
  channels: number;
}

export type DictationMode =
  | 'raw_transcription'
  | 'cleanup_punctuation'
  | 'translate'
  | 'instruction_draft'
  | 'code_draft';

export interface DictationRequest {
  audioBuffer: Buffer;
  mode: DictationMode;
  targetLanguage?: string;
  instructionPrompt?: string;
  autoPasteConsent?: boolean;
}

export interface DictationResult {
  rawText: string;
  processedText: string;
  mode: DictationMode;
  targetLanguage?: string;
  confidence: number;
  requiresPasteConfirmation: boolean;
  digest: string;
}

export interface ScreenRegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  displayId?: string;
}

export interface ScreenCaptureRequest {
  bounds?: ScreenRegionBounds;
  windowTitle?: string;
  downscaleWidth?: number;
  downscaleHeight?: number;
  redactSensitiveText?: boolean;
  userTriggered: boolean;
}

export interface ScreenCaptureResult {
  captureId: string;
  imageBuffer: Buffer;
  dimensions: { width: number; height: number };
  detectedTextSnippets?: string[];
  redactedAreasCount: number;
  capturedAt: string;
  isEphemeral: boolean;
  egressDestination?: string;
}

export type ClipboardActionType = 'summarize' | 'translate' | 'explain' | 'rewrite' | 'code_fix' | 'send_to_chat';

export interface ClipboardActionRequest {
  action: ClipboardActionType;
  rawClipboardText: string;
  targetLanguage?: string;
  additionalContext?: string;
}

export interface ClipboardActionResult {
  action: ClipboardActionType;
  sourceTextExcerpt: string;
  resultText: string;
  containsDetectedSecrets: boolean;
  secretWarning?: string;
  isSafeForClipboardWrite: boolean;
}

export interface HardwareStatusSnapshot {
  cpuUsagePercent: number;
  ramUsageBytes: number;
  ramTotalBytes: number;
  vramUsageBytes?: number;
  vramTotalBytes?: number;
  diskFreeBytes: number;
  isHealthy: boolean;
  alerts: string[];
}

export interface CompanionBriefing {
  date: string;
  greeting: string;
  activeProjectName?: string;
  memoryRecapItems: string[];
  pendingReminders: Array<{ id: string; title: string; dueAt: string }>;
  hardwareHealth: HardwareStatusSnapshot;
  isQuietHours: boolean;
}

export interface DesktopOSAction {
  actionId: string;
  type: 'open_chatbot' | 'paste_approved_text' | 'show_notification' | 'open_approved_url';
  parameters: Record<string, any>;
  approvalDigest: string;
}

export interface DesktopPrivacySettings {
  retainAudioRecordings: boolean;
  retainScreenThumbnails: boolean;
  allowMicrophone: boolean;
  allowScreenCapture: boolean;
  allowClipboardAccess: boolean;
  enableWakePhrase: boolean;
  quietHours: { enabled: boolean; startHour: number; endHour: number };
}
