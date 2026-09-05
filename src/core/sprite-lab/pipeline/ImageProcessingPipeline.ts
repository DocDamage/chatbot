/**
 * Versioned Image Processing Pipeline (PX10-T01)
 *
 * Orchestrates the complete 12-stage sprite cleanup, quantization, outline,
 * and engine preparation pipeline.
 */

import { ImageIngestValidator } from './ImageIngestValidator';
import { PixelGridRefiner } from './PixelGridRefiner';
import { SpriteBackgroundTool } from './SpriteBackgroundTool';
import { SpritePaletteEngine } from './SpritePaletteEngine';
import { SpriteOutlineFinisher } from './SpriteOutlineFinisher';
import { PipelinePreset, RawPixelData, QuantizationResult, OutlineResult, BackgroundRemovalResult, GridDetectionResult } from './SpriteStudioTypes';

export interface PipelineExecutionResult {
  success: boolean;
  presetApplied: PipelinePreset;
  stages: {
    ingestValid: boolean;
    gridDetection?: GridDetectionResult;
    backgroundRemoval?: BackgroundRemovalResult;
    quantization?: QuantizationResult;
    finishing?: OutlineResult;
  };
  outputPixels: RawPixelData;
  manifest: {
    pipelineVersion: string;
    executedAt: string;
    originalDimensions: { width: number; height: number };
    finalDimensions: { width: number; height: number };
    colorCount: number;
    hasAlpha: boolean;
  };
  error?: string;
}

export class ImageProcessingPipeline {
  public static readonly PIPELINE_VERSION = '1.0.0-px10';

  /**
   * Executes the full pipeline given a raw image buffer or pixel data and a preset.
   */
  public static processImage(
    input: { buffer?: Buffer; pixels?: RawPixelData; fileName?: string },
    preset: PipelinePreset
  ): PipelineExecutionResult {
    const executedAt = new Date().toISOString();

    // 1. Stage 1 & 2: Ingest validation & Classification
    let currentPixels: RawPixelData;

    if (input.buffer) {
      const validation = ImageIngestValidator.validateBuffer(input.buffer, input.fileName || 'input.png');
      if (!validation.valid) {
        return {
          success: false,
          presetApplied: preset,
          stages: { ingestValid: false },
          outputPixels: { width: 0, height: 0, data: new Uint8Array(0), colorMode: 'rgba8', hasAlpha: false },
          manifest: {
            pipelineVersion: this.PIPELINE_VERSION,
            executedAt,
            originalDimensions: { width: 0, height: 0 },
            finalDimensions: { width: 0, height: 0 },
            colorCount: 0,
            hasAlpha: false
          },
          error: validation.error || 'Ingest validation failed'
        };
      }

      throw new Error(
        `DECODED_PIXEL_INPUT_REQUIRED: ${validation.format} metadata is valid, but encoded image bytes must be decoded by a verified image backend before processing.`
      );
    } else if (input.pixels) {
      currentPixels = input.pixels;
    } else {
      throw new Error('Either buffer or pixels must be provided to pipeline.');
    }

    const origDimensions = { width: currentPixels.width, height: currentPixels.height };

    // 2. Stage 3 & 4: Grid detection & Resampling
    let gridResult: GridDetectionResult | undefined;
    if (preset.gridMode && preset.gridMode !== 'none') {
      gridResult = PixelGridRefiner.detectGrid(currentPixels, {
        mode: preset.gridMode === 'auto' ? 'auto' : 'forced',
        hintSize: preset.gridSizeHint
      });

      if (gridResult.detected && gridResult.appliedGridSize && gridResult.appliedGridSize < currentPixels.width) {
        // Nearest neighbor logical downsample to grid cells if desired
        const targetW = Math.floor(currentPixels.width / (currentPixels.width / gridResult.appliedGridSize));
        const targetH = Math.floor(currentPixels.height / (currentPixels.height / gridResult.appliedGridSize));
        currentPixels = PixelGridRefiner.resampleNearestNeighbor(currentPixels, targetW, targetH);
      }
    }

    // 3. Stage 5: Anti-alias cleanup
    currentPixels = PixelGridRefiner.cleanAntiAliasing(currentPixels, 128);

    // 4. Stage 6: Background handling
    let bgResult: BackgroundRemovalResult | undefined;
    if (preset.backgroundRemoval) {
      bgResult = SpriteBackgroundTool.removeBackground(currentPixels, preset.backgroundRemoval);
      currentPixels = bgResult.pixels;
    }

    // 5. Stage 7 & 8: Color reduction, palette mapping & dithering
    let quantResult: QuantizationResult | undefined;
    if (preset.quantization) {
      quantResult = SpritePaletteEngine.quantize(currentPixels, preset.quantization);
      currentPixels = quantResult.pixels;
    }

    // 6. Stage 9, 10, 11: Outline, framing & scaling
    let finishResult: OutlineResult | undefined;
    if (preset.outline) {
      finishResult = SpriteOutlineFinisher.applyFinishing(currentPixels, preset.outline);
      currentPixels = finishResult.pixels;
    }

    // Count final unique colors
    const uniqueColors = new Set<string>();
    for (let i = 0; i < currentPixels.data.length; i += 4) {
      if (currentPixels.data[i + 3] > 0) {
        uniqueColors.add(SpritePaletteEngine.rgbToHex({
          r: currentPixels.data[i],
          g: currentPixels.data[i + 1],
          b: currentPixels.data[i + 2],
          a: currentPixels.data[i + 3]
        }));
      }
    }

    // 7. Stage 12: Manifest generation
    const manifest = {
      pipelineVersion: this.PIPELINE_VERSION,
      executedAt,
      originalDimensions: origDimensions,
      finalDimensions: { width: currentPixels.width, height: currentPixels.height },
      colorCount: uniqueColors.size,
      hasAlpha: currentPixels.hasAlpha
    };

    return {
      success: true,
      presetApplied: preset,
      stages: {
        ingestValid: true,
        gridDetection: gridResult,
        backgroundRemoval: bgResult,
        quantization: quantResult,
        finishing: finishResult
      },
      outputPixels: currentPixels,
      manifest
    };
  }

}
