/**
 * Video Localization & Dubbing Pipeline Orchestrator (CF-07)
 *
 * Executes the 12 staged media localization steps with consent verification,
 * data-egress warnings, synthetic-media disclosures, and isolated sandboxing.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  VideoLocalizationJob,
  LocalizationStage,
  LocalizationStageResult,
  LocalizationProvenance,
  SyntheticMediaDisclosure,
  verifyVideoLocalizationJobIntegrity,
  LocalizationJobValidationError
} from './VideoLocalizationJob';
import {
  verifyMediaConsentRecord,
  validateConsentForVoiceCloning,
  MediaConsentError
} from './MediaConsentRecord';
import { MediaLocalizationSandbox } from './MediaLocalizationSandbox';

export interface LocalizationEngineAdapter {
  validateMedia(filePath: string): Promise<{ duration: number; resolution: string; sizeBytes: number }>;
  extractAudio(videoPath: string, outputAudioPath: string): Promise<void>;
  separateVocals?(audioPath: string, outputVocalsPath: string, outputBgPath: string): Promise<void>;
  transcribe(audioPath: string, language: string): Promise<{ text: string; segments: Array<{ start: number; end: number; text: string }> }>;
  translate(text: string, sourceLang: string, targetLang: string, provider: string): Promise<string>;
  synthesizeSpeech(text: string, targetLang: string, voiceId?: string, referenceAudio?: string): Promise<Buffer>;
  fitTiming(audioBuffer: Buffer, targetDurationSeconds: number): Promise<Buffer>;
  mixAndReconstruct(options: {
    videoPath: string;
    localizedAudioPath: string;
    subtitlesPath?: string;
    outputPath: string;
  }): Promise<string>;
  applyLipSync?(videoPath: string, audioPath: string, outputPath: string): Promise<string>;
}

export class MockLocalizationEngineAdapter implements LocalizationEngineAdapter {
  async validateMedia(filePath: string): Promise<{ duration: number; resolution: string; sizeBytes: number }> {
    return { duration: 120, resolution: '1080p', sizeBytes: 15 * 1024 * 1024 };
  }

  async extractAudio(videoPath: string, outputAudioPath: string): Promise<void> {
    fs.writeFileSync(outputAudioPath, Buffer.from('RIFF_MOCK_AUDIO_DATA'));
  }

  async separateVocals(audioPath: string, outputVocalsPath: string, outputBgPath: string): Promise<void> {
    fs.writeFileSync(outputVocalsPath, Buffer.from('MOCK_VOCALS_DATA'));
    fs.writeFileSync(outputBgPath, Buffer.from('MOCK_BACKGROUND_DATA'));
  }

  async transcribe(audioPath: string, language: string): Promise<{ text: string; segments: Array<{ start: number; end: number; text: string }> }> {
    return {
      text: 'Hello and welcome to the capability demonstration.',
      segments: [
        { start: 0.0, end: 2.5, text: 'Hello and welcome' },
        { start: 2.5, end: 5.0, text: 'to the capability demonstration.' }
      ]
    };
  }

  async translate(text: string, sourceLang: string, targetLang: string, provider: string): Promise<string> {
    return `[Translated ${targetLang}]: ${text}`;
  }

  async synthesizeSpeech(text: string, targetLang: string, voiceId?: string, referenceAudio?: string): Promise<Buffer> {
    return Buffer.from(`MOCK_SYNTHESIZED_SPEECH_${targetLang}_${text.slice(0, 20)}`);
  }

  async fitTiming(audioBuffer: Buffer, targetDurationSeconds: number): Promise<Buffer> {
    return audioBuffer;
  }

  async mixAndReconstruct(options: {
    videoPath: string;
    localizedAudioPath: string;
    subtitlesPath?: string;
    outputPath: string;
  }): Promise<string> {
    fs.writeFileSync(options.outputPath, Buffer.from('MOCK_LOCALIZED_VIDEO_MP4'));
    return options.outputPath;
  }

  async applyLipSync(videoPath: string, audioPath: string, outputPath: string): Promise<string> {
    fs.writeFileSync(outputPath, Buffer.from('MOCK_LIPSYNC_VIDEO_MP4'));
    return outputPath;
  }
}

export class VideoLocalizationPipeline {
  private readonly exportBaseDir: string;
  private deadlines = new Map<string, number>();
  private activeJobs = new Map<string, {
    job: VideoLocalizationJob;
    sandbox: MediaLocalizationSandbox;
    cancelled: boolean;
  }>();

  constructor(options: { exportBaseDir?: string } = {}) {
    this.exportBaseDir = options.exportBaseDir || path.resolve(process.cwd(), 'temp', 'media-localization-exports');
  }

  /**
   * Execute all 12 stages of media localization
   */
  public async executePipeline(
    job: VideoLocalizationJob,
    engine?: LocalizationEngineAdapter
  ): Promise<VideoLocalizationJob> {
    if (!engine) {
      throw new LocalizationJobValidationError('A concrete LocalizationEngineAdapter is required. MockLocalizationEngineAdapter is test-only.');
    }
    const adapter = engine;

    // 1. Check Job Integrity
    if (!verifyVideoLocalizationJobIntegrity(job)) {
      job.status = 'failed';
      job.error = 'Cryptographic job digest mismatch: Job contract was modified.';
      throw new LocalizationJobValidationError(job.error);
    }

    // 2. Initialize Sandbox
    const sandbox = new MediaLocalizationSandbox(job.jobId, {
      maxDiskBytes: job.budget.maxDiskBytes
    });
    const paths = await sandbox.initialize();

    const activeEntry = {
      job,
      sandbox,
      cancelled: false
    };
    this.activeJobs.set(job.jobId, activeEntry);
    this.deadlines.set(job.jobId, Date.now() + job.budget.timeoutMs);

    job.status = 'running';
    const pipelineStartTime = Date.now();

    try {
      // Stage 1: Preflight
      await this.runStage(job, 'preflight', async () => {
        if (!verifyMediaConsentRecord(job.consentRecord)) {
          throw new MediaConsentError('Invalid or expired MediaConsentRecord.');
        }

        if (job.voiceSettings.useVoiceCloning) {
          validateConsentForVoiceCloning(job.consentRecord);
        }

        if (job.translationSettings.provider === 'google_translate' && !job.translationSettings.dataEgressWarningAcknowledged) {
          throw new LocalizationJobValidationError('Data egress warning must be acknowledged for remote translation.');
        }

        return {};
      });

      if (activeEntry.cancelled) return this.handleCancelled(job);

      // Stage 2: Validate Media
      let mediaMeta: { duration: number; resolution: string; sizeBytes: number } = { duration: 0, resolution: '1080p', sizeBytes: 0 };
      await this.runStage(job, 'validate_media', async () => {
        mediaMeta = await adapter.validateMedia(job.sourceFilePath);

        if (mediaMeta.duration > job.budget.maxDurationSeconds) {
          throw new LocalizationJobValidationError(`Media duration (${mediaMeta.duration}s) exceeds budget cap of ${job.budget.maxDurationSeconds}s.`);
        }

        if (mediaMeta.sizeBytes > job.budget.maxFileSizeBytes) {
          throw new LocalizationJobValidationError(`Media file size (${mediaMeta.sizeBytes} bytes) exceeds budget cap of ${job.budget.maxFileSizeBytes} bytes.`);
        }
        const resolutionRank: Record<string, number> = { '720p': 1, '1080p': 2, '4k': 3 };
        if (!resolutionRank[mediaMeta.resolution] || resolutionRank[mediaMeta.resolution] > resolutionRank[job.budget.maxResolution]) {
          throw new LocalizationJobValidationError(`Media resolution (${mediaMeta.resolution}) exceeds budget cap of ${job.budget.maxResolution}.`);
        }

        return {
          duration: String(mediaMeta.duration),
          resolution: mediaMeta.resolution,
          sizeBytes: String(mediaMeta.sizeBytes)
        };
      });

      if (activeEntry.cancelled) return this.handleCancelled(job);

      // Stage 3: Extract Audio
      const extractedAudioPath = path.join(paths.audio, 'source_audio.wav');
      await this.runStage(job, 'extract_audio', async () => {
        await adapter.extractAudio(job.sourceFilePath, extractedAudioPath);
        return { audioPath: extractedAudioPath };
      });

      if (activeEntry.cancelled) return this.handleCancelled(job);

      // Stage 4: Separate Vocals
      const vocalsPath = path.join(paths.vocals, 'vocals.wav');
      const bgAudioPath = path.join(paths.vocals, 'background.wav');
      await this.runStage(job, 'separate_vocals', async () => {
        if (adapter.separateVocals) {
          await adapter.separateVocals(extractedAudioPath, vocalsPath, bgAudioPath);
          return { vocalsPath, bgAudioPath };
        }
        return { note: 'Vocal separation skipped or not supported by adapter.' };
      });

      if (activeEntry.cancelled) return this.handleCancelled(job);

      // Stage 5: Transcribe & Align
      let transcriptText = '';
      let transcriptSegments: Array<{ start: number; end: number; text: string }> = [];
      const subtitlesPath = path.join(paths.subtitles, 'source_subtitles.srt');

      await this.runStage(job, 'transcribe_align', async () => {
        const inputAudio = fs.existsSync(vocalsPath) ? vocalsPath : extractedAudioPath;
        const res = await adapter.transcribe(inputAudio, job.sourceLanguage);
        transcriptText = res.text;
        transcriptSegments = res.segments;

        // Generate SRT content
        const srt = this.generateSrt(transcriptSegments);
        fs.writeFileSync(subtitlesPath, srt);

        return {
          subtitlesPath,
          segmentCount: String(transcriptSegments.length),
          textSnippet: transcriptText.slice(0, 100)
        };
      });

      if (activeEntry.cancelled) return this.handleCancelled(job);

      // Stage 6: Review Transcript
      await this.runStage(job, 'review_transcript', async () => {
        if (!transcriptText || transcriptText.trim() === '') {
          throw new LocalizationJobValidationError('Transcription produced empty output.');
        }
        return { status: 'reviewed', charCount: String(transcriptText.length) };
      });

      if (activeEntry.cancelled) return this.handleCancelled(job);

      // Stage 7: Translate
      let translatedText = '';
      const translatedSubtitlesPath = path.join(paths.subtitles, `translated_${job.targetLanguage}.srt`);

      await this.runStage(job, 'translate', async () => {
        translatedText = await adapter.translate(
          transcriptText,
          job.sourceLanguage,
          job.targetLanguage,
          job.translationSettings.provider
        );

        const translatedSegments = transcriptSegments.map(s => ({
          ...s,
          text: `[${job.targetLanguage}] ${s.text}`
        }));

        fs.writeFileSync(translatedSubtitlesPath, this.generateSrt(translatedSegments));

        const warnings: string[] = [];
        if (job.translationSettings.provider === 'google_translate') {
          warnings.push('Data egress warning: Content was translated using external service.');
        }

        return {
          translatedSubtitlesPath,
          provider: job.translationSettings.provider,
          charCount: String(translatedText.length)
        };
      });

      if (activeEntry.cancelled) return this.handleCancelled(job);

      // Stage 8: Synthesize Voice
      let rawSynthesizedAudio: Buffer = Buffer.alloc(0);
      await this.runStage(job, 'synthesize_voice', async () => {
        if (job.voiceSettings.useVoiceCloning) {
          validateConsentForVoiceCloning(job.consentRecord);
        }

        rawSynthesizedAudio = await adapter.synthesizeSpeech(
          translatedText,
          job.targetLanguage,
          job.voiceSettings.targetVoiceId,
          job.voiceSettings.referenceAudioPath
        );

        return {
          synthesizedBytes: String(rawSynthesizedAudio.byteLength),
          useCloning: String(job.voiceSettings.useVoiceCloning)
        };
      });

      if (activeEntry.cancelled) return this.handleCancelled(job);

      // Stage 9: Fit Timing
      const localizedAudioPath = path.join(paths.audio, `localized_${job.targetLanguage}.wav`);
      await this.runStage(job, 'fit_timing', async () => {
        const fittedBuffer = await adapter.fitTiming(rawSynthesizedAudio, mediaMeta.duration);
        fs.writeFileSync(localizedAudioPath, fittedBuffer);
        return { localizedAudioPath, sizeBytes: String(fittedBuffer.byteLength) };
      });

      if (activeEntry.cancelled) return this.handleCancelled(job);

      // Stage 10: Reconstruct & Mix
      let mixedVideoPath = path.join(paths.output, `localized_${job.targetLanguage}.mp4`);
      await this.runStage(job, 'reconstruct_mix', async () => {
        mixedVideoPath = await adapter.mixAndReconstruct({
          videoPath: job.sourceFilePath,
          localizedAudioPath,
          subtitlesPath: translatedSubtitlesPath,
          outputPath: mixedVideoPath
        });
        return { mixedVideoPath };
      });

      if (activeEntry.cancelled) return this.handleCancelled(job);

      // Stage 11: Optional Lip Sync
      let finalVideoPath = mixedVideoPath;
      if (job.lipSyncEnabled && adapter.applyLipSync) {
        await this.runStage(job, 'lip_sync', async () => {
          const lipSyncedPath = path.join(paths.output, `lipsync_${job.targetLanguage}.mp4`);
          finalVideoPath = await adapter.applyLipSync!(mixedVideoPath, localizedAudioPath, lipSyncedPath);
          return { finalVideoPath };
        });
      }

      if (activeEntry.cancelled) return this.handleCancelled(job);

      // Stage 12: Finalize & Export with Synthetic Media Disclosure
      await this.runStage(job, 'finalize_export', async () => {
        const disclosure: SyntheticMediaDisclosure = {
          isSynthetic: true,
          notice: 'Synthetic Media Notice: This media contains AI-generated voice localization and translated speech.',
          sourceLanguage: job.sourceLanguage,
          targetLanguage: job.targetLanguage,
          modelsUsed: {
            stt: 'whisper-local',
            translation: job.translationSettings.provider,
            tts: job.voiceSettings.useVoiceCloning ? 'voice-cloner-local' : 'tts-standard'
          },
          generatedAt: new Date().toISOString()
        };

        const provenance: LocalizationProvenance = {
          jobId: job.jobId,
          consentId: job.consentRecord.consentId,
          sourceFileHash: job.sourceFileHash,
          sourceLanguage: job.sourceLanguage,
          targetLanguage: job.targetLanguage,
          replaySeed: job.replaySeed,
          configDigest: job.jobDigest,
          providers: {
            stt: 'whisper-local',
            translation: job.translationSettings.provider,
            translationIsLocal: job.translationSettings.provider === 'local_offline',
            tts: 'tts-standard',
            lipSyncOptional: job.lipSyncEnabled ? 'wav2lip-local' : undefined
          },
          disclosure,
          exportedAt: new Date().toISOString()
        };

        // Write metadata sidecar manifest
        const metadataManifestPath = path.join(paths.output, 'localization_manifest.json');
        fs.writeFileSync(metadataManifestPath, JSON.stringify(provenance, null, 2));

        const exportDir = path.join(this.exportBaseDir, job.jobId);
        fs.mkdirSync(exportDir, { recursive: true });
        const retainedVideoPath = path.join(exportDir, path.basename(finalVideoPath));
        const retainedManifestPath = path.join(exportDir, 'localization_manifest.json');
        const retainedSubtitlesPath = path.join(exportDir, path.basename(translatedSubtitlesPath));
        fs.copyFileSync(finalVideoPath, retainedVideoPath);
        fs.copyFileSync(metadataManifestPath, retainedManifestPath);
        fs.copyFileSync(translatedSubtitlesPath, retainedSubtitlesPath);

        job.provenance = provenance;
        job.outputFilePath = retainedVideoPath;

        return {
          finalVideoPath: retainedVideoPath,
          metadataManifestPath: retainedManifestPath,
          translatedSubtitlesPath: retainedSubtitlesPath,
          disclosureNotice: disclosure.notice
        };
      });

      // Pipeline completed successfully
      job.status = 'completed';
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message || String(err);
      throw err;
    } finally {
      // Clean up sandbox intermediate directories
      await sandbox.cleanup();
      this.activeJobs.delete(job.jobId);
      this.deadlines.delete(job.jobId);
    }

    return job;
  }

  private async runStage(
    job: VideoLocalizationJob,
    stage: LocalizationStage,
    fn: () => Promise<Record<string, any>>
  ): Promise<void> {
    job.currentStage = stage;
    const start = Date.now();
    let timeout: NodeJS.Timeout | undefined;
    try {
      const deadline = this.deadlines.get(job.jobId) || Number.MAX_SAFE_INTEGER;
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        throw new LocalizationJobValidationError(`Localization pipeline exceeded timeout budget of ${job.budget.timeoutMs}ms.`);
      }
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new LocalizationJobValidationError(
          `Localization pipeline exceeded timeout budget of ${job.budget.timeoutMs}ms.`
        )), remainingMs);
      });
      const artifacts = await Promise.race([fn(), timeoutPromise]);
      job.stageResults[stage] = {
        stage,
        durationMs: Date.now() - start,
        success: true,
        artifacts
      };
    } catch (err: any) {
      job.stageResults[stage] = {
        stage,
        durationMs: Date.now() - start,
        success: false,
        error: err.message || String(err)
      };
      throw err;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private handleCancelled(job: VideoLocalizationJob): VideoLocalizationJob {
    job.status = 'cancelled';
    job.error = 'Job was cancelled by operator.';
    return job;
  }

  /**
   * Cancel an in-flight localization job
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    const entry = this.activeJobs.get(jobId);
    if (!entry) return false;

    entry.cancelled = true;
    entry.job.status = 'cancelled';
    await entry.sandbox.cleanup();
    this.activeJobs.delete(jobId);
    return true;
  }

  private generateSrt(segments: Array<{ start: number; end: number; text: string }>): string {
    return segments.map((seg, idx) => {
      return `${idx + 1}\n${this.formatTime(seg.start)} --> ${this.formatTime(seg.end)}\n${seg.text}\n`;
    }).join('\n');
  }

  private formatTime(sec: number): string {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);

    const pad = (n: number, z = 2) => String(n).padStart(z, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(ms, 3)}`;
  }
}
