/**
 * Sprite Background & Transparency Tool (PX10-T04)
 *
 * Implements border/corner color estimation, tolerance-based transparency mapping,
 * isolated noise speck removal, interior hole preservation, and margin trimming.
 */

import { BackgroundRemovalOptions, BackgroundRemovalResult, RawPixelData, RGBAColor } from './SpriteStudioTypes';

export class SpriteBackgroundTool {
  /**
   * Applies background removal and transparency processing.
   */
  public static removeBackground(pixels: RawPixelData, options: BackgroundRemovalOptions): BackgroundRemovalResult {
    const width = pixels.width;
    const height = pixels.height;
    const src = pixels.data;
    const dst = new Uint8Array(src.length);
    dst.set(src);

    // 1. Determine background color
    const bgColor = options.targetColor || this.sampleBorderColor(pixels, options.mode);

    let removedPixels = 0;

    if (options.preserveHoles) {
      // Flood fill from borders only so interior enclosed areas matching the color are preserved
      const visited = new Uint8Array(width * height);
      const queue: Array<[number, number]> = [];

      // Enqueue border pixels
      for (let x = 0; x < width; x++) {
        queue.push([x, 0], [x, height - 1]);
      }
      for (let y = 1; y < height - 1; y++) {
        queue.push([0, y], [width - 1, y]);
      }

      while (queue.length > 0) {
        const [x, y] = queue.pop()!;
        const idx = y * width + x;
        if (x < 0 || x >= width || y < 0 || y >= height || visited[idx]) continue;
        visited[idx] = 1;

        const pixelIdx = idx * 4;
        const r = dst[pixelIdx];
        const g = dst[pixelIdx + 1];
        const b = dst[pixelIdx + 2];
        const a = dst[pixelIdx + 3];

        if (a > 0 && this.matchesColor({ r, g, b, a }, bgColor, options.tolerance)) {
          dst[pixelIdx + 3] = 0; // Make transparent
          removedPixels++;

          queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
      }
    } else {
      // Global threshold removal
      for (let i = 0; i < dst.length; i += 4) {
        const r = dst[i];
        const g = dst[i + 1];
        const b = dst[i + 2];
        const a = dst[i + 3];

        if (a > 0 && this.matchesColor({ r, g, b, a }, bgColor, options.tolerance)) {
          dst[i + 3] = 0;
          removedPixels++;
        }
      }
    }

    // 2. Clean isolated noise specks
    if (options.cleanNoiseSpecks) {
      this.eliminateNoiseSpecks(dst, width, height);
    }

    // 3. Trim transparent margins if requested
    let trimmedBounds: { x: number; y: number; width: number; height: number } | undefined;
    let finalPixels: RawPixelData = {
      width,
      height,
      data: dst,
      colorMode: 'rgba8',
      hasAlpha: true
    };

    if (options.trimTransparentMargins) {
      const bounds = this.findContentBounds(dst, width, height);
      if (bounds && (bounds.width < width || bounds.height < height)) {
        trimmedBounds = bounds;
        finalPixels = this.cropToContentBounds(dst, width, height, bounds);
      }
    }

    return {
      removedPixels,
      detectedBackgroundColor: bgColor,
      trimmedBounds,
      pixels: finalPixels
    };
  }

  /**
   * Samples corners and outer edges to determine the most common background color.
   */
  public static sampleBorderColor(pixels: RawPixelData, mode: 'auto_border' | 'corner' | 'eyedropper' | 'custom_color'): RGBAColor {
    const w = pixels.width;
    const h = pixels.height;
    const data = pixels.data;

    if (mode === 'corner') {
      // Sample top-left corner
      return {
        r: data[0],
        g: data[1],
        b: data[2],
        a: data[3]
      };
    }

    // Average or modal color along border pixels
    const borderSamples: RGBAColor[] = [];
    for (let x = 0; x < w; x++) {
      const top = x * 4;
      const bottom = ((h - 1) * w + x) * 4;
      borderSamples.push({ r: data[top], g: data[top + 1], b: data[top + 2], a: data[top + 3] });
      borderSamples.push({ r: data[bottom], g: data[bottom + 1], b: data[bottom + 2], a: data[bottom + 3] });
    }
    for (let y = 0; y < h; y++) {
      const left = (y * w) * 4;
      const right = (y * w + (w - 1)) * 4;
      borderSamples.push({ r: data[left], g: data[left + 1], b: data[left + 2], a: data[left + 3] });
      borderSamples.push({ r: data[right], g: data[right + 1], b: data[right + 2], a: data[right + 3] });
    }

    // Find modal color or average
    let rSum = 0, gSum = 0, bSum = 0;
    for (const sample of borderSamples) {
      rSum += sample.r;
      gSum += sample.g;
      bSum += sample.b;
    }

    const count = borderSamples.length || 1;
    return {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count),
      a: 255
    };
  }

  private static matchesColor(color: RGBAColor, target: RGBAColor, tolerance: number): boolean {
    const diff = Math.sqrt(
      Math.pow(color.r - target.r, 2) +
      Math.pow(color.g - target.g, 2) +
      Math.pow(color.b - target.b, 2)
    );
    return diff <= tolerance;
  }

  private static eliminateNoiseSpecks(data: Uint8Array, width: number, height: number): void {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] === 0) continue;

        // Check 4-way neighbors
        const topAlpha = data[((y - 1) * width + x) * 4 + 3];
        const bottomAlpha = data[((y + 1) * width + x) * 4 + 3];
        const leftAlpha = data[(y * width + (x - 1)) * 4 + 3];
        const rightAlpha = data[(y * width + (x + 1)) * 4 + 3];

        if (topAlpha === 0 && bottomAlpha === 0 && leftAlpha === 0 && rightAlpha === 0) {
          // Isolated single pixel surrounded by transparency
          data[idx + 3] = 0;
        }
      }
    }
  }

  private static findContentBounds(data: Uint8Array, width: number, height: number): { x: number; y: number; width: number; height: number } | null {
    let minX = width, minY = height, maxX = -1, maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  private static cropToContentBounds(src: Uint8Array, srcW: number, srcH: number, bounds: { x: number; y: number; width: number; height: number }): RawPixelData {
    const dst = new Uint8Array(bounds.width * bounds.height * 4);

    for (let y = 0; y < bounds.height; y++) {
      const srcY = bounds.y + y;
      for (let x = 0; x < bounds.width; x++) {
        const srcX = bounds.x + x;
        const srcIdx = (srcY * srcW + srcX) * 4;
        const dstIdx = (y * bounds.width + x) * 4;

        dst[dstIdx] = src[srcIdx];
        dst[dstIdx + 1] = src[srcIdx + 1];
        dst[dstIdx + 2] = src[srcIdx + 2];
        dst[dstIdx + 3] = src[srcIdx + 3];
      }
    }

    return {
      width: bounds.width,
      height: bounds.height,
      data: dst,
      colorMode: 'rgba8',
      hasAlpha: true
    };
  }
}
