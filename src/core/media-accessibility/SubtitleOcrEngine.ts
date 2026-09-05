/**
 * Subtitle OCR Engine (PX13-T02)
 *
 * Implements burned-in subtitle OCR pipeline: video metadata inspection,
 * bounding-box region cropping, candidate frame extraction, OCR text detection,
 * cue timing deduplication, and confidence scoring without unbounded disk bloat.
 */

import crypto from 'node:crypto';
import {
  SubtitleCropRegion,
  SubtitleOcrJobOptions,
  SubtitleOcrResult,
  SubtitleCue
} from './MediaAccessibilityTypes';

export class SubtitleOcrEngine {
  constructor(private readonly backend?: SubtitleOcrBackend) {}

  public isAvailable(): boolean {
    return Boolean(this.backend);
  }

  /**
   * Runs local burned-in subtitle OCR on a video source with crop constraints.
   */
  public async runOcrJob(options: SubtitleOcrJobOptions): Promise<SubtitleOcrResult> {
    const startTime = Date.now();
    const jobId = `ocrjob-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    if (!options.videoPath) {
      throw new Error('Video path is required for Subtitle OCR.');
    }

    this.validateCropRegion(options.cropRegion);

    const maxFrames = options.maxFramesToProcess || 100;
    const confidenceThreshold = options.confidenceThreshold ?? 0.7;
    if (!this.backend) {
      throw new Error('SUBTITLE_OCR_BACKEND_UNAVAILABLE: configure a verified video-frame and OCR backend.');
    }
    const backendResult = await this.backend.extractCandidates(options);
    const candidateCues = backendResult.candidates.slice(0, maxFrames);

    // Deduplicate consecutive identical frames into single time-ranged subtitle cues
    const extractedCues: SubtitleCue[] = [];
    let curCue: { text: string; start: number; end: number; conf: number; count: number } | null = null;
    let cueIndex = 1;

    for (const raw of candidateCues) {
      if (raw.confidence < confidenceThreshold) continue;

      if (!curCue) {
        curCue = { text: raw.text, start: raw.timeSec, end: raw.timeSec + 1.0, conf: raw.confidence, count: 1 };
      } else if (curCue.text === raw.text) {
        curCue.end = raw.timeSec + 1.0;
        curCue.conf += raw.confidence;
        curCue.count += 1;
      } else {
        extractedCues.push({
          id: `cue-${cueIndex}`,
          index: cueIndex,
          startSec: Number(curCue.start.toFixed(2)),
          endSec: Number(curCue.end.toFixed(2)),
          text: curCue.text,
          confidence: Number((curCue.conf / curCue.count).toFixed(2))
        });
        cueIndex++;
        curCue = { text: raw.text, start: raw.timeSec, end: raw.timeSec + 1.0, conf: raw.confidence, count: 1 };
      }
    }

    if (curCue) {
      extractedCues.push({
        id: `cue-${cueIndex}`,
        index: cueIndex,
        startSec: Number(curCue.start.toFixed(2)),
        endSec: Number(curCue.end.toFixed(2)),
        text: curCue.text,
        confidence: Number((curCue.conf / curCue.count).toFixed(2))
      });
    }

    const totalConf = extractedCues.reduce((acc, c) => acc + (c.confidence || 0), 0);
    const avgConfidence = extractedCues.length > 0 ? Number((totalConf / extractedCues.length).toFixed(2)) : 0;

    return {
      jobId,
      extractedCues,
      totalFramesProcessed: Math.min(maxFrames, backendResult.totalFramesProcessed),
      averageConfidence: avgConfidence,
      deduplicatedCount: candidateCues.length - extractedCues.length,
      processingDurationMs: Date.now() - startTime
    };
  }

  private validateCropRegion(region: SubtitleCropRegion): void {
    if (!region || region.width <= 0 || region.height <= 0) {
      throw new Error('Invalid subtitle crop region: width and height must be positive numbers.');
    }
    if (region.x < 0 || region.y < 0) {
      throw new Error('Invalid subtitle crop region: coordinates cannot be negative.');
    }
  }
}

export interface SubtitleOcrBackend {
  extractCandidates(options: SubtitleOcrJobOptions): Promise<{
    candidates: Array<{ timeSec: number; text: string; confidence: number }>;
    totalFramesProcessed: number;
  }>;
}
