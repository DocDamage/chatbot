/**
 * Video Processor - Video processing utilities using fluent-ffmpeg
 * Research: MIT Vision Group
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../observability/logger';

// Dynamic import for fluent-ffmpeg to handle optional dependency
let ffmpeg: any = null;
let ffmpegInstalled = false;

async function loadFfmpeg(): Promise<boolean> {
  if (ffmpeg !== null) return ffmpegInstalled;

  try {
    ffmpeg = require('fluent-ffmpeg');
    ffmpegInstalled = true;
    logger.info('fluent-ffmpeg loaded successfully');
    return true;
  } catch (error) {
    logger.warn('fluent-ffmpeg not available - video processing will be limited');
    ffmpegInstalled = false;
    return false;
  }
}

export interface VideoMetadata {
  duration: number; // seconds
  width: number;
  height: number;
  format: string;
  size: number; // bytes
  frameRate: number;
  hasAudio: boolean;
  codec?: string;
  bitrate?: number;
}

export interface VideoFrame {
  timestamp: number;
  base64: string;
}

export class VideoProcessor {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'chatbot-video-processor');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Save base64 video to temp file
   */
  private async saveToTempFile(videoBase64: string): Promise<string> {
    const id = uuidv4();
    const tempPath = path.join(this.tempDir, `video-${id}.mp4`);

    // Handle data URL format
    let base64Data = videoBase64;
    if (videoBase64.startsWith('data:')) {
      base64Data = videoBase64.split(',')[1];
    }

    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(tempPath, buffer);

    return tempPath;
  }

  /**
   * Clean up temp file
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      logger.warn('Failed to cleanup temp file', { filePath });
    }
  }

  /**
   * Extract frames from video at specified intervals
   */
  async extractFrames(
    videoBase64: string,
    frameInterval: number = 1 // seconds
  ): Promise<string[]> {
    const isLoaded = await loadFfmpeg();

    if (!isLoaded) {
      logger.warn('Video frame extraction requires ffmpeg - returning empty array');
      return [];
    }

    const tempVideoPath = await this.saveToTempFile(videoBase64);
    const framesDir = path.join(this.tempDir, `frames-${uuidv4()}`);

    try {
      fs.mkdirSync(framesDir, { recursive: true });

      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .outputOptions([
            `-vf fps=1/${frameInterval}`,
            '-q:v 2' // High quality JPEG
          ])
          .output(path.join(framesDir, 'frame-%04d.jpg'))
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      // Read extracted frames and convert to base64
      const frameFiles = fs.readdirSync(framesDir)
        .filter(f => f.endsWith('.jpg'))
        .sort();

      const frames: string[] = [];
      for (const file of frameFiles) {
        const framePath = path.join(framesDir, file);
        const frameBuffer = await fs.promises.readFile(framePath);
        frames.push(`data:image/jpeg;base64,${frameBuffer.toString('base64')}`);
      }

      logger.info('Extracted video frames', { count: frames.length, interval: frameInterval });
      return frames;
    } catch (error: any) {
      logger.error('Frame extraction failed', { error: error.message });
      return [];
    } finally {
      await this.cleanupTempFile(tempVideoPath);
      // Cleanup frames directory
      try {
        if (fs.existsSync(framesDir)) {
          const files = fs.readdirSync(framesDir);
          for (const file of files) {
            await fs.promises.unlink(path.join(framesDir, file));
          }
          await fs.promises.rmdir(framesDir);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Extract key frames (scene changes) using scene detection
   */
  async extractKeyFrames(
    videoBase64: string,
    threshold: number = 0.3
  ): Promise<string[]> {
    const isLoaded = await loadFfmpeg();

    if (!isLoaded) {
      logger.warn('Key frame extraction requires ffmpeg - returning empty array');
      return [];
    }

    const tempVideoPath = await this.saveToTempFile(videoBase64);
    const framesDir = path.join(this.tempDir, `keyframes-${uuidv4()}`);

    try {
      fs.mkdirSync(framesDir, { recursive: true });

      // Use scene detection filter to extract key frames
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .outputOptions([
            `-vf select='gt(scene,${threshold})',showinfo`,
            '-vsync vfr',
            '-q:v 2'
          ])
          .output(path.join(framesDir, 'keyframe-%04d.jpg'))
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      // Read extracted key frames
      const frameFiles = fs.readdirSync(framesDir)
        .filter(f => f.endsWith('.jpg'))
        .sort();

      const frames: string[] = [];
      for (const file of frameFiles) {
        const framePath = path.join(framesDir, file);
        const frameBuffer = await fs.promises.readFile(framePath);
        frames.push(`data:image/jpeg;base64,${frameBuffer.toString('base64')}`);
      }

      // If no scene changes detected, fall back to extracting first frame
      if (frames.length === 0) {
        const regularFrames = await this.extractFrames(videoBase64, 5);
        if (regularFrames.length > 0) {
          return [regularFrames[0]];
        }
      }

      logger.info('Extracted key frames', { count: frames.length, threshold });
      return frames;
    } catch (error: any) {
      logger.error('Key frame extraction failed', { error: error.message });
      // Fallback to regular frame extraction
      return this.extractFrames(videoBase64, 5);
    } finally {
      await this.cleanupTempFile(tempVideoPath);
      try {
        if (fs.existsSync(framesDir)) {
          const files = fs.readdirSync(framesDir);
          for (const file of files) {
            await fs.promises.unlink(path.join(framesDir, file));
          }
          await fs.promises.rmdir(framesDir);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Get video metadata using ffprobe
   */
  async getMetadata(videoBase64: string): Promise<VideoMetadata> {
    const isLoaded = await loadFfmpeg();

    if (!isLoaded) {
      // Return sensible defaults when ffmpeg is not available
      logger.warn('Video metadata extraction requires ffmpeg - returning defaults');

      // Calculate approximate size from base64
      let base64Data = videoBase64;
      if (videoBase64.startsWith('data:')) {
        base64Data = videoBase64.split(',')[1];
      }
      const size = Math.floor((base64Data.length * 3) / 4);

      return {
        duration: 0,
        width: 0,
        height: 0,
        format: 'unknown',
        size,
        frameRate: 0,
        hasAudio: false
      };
    }

    const tempVideoPath = await this.saveToTempFile(videoBase64);

    try {
      const metadata = await new Promise<VideoMetadata>((resolve, reject) => {
        ffmpeg.ffprobe(tempVideoPath, (err: Error, data: any) => {
          if (err) {
            reject(err);
            return;
          }

          const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
          const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');

          // Parse frame rate (e.g., "30/1" or "29.97")
          let frameRate = 0;
          if (videoStream?.r_frame_rate) {
            const parts = videoStream.r_frame_rate.split('/');
            frameRate = parts.length === 2
              ? parseInt(parts[0]) / parseInt(parts[1])
              : parseFloat(videoStream.r_frame_rate);
          }

          resolve({
            duration: parseFloat(data.format.duration) || 0,
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
            format: data.format.format_name || 'unknown',
            size: parseInt(data.format.size) || 0,
            frameRate: Math.round(frameRate * 100) / 100,
            hasAudio: !!audioStream,
            codec: videoStream?.codec_name,
            bitrate: parseInt(data.format.bit_rate) || undefined
          });
        });
      });

      logger.info('Extracted video metadata', {
        duration: metadata.duration,
        resolution: `${metadata.width}x${metadata.height}`,
        format: metadata.format
      });

      return metadata;
    } catch (error: any) {
      logger.error('Metadata extraction failed', { error: error.message });
      throw new Error(`Failed to extract video metadata: ${error.message}`);
    } finally {
      await this.cleanupTempFile(tempVideoPath);
    }
  }

  /**
   * Process video for vision model (extract frames and analyze)
   */
  async processForVision(
    videoBase64: string,
    maxFrames: number = 10
  ): Promise<{
    frames: string[];
    metadata: VideoMetadata;
  }> {
    // Get metadata first (this won't throw even without ffmpeg)
    const metadata = await this.getMetadata(videoBase64);

    // Try key frames first, fall back to regular frame extraction
    let frames = await this.extractKeyFrames(videoBase64);

    if (frames.length === 0) {
      // Calculate interval to get roughly maxFrames
      const interval = metadata.duration > 0
        ? Math.max(1, Math.floor(metadata.duration / maxFrames))
        : 2;
      frames = await this.extractFrames(videoBase64, interval);
    }

    return {
      frames: frames.slice(0, maxFrames),
      metadata
    };
  }

  /**
   * Extract audio from video as base64
   */
  async extractAudio(videoBase64: string): Promise<string | null> {
    const isLoaded = await loadFfmpeg();

    if (!isLoaded) {
      logger.warn('Audio extraction requires ffmpeg');
      return null;
    }

    const tempVideoPath = await this.saveToTempFile(videoBase64);
    const audioPath = path.join(this.tempDir, `audio-${uuidv4()}.mp3`);

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .noVideo()
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .output(audioPath)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      const audioBuffer = await fs.promises.readFile(audioPath);
      return `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;
    } catch (error: any) {
      logger.error('Audio extraction failed', { error: error.message });
      return null;
    } finally {
      await this.cleanupTempFile(tempVideoPath);
      await this.cleanupTempFile(audioPath);
    }
  }

  /**
   * Create thumbnail from video
   */
  async createThumbnail(
    videoBase64: string,
    timestamp: number = 0
  ): Promise<string | null> {
    const isLoaded = await loadFfmpeg();

    if (!isLoaded) {
      // Try to get first frame as thumbnail
      const frames = await this.extractFrames(videoBase64, 9999);
      return frames.length > 0 ? frames[0] : null;
    }

    const tempVideoPath = await this.saveToTempFile(videoBase64);
    const thumbPath = path.join(this.tempDir, `thumb-${uuidv4()}.jpg`);

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .screenshots({
            timestamps: [timestamp],
            filename: path.basename(thumbPath),
            folder: path.dirname(thumbPath),
            size: '320x?'
          })
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err));
      });

      if (fs.existsSync(thumbPath)) {
        const thumbBuffer = await fs.promises.readFile(thumbPath);
        return `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
      }
      return null;
    } catch (error: any) {
      logger.error('Thumbnail creation failed', { error: error.message });
      return null;
    } finally {
      await this.cleanupTempFile(tempVideoPath);
      await this.cleanupTempFile(thumbPath);
    }
  }
}

let videoProcessor: VideoProcessor | null = null;

export function getVideoProcessor(): VideoProcessor {
  if (!videoProcessor) {
    videoProcessor = new VideoProcessor();
  }
  return videoProcessor;
}
