/**
 * Pixel Grid Refiner (PX10-T03)
 *
 * Implements auto grid estimation, confidence scoring, nearest-neighbor logical pixel
 * resampling, anti-alias artifact cleanup, and safe fallback.
 */

import { GridCandidate, GridDetectionResult, RawPixelData, RGBAColor } from './SpriteStudioTypes';

export class PixelGridRefiner {
  private static readonly COMMON_GRID_SIZES = [8, 16, 24, 32, 48, 64];

  /**
   * Detects candidate grid sizes and returns confidence rankings.
   */
  public static detectGrid(pixels: RawPixelData, options?: { mode?: 'auto' | 'hint' | 'forced'; hintSize?: number }): GridDetectionResult {
    const mode = options?.mode || 'auto';
    const hintSize = options?.hintSize;

    if (mode === 'forced' && hintSize && hintSize > 0) {
      const cellCountX = Math.floor(pixels.width / hintSize);
      const cellCountY = Math.floor(pixels.height / hintSize);
      return {
        detected: true,
        recommendedGridSize: hintSize,
        mode: 'forced',
        appliedGridSize: hintSize,
        candidates: [{
          gridSize: hintSize,
          confidence: 1.0,
          cellCountX,
          cellCountY,
          reason: 'User forced explicit grid dimension.'
        }]
      };
    }

    const candidates: GridCandidate[] = [];

    for (const size of this.COMMON_GRID_SIZES) {
      if (pixels.width < size || pixels.height < size) continue;

      let matchScore = 0;
      const isDivisibleX = pixels.width % size === 0;
      const isDivisibleY = pixels.height % size === 0;

      if (isDivisibleX && isDivisibleY) {
        matchScore += 0.4;
      } else if (isDivisibleX || isDivisibleY) {
        matchScore += 0.2;
      }

      // Autocorrelation / transition frequency along grid intervals
      const transitionScore = this.evaluateTransitionFrequency(pixels, size);
      matchScore += transitionScore * 0.6;

      // Boost if matching hint
      if (hintSize && hintSize === size) {
        matchScore = Math.min(1.0, matchScore + 0.3);
      }

      const confidence = Math.round(Math.min(1.0, Math.max(0.0, matchScore)) * 100) / 100;
      const cellCountX = Math.floor(pixels.width / size);
      const cellCountY = Math.floor(pixels.height / size);

      candidates.push({
        gridSize: size,
        confidence,
        cellCountX,
        cellCountY,
        reason: isDivisibleX && isDivisibleY
          ? `Even division (${cellCountX}x${cellCountY}) with ${Math.round(transitionScore * 100)}% border consistency`
          : `Partial division with ${Math.round(transitionScore * 100)}% border consistency`
      });
    }

    candidates.sort((a, b) => b.confidence - a.confidence);

    const bestCandidate = candidates[0];
    const detected = !!bestCandidate && bestCandidate.confidence >= 0.35;
    const recommendedGridSize = detected ? bestCandidate.gridSize : (hintSize || 16);

    return {
      detected,
      recommendedGridSize,
      mode: detected ? mode : 'no_grid_preserved',
      appliedGridSize: detected ? recommendedGridSize : undefined,
      candidates
    };
  }

  /**
   * Resamples raw pixel data to logical pixels using nearest-neighbor.
   */
  public static resampleNearestNeighbor(pixels: RawPixelData, targetWidth: number, targetHeight: number): RawPixelData {
    const srcW = pixels.width;
    const srcH = pixels.height;
    const dstData = new Uint8Array(targetWidth * targetHeight * 4);

    const scaleX = srcW / targetWidth;
    const scaleY = srcH / targetHeight;

    for (let y = 0; y < targetHeight; y++) {
      const srcY = Math.min(srcH - 1, Math.floor(y * scaleY));
      for (let x = 0; x < targetWidth; x++) {
        const srcX = Math.min(srcW - 1, Math.floor(x * scaleX));

        const srcIdx = (srcY * srcW + srcX) * 4;
        const dstIdx = (y * targetWidth + x) * 4;

        dstData[dstIdx] = pixels.data[srcIdx];
        dstData[dstIdx + 1] = pixels.data[srcIdx + 1];
        dstData[dstIdx + 2] = pixels.data[srcIdx + 2];
        dstData[dstIdx + 3] = pixels.data[srcIdx + 3];
      }
    }

    return {
      width: targetWidth,
      height: targetHeight,
      data: dstData,
      colorMode: pixels.colorMode,
      hasAlpha: pixels.hasAlpha
    };
  }

  /**
   * Cleans anti-aliasing color bleed and semi-transparent halos.
   */
  public static cleanAntiAliasing(pixels: RawPixelData, alphaThreshold = 128, colorSnapRadius = 2): RawPixelData {
    const width = pixels.width;
    const height = pixels.height;
    const outputData = new Uint8Array(pixels.data.length);

    for (let i = 0; i < pixels.data.length; i += 4) {
      const a = pixels.data[i + 3];
      if (a < alphaThreshold) {
        // Clear semi-transparent anti-alias fringe to fully transparent
        outputData[i] = 0;
        outputData[i + 1] = 0;
        outputData[i + 2] = 0;
        outputData[i + 3] = 0;
      } else {
        // Snap to full opacity
        outputData[i] = pixels.data[i];
        outputData[i + 1] = pixels.data[i + 1];
        outputData[i + 2] = pixels.data[i + 2];
        outputData[i + 3] = 255;
      }
    }

    return {
      width,
      height,
      data: outputData,
      colorMode: pixels.colorMode,
      hasAlpha: true
    };
  }

  private static evaluateTransitionFrequency(pixels: RawPixelData, gridSize: number): number {
    const w = pixels.width;
    const h = pixels.height;
    if (gridSize <= 0 || w <= gridSize || h <= gridSize) return 0.1;

    let transitionsAlongGrid = 0;
    let totalSamples = 0;

    for (let x = gridSize; x < w; x += gridSize) {
      for (let y = 0; y < h; y += Math.max(1, Math.floor(gridSize / 2))) {
        const idx1 = (y * w + (x - 1)) * 4;
        const idx2 = (y * w + x) * 4;
        const diff = Math.abs(pixels.data[idx1] - pixels.data[idx2]) +
                     Math.abs(pixels.data[idx1 + 1] - pixels.data[idx2 + 1]) +
                     Math.abs(pixels.data[idx1 + 2] - pixels.data[idx2 + 2]);
        if (diff > 30) transitionsAlongGrid++;
        totalSamples++;
      }
    }

    return totalSamples > 0 ? Math.min(1.0, transitionsAlongGrid / totalSamples) : 0.2;
  }
}
