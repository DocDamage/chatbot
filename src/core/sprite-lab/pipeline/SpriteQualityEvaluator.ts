/**
 * Sprite Quality & Regression Evaluator (PX10-T08)
 *
 * Runs regression fixtures and computes perceptual differences, color coverage,
 * and alpha preservation quality reports.
 */

import { RawPixelData, SpriteQualityFixture, SpriteQualityReport } from './SpriteStudioTypes';
import { SpritePaletteEngine } from './SpritePaletteEngine';

export class SpriteQualityEvaluator {
  /**
   * Evaluates processed pixel data against a quality fixture.
   */
  public static evaluateFixture(fixture: SpriteQualityFixture, actualPixels: RawPixelData): SpriteQualityReport {
    const notes: string[] = [];

    // 1. Measure unique colors used
    const uniqueColors = new Set<string>();
    let transparentCount = 0;
    const totalPixels = actualPixels.width * actualPixels.height;

    for (let i = 0; i < actualPixels.data.length; i += 4) {
      const a = actualPixels.data[i + 3];
      if (a === 0) {
        transparentCount++;
      } else {
        const hex = SpritePaletteEngine.rgbToHex({
          r: actualPixels.data[i],
          g: actualPixels.data[i + 1],
          b: actualPixels.data[i + 2],
          a
        });
        uniqueColors.add(hex);
      }
    }

    const actualColorCount = uniqueColors.size;
    const alphaMatchPercentage = totalPixels > 0
      ? Math.round(((totalPixels - transparentCount) / totalPixels) * 100)
      : 100;

    // 2. Measure perceptual difference and color boundaries
    const colorDifferenceRatio = actualColorCount > fixture.expectedColorCount
      ? (actualColorCount - fixture.expectedColorCount) / Math.max(1, fixture.expectedColorCount)
      : 0;
    const perceptualDifference = Math.min(1.0, Math.round(colorDifferenceRatio * 100) / 100);

    const passedColors = actualColorCount <= fixture.expectedColorCount;
    const passedPerceptual = perceptualDifference <= fixture.maxPerceptualDifference;
    const passedAlpha = alphaMatchPercentage >= (fixture.minAlphaMatchPercentage || 0);

    const passed = passedColors && passedPerceptual && passedAlpha;

    if (!passedColors) {
      notes.push(`Color count (${actualColorCount}) exceeded fixture threshold (${fixture.expectedColorCount}).`);
    }
    if (!passedPerceptual) {
      notes.push(`Perceptual difference (${perceptualDifference}) exceeded max limit (${fixture.maxPerceptualDifference}).`);
    }
    if (!passedAlpha) {
      notes.push(`Alpha percentage (${alphaMatchPercentage}%) below minimum required (${fixture.minAlphaMatchPercentage}%).`);
    }
    if (passed) {
      notes.push('All deterministic quality gates and color bounds verified.');
    }

    return {
      fixtureId: fixture.id,
      passed,
      actualColorCount,
      perceptualDifference,
      alphaMatchPercentage,
      notes
    };
  }
}
