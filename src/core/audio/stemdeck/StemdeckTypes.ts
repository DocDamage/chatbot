/**
 * Stemdeck & Music Studio Types (PX-11)
 *
 * Types for local stem separation, rights model, Demucs worker adapter,
 * multitrack waveform mixer, audio track analysis, mixdown, and DAW integration.
 */

export type StemType = 'vocals' | 'drums' | 'bass' | 'guitar' | 'piano' | 'other';

export interface AudioRightsDeclaration {
  hasExplicitUserConsent: boolean;
  declarationText: string;
  sourceOwner?: string;
  processingLocation: 'local_only' | 'approved_remote';
  declaredAt: string;
  approvalDigest?: string;
}

export interface AudioPreflightResult {
  valid: boolean;
  audioInfo: {
    durationSeconds: number;
    sampleRate: number;
    channels: number;
    bitDepth: number;
    codec: 'wav' | 'flac' | 'mp3' | 'ogg' | 'aac' | 'aiff' | 'unknown';
    fileSizeBytes: number;
  };
  resourceEstimate: {
    estimatedVramBytes: number;
    estimatedRamBytes: number;
    estimatedDurationMs: number;
    recommendedAcceleration: 'cuda' | 'mps' | 'cpu';
  };
  rightsVerified: boolean;
  error?: string;
}

export interface DemucsWorkerConfig {
  modelName: 'htdemucs' | 'htdemucs_6s' | 'htdemucs_ft' | 'mdx_extra';
  stems: StemType[];
  device: 'auto' | 'cuda' | 'mps' | 'cpu';
  shifts?: number;
  overlap?: number;
  twoStems?: StemType; // If set, extracts selected stem and creates complement
}

export interface StemArtifact {
  stemType: StemType | 'complement' | 'mixdown';
  filePath: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  sha256: string;
  fileSizeBytes: number;
}

export interface WaveformSummary {
  stemType: StemType | 'original' | 'mixdown';
  pointCount: number;
  peaksMin: number[];
  peaksMax: number[];
  rms: number[];
  durationSeconds: number;
}

export interface MixerChannel {
  stemType: StemType | 'complement';
  gainDb: number; // -60 to +12 dB
  pan: number; // -1.0 (Left) to +1.0 (Right)
  mute: boolean;
  solo: boolean;
  monitor: boolean;
}

export interface MultitrackMixerState {
  sessionId: string;
  channels: Record<string, MixerChannel>;
  masterVolumeDb: number;
  playbackPositionSeconds: number;
  loopRegion?: { start: number; end: number };
  timelineDurationSeconds: number;
}

export interface AudioTrackAnalysisResult {
  bpm: number;
  bpmConfidence: number; // 0.0 - 1.0
  key: string; // e.g. "C Major", "A Minor"
  keyConfidence: number; // 0.0 - 1.0
  integratedLufs: number; // e.g. -14.2 LUFS
  loudnessRangeLu: number; // e.g. 6.5 LU
  truePeakDbfs: number; // e.g. -0.5 dBFS
  dynamicRangeScore: number; // 1-10 scale
  sections?: Array<{ name: string; start: number; end: number; energy: number }>;
}

export interface AudioJobState {
  jobId: string;
  sourcePath: string;
  state: 'queued' | 'preflight' | 'separating' | 'analyzing' | 'completed' | 'failed' | 'cancelled';
  stage: string;
  progressPercentage: number; // 0-100
  requestedStems: StemType[];
  createdArtifacts: StemArtifact[];
  analysis?: AudioTrackAnalysisResult;
  waveforms?: Record<string, WaveformSummary>;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface FLStudioTrackRouting {
  trackName: string;
  stemType: StemType | 'complement' | 'mixdown';
  mixerInsertIndex: number;
  colorHex: string;
  sourceFile: string;
  suggestedPluginChain: string[];
}

export interface DAWLayoutProposal {
  dawName: 'FL Studio' | 'Ableton Live' | 'Logic Pro' | 'Reaper';
  tempoBpm: number;
  timeSignature: string;
  tracks: FLStudioTrackRouting[];
  isDryRun: boolean;
  approvalRequired: boolean;
  approvalScopeDigest: string;
}
