/**
 * Local Audio, Voice, & Speech Provider Contracts (PX-07 / PX07-T08)
 * Standardized provider interfaces for local TTS (Text-to-Speech),
 * STT (Speech-to-Text), and audio stem/synthesis adapters.
 */

export interface LocalTTSOptions {
  voiceId?: string;
  speed?: number;
  pitch?: number;
  format?: 'wav' | 'mp3' | 'ogg' | 'pcm';
  sampleRate?: number;
  signal?: AbortSignal;
}

export interface LocalTTSResult {
  audioBuffer: Buffer;
  mimeType: string;
  sampleRate: number;
  durationSeconds: number;
  tokensOrCharactersProcessed: number;
  latencyMs: number;
}

export interface LocalSTTOptions {
  language?: string;
  temperature?: number;
  prompt?: string;
  wordTimestamps?: boolean;
  signal?: AbortSignal;
}

export interface LocalSTTWordTiming {
  word: string;
  startSeconds: number;
  endSeconds: number;
  confidence: number;
}

export interface LocalSTTResult {
  text: string;
  language?: string;
  durationSeconds: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    words?: LocalSTTWordTiming[];
  }>;
  latencyMs: number;
}

export interface LocalStemSeparationOptions {
  stemsCount?: 2 | 4 | 6; // e.g. vocal, drums, bass, other, piano, guitar
  outputFormat?: 'wav' | 'flac';
  sampleRate?: number;
  signal?: AbortSignal;
}

export interface LocalStemSeparationResult {
  stems: Record<string, Buffer>;
  sampleRate: number;
  durationSeconds: number;
  processingTimeMs: number;
}

export interface LocalTTSProvider {
  getProviderName(): string;
  listVoices(): Promise<Array<{ id: string; name: string; language: string; gender?: string }>>;
  synthesize(text: string, options?: LocalTTSOptions): Promise<LocalTTSResult>;
}

export interface LocalSTTProvider {
  getProviderName(): string;
  transcribe(audioData: Buffer, options?: LocalSTTOptions): Promise<LocalSTTResult>;
}

export interface LocalStemSeparationProvider {
  getProviderName(): string;
  separateStems(audioData: Buffer, options?: LocalStemSeparationOptions): Promise<LocalStemSeparationResult>;
}
