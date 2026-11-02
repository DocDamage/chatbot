/**
 * Local STT Provider Abstraction (PX12-T02)
 *
 * Implements speech-to-text with local Whisper/whisper.cpp engine models,
 * explicit model discovery/checksum licensing, voice activity detection (VAD),
 * and word-level timestamp generation without cloud egress.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  STTTranscriptionOptions,
  STTTranscriptionResult,
  ModelChecksumNotice
} from './VoiceCompanionTypes';

export interface LocalSTTBackend {
  transcribe(
    audioBuffer: Buffer,
    model: ModelChecksumNotice,
    options: STTTranscriptionOptions
  ): Promise<STTTranscriptionResult>;
}

export class LocalSTTProvider {
  private registeredModels: Map<string, ModelChecksumNotice> = new Map();
  private activeModelId: string = 'whisper-base-en';
  private readonly backend?: LocalSTTBackend;
  private readonly modelRoot: string;

  constructor(backend?: LocalSTTBackend, modelRoot = process.cwd()) {
    this.backend = backend;
    this.modelRoot = modelRoot;
    this.initializeDefaultModels();
  }

  private initializeDefaultModels(): void {
    const defaultModels: ModelChecksumNotice[] = [
      {
        modelId: 'whisper-tiny-en',
        name: 'Whisper Tiny (English)',
        checksumSha256: 'be07e048b1e599d0f77f300263d6770f8de4c20b9f3057500f472930c6de7349',
        sizeBytes: 77700000,
        license: 'MIT',
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
        isDownloaded: true,
        localPath: 'models/stt/ggml-tiny.en.bin'
      },
      {
        modelId: 'whisper-base-en',
        name: 'Whisper Base (English)',
        checksumSha256: '60ed5bc3dd14eea856493d33af7c79b2016d77f52618a45b64d2320167135961',
        sizeBytes: 147951437,
        license: 'MIT',
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
        isDownloaded: true,
        localPath: 'models/stt/ggml-base.en.bin'
      },
      {
        modelId: 'whisper-small-multi',
        name: 'Whisper Small Multilingual',
        checksumSha256: '55356615c3b313ef08a29830741402340f6f4fa66f54185b01e90cb33d730236',
        sizeBytes: 487700000,
        license: 'MIT',
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
        isDownloaded: false
      }
    ];

    for (const m of defaultModels) {
      if (m.localPath) {
        m.isDownloaded = Boolean(this.backend) || fs.existsSync(path.resolve(this.modelRoot, m.localPath));
      }
      this.registeredModels.set(m.modelId, m);
    }
  }

  public isAvailable(): boolean {
    const model = this.registeredModels.get(this.activeModelId);
    return Boolean(this.backend && model?.isDownloaded);
  }

  public listModels(): ModelChecksumNotice[] {
    return Array.from(this.registeredModels.values());
  }

  public getModel(modelId: string): ModelChecksumNotice | undefined {
    return this.registeredModels.get(modelId);
  }

  public verifyModelChecksum(modelId: string, fileBuffer: Buffer): boolean {
    const model = this.registeredModels.get(modelId);
    if (!model) return false;
    const computed = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    return computed.toLowerCase() === model.checksumSha256.toLowerCase();
  }

  public setActiveModel(modelId: string): void {
    if (!this.registeredModels.has(modelId)) {
      throw new Error(`Model ${modelId} is not registered in LocalSTTProvider.`);
    }
    this.activeModelId = modelId;
  }

  /**
   * Simple Voice Activity Detection (VAD) based on audio buffer energy.
   */
  public detectVoiceActivity(audioBuffer: Buffer, threshold = 0.02): { hasSpeech: boolean; speechEnergy: number } {
    if (!audioBuffer || audioBuffer.length === 0) {
      return { hasSpeech: false, speechEnergy: 0 };
    }

    let sumSquares = 0;
    const step = 2; // 16-bit PCM
    const sampleCount = Math.floor(audioBuffer.length / step);
    for (let i = 0; i < audioBuffer.length - 1; i += step) {
      const sample = audioBuffer.readInt16LE(i) / 32768.0;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, sampleCount));
    return {
      hasSpeech: rms >= threshold,
      speechEnergy: Number(rms.toFixed(4))
    };
  }

  /**
   * Transcribe local audio buffer into text and word timestamps.
   */
  public async transcribe(
    audioBuffer: Buffer,
    options: STTTranscriptionOptions = {}
  ): Promise<STTTranscriptionResult> {
    const startTime = Date.now();
    const model = this.registeredModels.get(this.activeModelId);

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is empty. Transcription aborted.');
    }

    // Run VAD check if enabled
    if (options.enableVAD) {
      const vad = this.detectVoiceActivity(audioBuffer, options.vadThreshold ?? 0.015);
      if (!vad.hasSpeech) {
        return {
          text: '',
          confidence: 1.0,
          durationSec: 0,
          language: options.language || 'en',
          words: [],
          processingTimeMs: Date.now() - startTime,
          provider: 'whisper_local',
          modelUsed: model?.name || this.activeModelId,
          isLocalOnly: true
        };
      }
    }

    if (!model?.isDownloaded) {
      throw new Error(`LOCAL_STT_MODEL_UNAVAILABLE: ${this.activeModelId} is not installed at its registered local path.`);
    }
    if (!this.backend) {
      throw new Error('LOCAL_STT_BACKEND_UNAVAILABLE: configure a verified local transcription backend before using dictation.');
    }
    const result = await this.backend.transcribe(audioBuffer, model, options);
    return { ...result, processingTimeMs: Math.max(result.processingTimeMs, Date.now() - startTime), isLocalOnly: true };
  }
}
