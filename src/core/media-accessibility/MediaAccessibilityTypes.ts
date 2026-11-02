/**
 * Media Accessibility & Dubbing Studio Types (PX-13)
 *
 * Data structures and contracts for media projects, burned-in subtitle OCR,
 * subtitle editing, speech alignment, translation variants, consent-aware dubbing,
 * document narration, EPUB 3 SMIL read-along, and storage lifecycles.
 */

export interface SubtitleCue {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  speakerId?: string;
  confidence?: number;
  style?: {
    fontName?: string;
    fontSize?: number;
    primaryColor?: string;
    alignment?: 'bottom_center' | 'top_center' | 'bottom_left';
  };
}

export interface SubtitleCropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  previewSampleTimeSec?: number;
}

export interface SubtitleOcrJobOptions {
  videoPath: string;
  cropRegion: SubtitleCropRegion;
  language?: string;
  frameSampleRateFps?: number; // e.g. 2 fps
  confidenceThreshold?: number; // 0.0 to 1.0
  maxFramesToProcess?: number;
}

export interface SubtitleOcrResult {
  jobId: string;
  extractedCues: SubtitleCue[];
  totalFramesProcessed: number;
  averageConfidence: number;
  deduplicatedCount: number;
  processingDurationMs: number;
}

export interface MediaTrackStream {
  streamIndex: number;
  codec: string;
  type: 'video' | 'audio' | 'subtitle';
  language?: string;
  durationSec: number;
  bitrateKbps?: number;
  sampleRate?: number;
  channels?: number;
  resolution?: { width: number; height: number };
}

export interface MediaProject {
  projectId: string;
  title: string;
  sourceFilePath: string;
  originalLanguage: string;
  durationSec: number;
  streams: MediaTrackStream[];
  primaryCues: SubtitleCue[];
  translationVariants: Map<string, SubtitleCue[]> | Record<string, SubtitleCue[]>;
  selectedVoices: Record<string, string>; // speakerId -> voiceId
  provenance: {
    sourceHash: string;
    rightsConfirmed: boolean;
    createdAt: string;
    lastModifiedAt: string;
  };
  retentionDays: number;
}

export interface VoiceConsentRecord {
  consentId: string;
  subjectName: string;
  subjectIdentityConfirmed: boolean;
  permittedPurpose: 'personal_accessibility' | 'commercial_dubbing' | 'educational_narration';
  syntheticDisclosureRequired: boolean;
  signedAt: string;
  expiresAt?: string;
}

export interface DubbingTrackJobOptions {
  projectId: string;
  targetLanguage: string;
  voiceId: string;
  consentRecord?: VoiceConsentRecord;
  duckOriginalAudio: boolean;
  originalAudioVolumeRatio?: number; // e.g. 0.15 during speech
  allowSpeedAdjustment: boolean;
  maxSpeedFactor?: number; // e.g. 1.35
}

export interface DubbingJobResult {
  jobId: string;
  targetLanguage: string;
  outputAudioPath: string;
  durationSec: number;
  cueCount: number;
  speedAdjustedCuesCount: number;
  syntheticDisclosureNotice: string;
  artifactsCreated: string[];
}

export interface DocumentChapter {
  chapterIndex: number;
  title: string;
  sourcePageNumber?: number;
  rawText: string;
  cleanedText: string;
  estimatedReadingTimeMin: number;
}

export interface DocumentNarrationJobOptions {
  documentTitle: string;
  chapters: DocumentChapter[];
  voiceId: string;
  sampleRate?: number;
}

export interface DocumentNarrationResult {
  narrationId: string;
  documentTitle: string;
  chaptersSynthesized: number;
  totalAudioDurationSec: number;
  chapterAudioPaths: Array<{ chapterIndex: number; title: string; audioPath: string; durationSec: number }>;
  manifestPackagePath: string;
}

export interface ReadAlongWordMap {
  text: string;
  startSec: number;
  endSec: number;
}

export interface ReadAlongSentenceMap {
  sentenceId: string;
  text: string;
  startSec: number;
  endSec: number;
  words: ReadAlongWordMap[];
}

export interface ReadAlongPackage {
  packageId: string;
  title: string;
  audioFilePath: string;
  totalDurationSec: number;
  sentences: ReadAlongSentenceMap[];
  epubSmilXml: string;
  webPlayerPayload: Record<string, any>;
  accessibilityConformance: {
    wcagLevel: 'AA' | 'AAA';
    synchronizedTextHighlight: boolean;
    screenReaderAccessible: boolean;
  };
}

export interface AuthorizedUrlIngestOptions {
  sourceUrl: string;
  userRightsConfirmed: boolean;
  maxDurationSec?: number;
  maxSizeBytes?: number;
}
