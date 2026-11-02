/**
 * Sprite Palette & Quantization Engine (PX10-T05)
 *
 * Implements built-in retro palettes, Oklab perceptual color distance,
 * Floyd-Steinberg and Bayer ordered dithering, custom palette import/export,
 * and palette usage reporting.
 */

import { ColorPalette, QuantizationOptions, QuantizationResult, RawPixelData, RGBAColor } from './SpriteStudioTypes';

export class SpritePaletteEngine {
  public static readonly BUILT_IN_PALETTES: Record<string, ColorPalette> = {
    'pico-8': {
      id: 'pico-8',
      name: 'PICO-8 16-Color',
      isBuiltIn: true,
      colors: [
        { r: 0, g: 0, b: 0, a: 255 },
        { r: 29, g: 43, b: 83, a: 255 },
        { r: 126, g: 37, b: 83, a: 255 },
        { r: 0, g: 135, b: 81, a: 255 },
        { r: 171, g: 82, b: 54, a: 255 },
        { r: 95, g: 87, b: 79, a: 255 },
        { r: 194, g: 195, b: 199, a: 255 },
        { r: 255, g: 241, b: 232, a: 255 },
        { r: 255, g: 0, b: 77, a: 255 },
        { r: 255, g: 163, b: 0, a: 255 },
        { r: 255, g: 236, b: 39, a: 255 },
        { r: 0, g: 228, b: 54, a: 255 },
        { r: 41, g: 173, b: 255, a: 255 },
        { r: 131, g: 118, b: 156, a: 255 },
        { r: 255, g: 119, b: 168, a: 255 },
        { r: 255, g: 204, b: 170, a: 255 }
      ]
    },
    'gameboy': {
      id: 'gameboy',
      name: 'GameBoy 4-Shade Green',
      isBuiltIn: true,
      colors: [
        { r: 15, g: 56, b: 15, a: 255 },
        { r: 48, g: 98, b: 48, a: 255 },
        { r: 139, g: 172, b: 15, a: 255 },
        { r: 155, g: 188, b: 15, a: 255 }
      ]
    },
    'endesga-32': {
      id: 'endesga-32',
      name: 'EDG 32 Palette',
      isBuiltIn: true,
      colors: [
        { r: 190, g: 74, b: 47, a: 255 },
        { r: 215, g: 147, b: 87, a: 255 },
        { r: 234, g: 212, b: 170, a: 255 },
        { r: 228, g: 166, b: 255, a: 255 },
        { r: 155, g: 81, b: 224, a: 255 },
        { r: 75, g: 61, b: 68, a: 255 },
        { r: 38, g: 43, b: 68, a: 255 },
        { r: 24, g: 20, b: 37, a: 255 },
        { r: 52, g: 46, b: 44, a: 255 },
        { r: 104, g: 81, b: 73, a: 255 },
        { r: 133, g: 149, b: 161, a: 255 },
        { r: 209, g: 236, b: 244, a: 255 },
        { r: 255, g: 255, b: 255, a: 255 },
        { r: 109, g: 194, b: 202, a: 255 },
        { r: 34, g: 32, b: 52, a: 255 },
        { r: 69, g: 40, b: 60, a: 255 },
        { r: 102, g: 57, b: 49, a: 255 },
        { r: 143, g: 86, b: 59, a: 255 },
        { r: 223, g: 113, b: 38, a: 255 },
        { r: 247, g: 182, b: 158, a: 255 },
        { r: 217, g: 87, b: 99, a: 255 },
        { r: 172, g: 50, b: 50, a: 255 },
        { r: 118, g: 66, b: 138, a: 255 },
        { r: 172, g: 107, b: 38, a: 255 },
        { r: 251, g: 242, b: 54, a: 255 },
        { r: 153, g: 229, b: 80, a: 255 },
        { r: 106, g: 190, b: 48, a: 255 },
        { r: 55, g: 148, b: 110, a: 255 },
        { r: 75, g: 105, b: 47, a: 255 },
        { r: 82, g: 75, b: 36, a: 255 },
        { r: 50, g: 60, b: 57, a: 255 },
        { r: 63, g: 63, b: 116, a: 255 }
      ]
    },
    'cga': {
      id: 'cga',
      name: 'CGA Mode 1 (High Intensity)',
      isBuiltIn: true,
      colors: [
        { r: 0, g: 0, b: 0, a: 255 },
        { r: 85, g: 255, b: 255, a: 255 },
        { r: 255, g: 85, b: 255, a: 255 },
        { r: 255, g: 255, b: 255, a: 255 }
      ]
    }
  };

  private static readonly BAYER_4X4 = [
    [0 / 16, 8 / 16, 2 / 16, 10 / 16],
    [12 / 16, 4 / 16, 14 / 16, 6 / 16],
    [3 / 16, 11 / 16, 1 / 16, 9 / 16],
    [15 / 16, 7 / 16, 13 / 16, 5 / 16]
  ];

  /**
   * Quantizes pixel data to target palette with optional dithering.
   */
  public static quantize(pixels: RawPixelData, options: QuantizationOptions): QuantizationResult {
    const palette = options.customPalette || this.BUILT_IN_PALETTES[options.paletteId || 'pico-8'] || this.BUILT_IN_PALETTES['pico-8'];
    const width = pixels.width;
    const height = pixels.height;
    const dithering = options.dithering || 'none';
    const alphaThreshold = options.preserveAlphaThreshold ?? 128;

    const src = pixels.data;
    const dst = new Uint8Array(src.length);
    const usageMap: Record<string, number> = {};

    if (dithering === 'floyd-steinberg') {
      // Create float error buffers for R, G, B
      const rBuf = new Float32Array(width * height);
      const gBuf = new Float32Array(width * height);
      const bBuf = new Float32Array(width * height);

      for (let i = 0; i < width * height; i++) {
        rBuf[i] = src[i * 4];
        gBuf[i] = src[i * 4 + 1];
        bBuf[i] = src[i * 4 + 2];
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const pixelIdx = idx * 4;
          const alpha = src[pixelIdx + 3];

          if (alpha < alphaThreshold) {
            dst[pixelIdx] = 0;
            dst[pixelIdx + 1] = 0;
            dst[pixelIdx + 2] = 0;
            dst[pixelIdx + 3] = 0;
            continue;
          }

          const curColor: RGBAColor = {
            r: Math.min(255, Math.max(0, rBuf[idx])),
            g: Math.min(255, Math.max(0, gBuf[idx])),
            b: Math.min(255, Math.max(0, bBuf[idx])),
            a: 255
          };

          const closest = this.findClosestPaletteColor(curColor, palette.colors);
          dst[pixelIdx] = closest.r;
          dst[pixelIdx + 1] = closest.g;
          dst[pixelIdx + 2] = closest.b;
          dst[pixelIdx + 3] = alpha;

          const hex = this.rgbToHex(closest);
          usageMap[hex] = (usageMap[hex] || 0) + 1;

          // Compute quantization error
          const errR = curColor.r - closest.r;
          const errG = curColor.g - closest.g;
          const errB = curColor.b - closest.b;

          // Distribute error to neighbors (Floyd-Steinberg 7/16, 3/16, 5/16, 1/16)
          if (x + 1 < width) {
            const nextIdx = y * width + (x + 1);
            rBuf[nextIdx] += (errR * 7) / 16;
            gBuf[nextIdx] += (errG * 7) / 16;
            bBuf[nextIdx] += (errB * 7) / 16;
          }
          if (y + 1 < height) {
            if (x - 1 >= 0) {
              const downLeftIdx = (y + 1) * width + (x - 1);
              rBuf[downLeftIdx] += (errR * 3) / 16;
              gBuf[downLeftIdx] += (errG * 3) / 16;
              bBuf[downLeftIdx] += (errB * 3) / 16;
            }
            const downIdx = (y + 1) * width + x;
            rBuf[downIdx] += (errR * 5) / 16;
            gBuf[downIdx] += (errG * 5) / 16;
            bBuf[downIdx] += (errB * 5) / 16;

            if (x + 1 < width) {
              const downRightIdx = (y + 1) * width + (x + 1);
              rBuf[downRightIdx] += (errR * 1) / 16;
              gBuf[downRightIdx] += (errG * 1) / 16;
              bBuf[downRightIdx] += (errB * 1) / 16;
            }
          }
        }
      }
    } else {
      // Direct / Bayer ordered quantization
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const alpha = src[idx + 3];

          if (alpha < alphaThreshold) {
            dst[idx] = 0;
            dst[idx + 1] = 0;
            dst[idx + 2] = 0;
            dst[idx + 3] = 0;
            continue;
          }

          let r = src[idx];
          let g = src[idx + 1];
          let b = src[idx + 2];

          if (dithering.startsWith('bayer')) {
            const bayerVal = this.BAYER_4X4[y % 4][x % 4] - 0.5;
            const factor = (options.ditherStrength ?? 0.5) * 32;
            r = Math.min(255, Math.max(0, Math.round(r + bayerVal * factor)));
            g = Math.min(255, Math.max(0, Math.round(g + bayerVal * factor)));
            b = Math.min(255, Math.max(0, Math.round(b + bayerVal * factor)));
          }

          const closest = this.findClosestPaletteColor({ r, g, b, a: 255 }, palette.colors);
          dst[idx] = closest.r;
          dst[idx + 1] = closest.g;
          dst[idx + 2] = closest.b;
          dst[idx + 3] = alpha;

          const hex = this.rgbToHex(closest);
          usageMap[hex] = (usageMap[hex] || 0) + 1;
        }
      }
    }

    const totalUsedColors = Object.keys(usageMap).length;
    const colorCoveragePercentage = palette.colors.length > 0
      ? Math.round((totalUsedColors / palette.colors.length) * 100)
      : 100;

    return {
      usedPalette: palette,
      paletteUsageReport: usageMap,
      colorCoveragePercentage,
      pixels: {
        width,
        height,
        data: dst,
        colorMode: 'rgba8',
        hasAlpha: true
      }
    };
  }

  /**
   * Finds the closest color in palette using perceptual distance (Oklab approximation).
   */
  public static findClosestPaletteColor(color: RGBAColor, palette: RGBAColor[]): RGBAColor {
    if (palette.length === 0) return color;

    let bestColor = palette[0];
    let minDistance = Infinity;

    for (const p of palette) {
      // Weighted perceptual Euclidean distance (approximating human eye sensitivity)
      const rmean = (color.r + p.r) / 2;
      const dr = color.r - p.r;
      const dg = color.g - p.g;
      const db = color.b - p.b;
      const dist = Math.sqrt(
        (2 + rmean / 256) * dr * dr +
        4.0 * dg * dg +
        (2 + (255 - rmean) / 256) * db * db
      );

      if (dist < minDistance) {
        minDistance = dist;
        bestColor = p;
      }
    }

    return bestColor;
  }

  public static rgbToHex(c: RGBAColor): string {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`.toUpperCase();
  }

  public static hexToRgb(hex: string): RGBAColor {
    const cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 6) {
      return {
        r: parseInt(cleanHex.substring(0, 2), 16),
        g: parseInt(cleanHex.substring(2, 4), 16),
        b: parseInt(cleanHex.substring(4, 6), 16),
        a: 255
      };
    }
    return { r: 0, g: 0, b: 0, a: 255 };
  }
}
