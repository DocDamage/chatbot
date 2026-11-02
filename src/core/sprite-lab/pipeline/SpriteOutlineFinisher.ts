/**
 * Sprite Outline & Finishing Processor (PX10-T06)
 *
 * Implements 4-way/8-way outlines, custom padding, anchor alignment,
 * integer scaling, and collision-mask polygon generation.
 */

import { OutlineOptions, OutlineResult, RawPixelData, RGBAColor } from './SpriteStudioTypes';

export class SpriteOutlineFinisher {
  /**
   * Applies pixel outline, padding, anchor alignment, and generates collision mask.
   */
  public static applyFinishing(pixels: RawPixelData, options: OutlineOptions): OutlineResult {
    let currentPixels = pixels;
    let outlinePixelsAdded = 0;

    // 1. Apply 4-way or 8-way outline
    if (options.type !== 'none' && options.thickness > 0) {
      const outlineRes = this.generateOutline(currentPixels, options.type, options.color, options.thickness);
      currentPixels = outlineRes.pixels;
      outlinePixelsAdded = outlineRes.addedCount;
    }

    // 2. Padding and target dimensions / anchor alignment
    if (options.targetDimensions || (options.padding && options.padding > 0)) {
      currentPixels = this.fitToTargetDimensions(
        currentPixels,
        options.targetDimensions,
        options.padding || 0,
        options.anchor || 'center'
      );
    }

    // 3. Integer scaling (1x, 2x, 3x, 4x, etc.)
    if (options.integerScale && options.integerScale > 1) {
      currentPixels = this.applyIntegerScale(currentPixels, Math.floor(options.integerScale));
    }

    // 4. Generate collision mask
    const collisionMask = this.generateCollisionMask(currentPixels);

    return {
      bounds: { width: currentPixels.width, height: currentPixels.height },
      outlinePixelsAdded,
      collisionMask,
      pixels: currentPixels
    };
  }

  /**
   * Generates a 4-way or 8-way outline around all non-transparent pixels.
   */
  private static generateOutline(
    pixels: RawPixelData,
    type: '4-way' | '8-way',
    color: RGBAColor,
    thickness: number
  ): { pixels: RawPixelData; addedCount: number } {
    const pad = thickness;
    const newW = pixels.width + pad * 2;
    const newH = pixels.height + pad * 2;
    const dst = new Uint8Array(newW * newH * 4);

    // Copy original image into center
    for (let y = 0; y < pixels.height; y++) {
      for (let x = 0; x < pixels.width; x++) {
        const srcIdx = (y * pixels.width + x) * 4;
        const dstIdx = ((y + pad) * newW + (x + pad)) * 4;
        dst[dstIdx] = pixels.data[srcIdx];
        dst[dstIdx + 1] = pixels.data[srcIdx + 1];
        dst[dstIdx + 2] = pixels.data[srcIdx + 2];
        dst[dstIdx + 3] = pixels.data[srcIdx + 3];
      }
    }

    // Directions
    const deltas4 = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const deltas8 = [
      [0, -1], [0, 1], [-1, 0], [1, 0],
      [-1, -1], [1, -1], [-1, 1], [1, 1]
    ];
    const deltas = type === '8-way' ? deltas8 : deltas4;

    const outlinePixels = new Uint8Array(newW * newH);
    let addedCount = 0;

    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        const idx = (y * newW + x) * 4;
        // If current pixel is already opaque, continue
        if (dst[idx + 3] > 0) continue;

        // Check if any neighbor within thickness is opaque
        let hasOpaqueNeighbor = false;
        for (const [dx, dy] of deltas) {
          for (let step = 1; step <= thickness; step++) {
            const nx = x + dx * step;
            const ny = y + dy * step;
            if (nx >= 0 && nx < newW && ny >= 0 && ny < newH) {
              const nIdx = (ny * newW + nx) * 4;
              // Check if original content was opaque
              if (dst[nIdx + 3] > 0 && !outlinePixels[ny * newW + nx]) {
                hasOpaqueNeighbor = true;
                break;
              }
            }
          }
          if (hasOpaqueNeighbor) break;
        }

        if (hasOpaqueNeighbor) {
          outlinePixels[y * newW + x] = 1;
        }
      }
    }

    // Apply outline pixels
    for (let i = 0; i < newW * newH; i++) {
      if (outlinePixels[i]) {
        const idx = i * 4;
        dst[idx] = color.r;
        dst[idx + 1] = color.g;
        dst[idx + 2] = color.b;
        dst[idx + 3] = color.a;
        addedCount++;
      }
    }

    return {
      pixels: {
        width: newW,
        height: newH,
        data: dst,
        colorMode: 'rgba8',
        hasAlpha: true
      },
      addedCount
    };
  }

  private static fitToTargetDimensions(
    pixels: RawPixelData,
    targetDim?: { width: number; height: number },
    padding = 0,
    anchor: 'center' | 'bottom_center' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' = 'center'
  ): RawPixelData {
    const minW = pixels.width + padding * 2;
    const minH = pixels.height + padding * 2;
    const targetW = targetDim ? Math.max(targetDim.width, minW) : minW;
    const targetH = targetDim ? Math.max(targetDim.height, minH) : minH;

    const dst = new Uint8Array(targetW * targetH * 4);

    // Compute placement offsetX, offsetY based on anchor
    let offsetX = padding;
    let offsetY = padding;

    if (targetDim) {
      const availW = targetW - pixels.width;
      const availH = targetH - pixels.height;

      switch (anchor) {
        case 'center':
          offsetX = Math.floor(availW / 2);
          offsetY = Math.floor(availH / 2);
          break;
        case 'bottom_center':
          offsetX = Math.floor(availW / 2);
          offsetY = availH - padding;
          break;
        case 'top_left':
          offsetX = padding;
          offsetY = padding;
          break;
        case 'top_right':
          offsetX = availW - padding;
          offsetY = padding;
          break;
        case 'bottom_left':
          offsetX = padding;
          offsetY = availH - padding;
          break;
        case 'bottom_right':
          offsetX = availW - padding;
          offsetY = availH - padding;
          break;
      }
    }

    for (let y = 0; y < pixels.height; y++) {
      const dstY = offsetY + y;
      if (dstY < 0 || dstY >= targetH) continue;
      for (let x = 0; x < pixels.width; x++) {
        const dstX = offsetX + x;
        if (dstX < 0 || dstX >= targetW) continue;

        const srcIdx = (y * pixels.width + x) * 4;
        const dstIdx = (dstY * targetW + dstX) * 4;

        dst[dstIdx] = pixels.data[srcIdx];
        dst[dstIdx + 1] = pixels.data[srcIdx + 1];
        dst[dstIdx + 2] = pixels.data[srcIdx + 2];
        dst[dstIdx + 3] = pixels.data[srcIdx + 3];
      }
    }

    return {
      width: targetW,
      height: targetH,
      data: dst,
      colorMode: 'rgba8',
      hasAlpha: true
    };
  }

  private static applyIntegerScale(pixels: RawPixelData, factor: number): RawPixelData {
    if (factor <= 1) return pixels;

    const w = pixels.width;
    const h = pixels.height;
    const newW = w * factor;
    const newH = h * factor;
    const dst = new Uint8Array(newW * newH * 4);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = (y * w + x) * 4;
        const r = pixels.data[srcIdx];
        const g = pixels.data[srcIdx + 1];
        const b = pixels.data[srcIdx + 2];
        const a = pixels.data[srcIdx + 3];

        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) {
            const dstIdx = ((y * factor + dy) * newW + (x * factor + dx)) * 4;
            dst[dstIdx] = r;
            dst[dstIdx + 1] = g;
            dst[dstIdx + 2] = b;
            dst[dstIdx + 3] = a;
          }
        }
      }
    }

    return {
      width: newW,
      height: newH,
      data: dst,
      colorMode: pixels.colorMode,
      hasAlpha: pixels.hasAlpha
    };
  }

  private static generateCollisionMask(pixels: RawPixelData): { type: 'bounding_box' | 'convex_hull'; points: Array<{ x: number; y: number }> } {
    let minX = pixels.width, minY = pixels.height, maxX = 0, maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < pixels.height; y++) {
      for (let x = 0; x < pixels.width; x++) {
        const a = pixels.data[(y * pixels.width + x) * 4 + 3];
        if (a > 32) {
          hasPixels = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasPixels) {
      return {
        type: 'bounding_box',
        points: [
          { x: 0, y: 0 },
          { x: pixels.width, y: 0 },
          { x: pixels.width, y: pixels.height },
          { x: 0, y: pixels.height }
        ]
      };
    }

    return {
      type: 'bounding_box',
      points: [
        { x: minX, y: minY },
        { x: maxX + 1, y: minY },
        { x: maxX + 1, y: maxY + 1 },
        { x: minX, y: maxY + 1 }
      ]
    };
  }
}
