import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DubbingRenderBackend } from '../media-accessibility/AudioTimingFitReconstructor';
import { DocumentNarrationBackend } from '../media-accessibility/DocumentNarrationEngine';
import { SubtitleOcrBackend } from '../media-accessibility/SubtitleOcrEngine';
import { DocumentNarrationJobOptions, SubtitleCue, SubtitleOcrJobOptions, DubbingTrackJobOptions } from '../media-accessibility/MediaAccessibilityTypes';
import { LocalTTSProvider } from '../voice-companion/LocalTTSProvider';
import { runNativeCommand } from './NativeCommandRunner';

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'artifact';
}

function removeDirectory(directory: string): void {
  try { fs.rmSync(directory, { recursive: true, force: true }); } catch { /* best effort */ }
}

async function probeAudio(ffprobePath: string, audioPath: string): Promise<{ durationSec: number; sampleRate: number; channels: number }> {
  const result = await runNativeCommand(ffprobePath, [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=sample_rate,channels:format=duration', '-of', 'json', audioPath
  ], { timeoutMs: 30_000 });
  if (result.exitCode !== 0) throw new Error(`FFprobe failed: ${result.stderr.trim()}`);
  const payload = JSON.parse(result.stdout);
  return {
    durationSec: Number(payload.format?.duration || 0),
    sampleRate: Number(payload.streams?.[0]?.sample_rate || 0),
    channels: Number(payload.streams?.[0]?.channels || 0)
  };
}

function ocrLanguage(language?: string): string {
  const map: Record<string, string> = { en: 'eng', es: 'spa', fr: 'fra', de: 'deu', it: 'ita', pt: 'por', ja: 'jpn', ko: 'kor', zh: 'chi_sim' };
  return map[(language || 'en').toLowerCase()] || language || 'eng';
}

export class FfmpegTesseractSubtitleOcrBackend implements SubtitleOcrBackend {
  constructor(private readonly ffmpegPath: string) {}

  public async extractCandidates(options: SubtitleOcrJobOptions) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-subtitle-ocr-'));
    const framePattern = path.join(tempDir, 'frame-%06d.png');
    const fps = Math.max(0.1, Math.min(10, options.frameSampleRateFps || 2));
    const maxFrames = Math.max(1, Math.min(1000, options.maxFramesToProcess || 100));
    const crop = options.cropRegion;
    try {
      const extraction = await runNativeCommand(this.ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-i', options.videoPath,
        '-vf', `fps=${fps},crop=${Math.round(crop.width)}:${Math.round(crop.height)}:${Math.round(crop.x)}:${Math.round(crop.y)}`,
        '-frames:v', String(maxFrames), framePattern
      ], { timeoutMs: 10 * 60_000 });
      if (extraction.exitCode !== 0) throw new Error(`Subtitle frame extraction failed: ${extraction.stderr.trim()}`);

      const frames = fs.readdirSync(tempDir).filter(file => /^frame-\d+\.png$/i.test(file)).sort();
      const tesseract = require('tesseract.js') as {
        createWorker(language: string): Promise<{
          recognize(input: string): Promise<{ data: { text?: string; confidence?: number } }>;
          terminate(): Promise<void>;
        }>;
      };
      const worker = await tesseract.createWorker(ocrLanguage(options.language));
      const candidates: Array<{ timeSec: number; text: string; confidence: number }> = [];
      try {
        for (let index = 0; index < frames.length; index++) {
          const recognized = await worker.recognize(path.join(tempDir, frames[index]));
          const text = String(recognized.data.text || '').replace(/\s+/g, ' ').trim();
          if (text) candidates.push({
            timeSec: Number((index / fps).toFixed(3)),
            text,
            confidence: Math.max(0, Math.min(1, Number(recognized.data.confidence || 0) / 100))
          });
        }
      } finally {
        await worker.terminate();
      }
      return { candidates, totalFramesProcessed: frames.length };
    } finally {
      removeDirectory(tempDir);
    }
  }
}

export class LocalDubbingBackend implements DubbingRenderBackend {
  constructor(
    private readonly tts: LocalTTSProvider,
    private readonly ffmpegPath: string,
    private readonly ffprobePath: string,
    private readonly workspaceRoot: string
  ) {}

  public async render(cues: SubtitleCue[], options: DubbingTrackJobOptions, disclosureNotice: string) {
    const jobId = `dubjob-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const outputDirectory = path.join(this.workspaceRoot, 'data', 'media-accessibility', 'dubbing', safeName(options.projectId), jobId);
    fs.mkdirSync(outputDirectory, { recursive: true });
    const artifacts: string[] = [];
    const inputs: string[] = [];
    const filters: string[] = [];
    let speedAdjustedCuesCount = 0;

    for (let index = 0; index < cues.length; index++) {
      const cue = cues[index];
      const synthesis = await this.tts.synthesize(cue.text, { voiceId: options.voiceId, format: 'wav', speed: 1 });
      let audioPath = path.join(outputDirectory, `cue-${String(index + 1).padStart(4, '0')}.wav`);
      fs.writeFileSync(audioPath, synthesis.audioBuffer);
      const windowSec = Math.max(0.1, cue.endSec - cue.startSec);
      if (synthesis.durationSec > windowSec && options.allowSpeedAdjustment) {
        const factor = Math.min(options.maxSpeedFactor || 1.35, synthesis.durationSec / windowSec);
        if (factor > 1.01) {
          const fittedPath = path.join(outputDirectory, `cue-${String(index + 1).padStart(4, '0')}-fitted.wav`);
          const fit = await runNativeCommand(this.ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-i', audioPath, '-filter:a', `atempo=${factor.toFixed(4)}`, fittedPath]);
          if (fit.exitCode !== 0) throw new Error(`Cue timing fit failed: ${fit.stderr.trim()}`);
          audioPath = fittedPath;
          speedAdjustedCuesCount++;
        }
      }
      inputs.push('-i', audioPath);
      filters.push(`[${index}:a]adelay=${Math.round(cue.startSec * 1000)}:all=1[a${index}]`);
      artifacts.push(audioPath);
    }

    const mixInputs = cues.map((_cue, index) => `[a${index}]`).join('');
    const outputAudioPath = path.join(outputDirectory, 'dubbed-track.wav');
    const mix = await runNativeCommand(this.ffmpegPath, [
      '-y', '-hide_banner', '-loglevel', 'error', ...inputs,
      '-filter_complex', `${filters.join(';')};${mixInputs}amix=inputs=${cues.length}:duration=longest:normalize=0[out]`,
      '-map', '[out]', '-c:a', 'pcm_s16le', outputAudioPath
    ], { timeoutMs: 10 * 60_000 });
    if (mix.exitCode !== 0 || !fs.existsSync(outputAudioPath)) throw new Error(`Dubbing mix failed: ${mix.stderr.trim()}`);
    artifacts.push(outputAudioPath);
    const metadata = await probeAudio(this.ffprobePath, outputAudioPath);
    return {
      jobId,
      targetLanguage: options.targetLanguage,
      outputAudioPath,
      durationSec: metadata.durationSec,
      cueCount: cues.length,
      speedAdjustedCuesCount,
      syntheticDisclosureNotice: disclosureNotice,
      artifactsCreated: artifacts
    };
  }
}

export class LocalDocumentNarrationBackend implements DocumentNarrationBackend {
  constructor(private readonly tts: LocalTTSProvider, private readonly ffprobePath: string, private readonly workspaceRoot: string) {}

  public async synthesize(options: DocumentNarrationJobOptions) {
    const narrationId = `docnarr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const outputDirectory = path.join(this.workspaceRoot, 'data', 'media-accessibility', 'narration', narrationId);
    fs.mkdirSync(outputDirectory, { recursive: true });
    const chapterAudioPaths: Array<{ chapterIndex: number; title: string; audioPath: string; durationSec: number }> = [];
    for (const chapter of options.chapters) {
      const synthesis = await this.tts.synthesize(chapter.cleanedText, {
        voiceId: options.voiceId,
        format: 'wav',
        sampleRate: options.sampleRate
      });
      const audioPath = path.join(outputDirectory, `${String(chapter.chapterIndex).padStart(3, '0')}-${safeName(chapter.title)}.wav`);
      fs.writeFileSync(audioPath, synthesis.audioBuffer);
      const metadata = await probeAudio(this.ffprobePath, audioPath);
      chapterAudioPaths.push({ chapterIndex: chapter.chapterIndex, title: chapter.title, audioPath, durationSec: metadata.durationSec });
    }
    const manifestPackagePath = path.join(outputDirectory, 'narration-manifest.json');
    fs.writeFileSync(manifestPackagePath, JSON.stringify({
      narrationId,
      title: options.documentTitle,
      voiceId: options.voiceId,
      syntheticDisclosureNotice: 'This package contains locally synthesized speech.',
      chapters: chapterAudioPaths
    }, null, 2), 'utf8');
    return {
      narrationId,
      documentTitle: options.documentTitle,
      chaptersSynthesized: chapterAudioPaths.length,
      totalAudioDurationSec: chapterAudioPaths.reduce((total, chapter) => total + chapter.durationSec, 0),
      chapterAudioPaths,
      manifestPackagePath
    };
  }
}
