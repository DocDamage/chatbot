/**
 * Phase PX-10 Evaluation & Quality Test Suite
 *
 * Tests Versioned Pipeline, Ingest Hardening, Grid Detection, Background Removal,
 * Palette Quantization & Dithering, Outlines & Finishing, Batch Processing,
 * Quality Regression Fixtures, and Engine Handoffs.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ImageIngestValidator } from '../pipeline/ImageIngestValidator';
import { PixelGridRefiner } from '../pipeline/PixelGridRefiner';
import { SpriteBackgroundTool } from '../pipeline/SpriteBackgroundTool';
import { SpritePaletteEngine } from '../pipeline/SpritePaletteEngine';
import { SpriteOutlineFinisher } from '../pipeline/SpriteOutlineFinisher';
import { SpriteBatchPresetService } from '../pipeline/SpriteBatchPresetService';
import { SpriteQualityEvaluator } from '../pipeline/SpriteQualityEvaluator';
import { SpriteEngineHandoff } from '../pipeline/SpriteEngineHandoff';
import { ImageProcessingPipeline } from '../pipeline/ImageProcessingPipeline';
import { RawPixelData } from '../pipeline/SpriteStudioTypes';

describe('Phase PX-10: Sprite and Image Asset Studio', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprite-studio-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // Helper to create a test RGBA pixel buffer
  function createTestImage(width: number, height: number, fillColor = { r: 255, g: 255, b: 255, a: 255 }): RawPixelData {
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fillColor.r;
      data[i + 1] = fillColor.g;
      data[i + 2] = fillColor.b;
      data[i + 3] = fillColor.a;
    }
    return {
      width,
      height,
      data,
      colorMode: 'rgba8',
      hasAlpha: true
    };
  }

  describe('PX10-T02 & PX10-T11: Ingest Hardening & Decompression-Bomb Protection', () => {
    it('validates standard PNG headers and dimensions correctly', () => {
      // Mock 32x32 PNG header
      const pngHeader = Buffer.alloc(32);
      pngHeader.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      pngHeader.writeUInt32BE(32, 16); // width = 32
      pngHeader.writeUInt32BE(32, 20); // height = 32
      pngHeader[25] = 6; // RGBA color type

      const res = ImageIngestValidator.validateBuffer(pngHeader, 'character.png');
      expect(res.valid).toBe(true);
      expect(res.format).toBe('png');
      expect(res.dimensions).toEqual({ width: 32, height: 32 });
      expect(res.hasAlpha).toBe(true);
      expect(res.isDecompressionBombRisk).toBe(false);
    });

    it('rejects decompression bombs with excessive dimensions', () => {
      const hugePngHeader = Buffer.alloc(32);
      hugePngHeader.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      hugePngHeader.writeUInt32BE(16000, 16); // width = 16000 (exceeds 8192 cap)
      hugePngHeader.writeUInt32BE(16000, 20); // height = 16000
      hugePngHeader[25] = 6;

      const res = ImageIngestValidator.validateBuffer(hugePngHeader, 'bomb.png');
      expect(res.valid).toBe(false);
      expect(res.isDecompressionBombRisk).toBe(true);
      expect(res.error).toContain('Decompression-bomb limit exceeded');
    });

    it('sanitizes filename paths and rejects path traversal attacks', () => {
      const smallBuf = Buffer.alloc(32);
      smallBuf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
      smallBuf.writeUInt32BE(16, 16);
      smallBuf.writeUInt32BE(16, 20);
      smallBuf[25] = 6;

      const res = ImageIngestValidator.validateBuffer(smallBuf, '../../etc/passwd.png');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Path safety violation');
    });
  });

  describe('PX10-T03: Grid Detection, Confidence Scoring & Resampling', () => {
    it('estimates grid sizes and scores candidates', () => {
      const img = createTestImage(64, 64);
      // Paint vertical stripes at 16px intervals to simulate a 16px grid
      for (let x = 16; x < 64; x += 16) {
        for (let y = 0; y < 64; y++) {
          const idx = (y * 64 + x) * 4;
          img.data[idx] = 0; // Black stripe
          img.data[idx + 1] = 0;
          img.data[idx + 2] = 0;
        }
      }

      const detection = PixelGridRefiner.detectGrid(img);
      expect(detection.detected).toBe(true);
      expect(detection.candidates.length).toBeGreaterThan(0);
      expect(detection.candidates.some(c => c.gridSize === 16)).toBe(true);
    });

    it('performs nearest-neighbor logical pixel resampling and anti-alias cleanup', () => {
      const img = createTestImage(32, 32);
      // Put a semi-transparent halo at border
      img.data[3] = 64; // Alpha below 128

      const cleaned = PixelGridRefiner.cleanAntiAliasing(img, 128);
      expect(cleaned.data[3]).toBe(0); // Cleaned to full transparency

      const downscaled = PixelGridRefiner.resampleNearestNeighbor(cleaned, 16, 16);
      expect(downscaled.width).toBe(16);
      expect(downscaled.height).toBe(16);
    });
  });

  describe('PX10-T04: Background Removal & Transparency', () => {
    it('removes border background color while preserving interior holes when requested', () => {
      // 16x16 image with white background (255, 255, 255) and black box in center (8x8)
      // containing an inner white hole (2x2)
      const img = createTestImage(16, 16, { r: 255, g: 255, b: 255, a: 255 });

      // Draw black frame from 4 to 12
      for (let y = 4; y < 12; y++) {
        for (let x = 4; x < 12; x++) {
          const idx = (y * 16 + x) * 4;
          img.data[idx] = 0;
          img.data[idx + 1] = 0;
          img.data[idx + 2] = 0;
        }
      }

      // Draw white center hole (6,6) to (8,8)
      for (let y = 6; y < 8; y++) {
        for (let x = 6; x < 8; x++) {
          const idx = (y * 16 + x) * 4;
          img.data[idx] = 255;
          img.data[idx + 1] = 255;
          img.data[idx + 2] = 255;
        }
      }

      const result = SpriteBackgroundTool.removeBackground(img, {
        mode: 'auto_border',
        tolerance: 10,
        cleanNoiseSpecks: true,
        preserveHoles: true,
        trimTransparentMargins: false
      });

      expect(result.removedPixels).toBeGreaterThan(0);
      expect(result.detectedBackgroundColor.r).toBe(255);

      // Verify outer border is now transparent (alpha == 0)
      const outerPixelAlpha = result.pixels.data[0 + 3];
      expect(outerPixelAlpha).toBe(0);

      // Verify inner hole (7,7) remains opaque because preserveHoles was true
      const innerHoleAlpha = result.pixels.data[(7 * 16 + 7) * 4 + 3];
      expect(innerHoleAlpha).toBe(255);
    });
  });

  describe('PX10-T05: Palette Quantization & Dithering', () => {
    it('quantizes image to PICO-8 palette with Floyd-Steinberg dithering and usage report', () => {
      const img = createTestImage(16, 16, { r: 200, g: 50, b: 80, a: 255 });

      const quantResult = SpritePaletteEngine.quantize(img, {
        paletteId: 'pico-8',
        dithering: 'floyd-steinberg'
      });

      expect(quantResult.usedPalette.id).toBe('pico-8');
      expect(Object.keys(quantResult.paletteUsageReport).length).toBeGreaterThan(0);
      expect(quantResult.colorCoveragePercentage).toBeGreaterThan(0);
      expect(quantResult.pixels.width).toBe(16);
    });

    it('quantizes to GameBoy 4-color palette using Bayer ordered dithering', () => {
      const img = createTestImage(16, 16, { r: 100, g: 150, b: 30, a: 255 });

      const quantResult = SpritePaletteEngine.quantize(img, {
        paletteId: 'gameboy',
        dithering: 'bayer-4x4'
      });

      expect(quantResult.usedPalette.id).toBe('gameboy');
      expect(quantResult.pixels.data.length).toBe(16 * 16 * 4);
    });
  });

  describe('PX10-T06: Outline, Finishing & Collision Mask Generation', () => {
    it('adds 4-way outline and scales image by integer factor', () => {
      // 8x8 image with 4x4 opaque center
      const img = createTestImage(8, 8, { r: 0, g: 0, b: 0, a: 0 }); // Transparent background
      for (let y = 2; y < 6; y++) {
        for (let x = 2; x < 6; x++) {
          const idx = (y * 8 + x) * 4;
          img.data[idx] = 255;
          img.data[idx + 1] = 0;
          img.data[idx + 2] = 0;
          img.data[idx + 3] = 255; // Red square
        }
      }

      const finished = SpriteOutlineFinisher.applyFinishing(img, {
        type: '4-way',
        color: { r: 255, g: 255, b: 255, a: 255 },
        thickness: 1,
        integerScale: 2
      });

      expect(finished.outlinePixelsAdded).toBeGreaterThan(0);
      // Dimensions scaled by 2 (original 8+2=10 with padding -> 20x20)
      expect(finished.bounds.width).toBe(20);
      expect(finished.bounds.height).toBe(20);
      expect(finished.collisionMask.points.length).toBe(4);
    });
  });

  describe('PX10-T07: Batch Processing & Preset Management', () => {
    it('creates batch session, manages items, and supports cancellation', () => {
      const service = SpriteBatchPresetService.getInstance();
      const session = service.createBatchSession(['sprite1.png', 'sprite2.png', 'sprite3.png'], 'retro-pixel-cleanup');

      expect(session.id).toBeDefined();
      expect(session.totalCount).toBe(3);
      expect(session.state).toBe('queued');

      service.updateItemProgress(session.id, 'item-1', { status: 'completed', progress: 100 });
      expect(service.getSession(session.id)?.completedCount).toBe(1);

      const cancelled = service.cancelSession(session.id);
      expect(cancelled).toBe(true);
      expect(service.getSession(session.id)?.state).toBe('cancelled');
    });
  });

  describe('PX10-T08 & PX10-T01: Versioned Image Processing Pipeline & Quality Fixtures', () => {
    it('executes full 12-stage pipeline and verifies regression fixtures', () => {
      const img = createTestImage(32, 32, { r: 255, g: 255, b: 255, a: 255 }); // White background
      // Draw colored sprite in center (from 8,8 to 24,24)
      for (let y = 8; y < 24; y++) {
        for (let x = 8; x < 24; x++) {
          const idx = (y * 32 + x) * 4;
          img.data[idx] = 180; // Reddish-purple subject
          img.data[idx + 1] = 40;
          img.data[idx + 2] = 80;
          img.data[idx + 3] = 255;
        }
      }
      const preset = SpriteBatchPresetService.getInstance().getPreset('retro-pixel-cleanup')!;

      const result = ImageProcessingPipeline.processImage({ pixels: img }, preset);
      expect(result.success).toBe(true);
      expect(result.stages.ingestValid).toBe(true);
      expect(result.manifest.pipelineVersion).toBe('1.0.0-px10');
      expect(result.outputPixels.width).toBeGreaterThan(0);

      // Run quality fixture evaluation
      const qualityReport = SpriteQualityEvaluator.evaluateFixture({
        id: 'fixture-pico8-retro',
        name: 'PICO-8 Quality Fixture',
        inputPath: 'test.png',
        expectedColorCount: 16,
        maxPerceptualDifference: 0.5,
        minAlphaMatchPercentage: 50
      }, result.outputPixels);

      expect(qualityReport.passed).toBe(true);
      expect(qualityReport.actualColorCount).toBeLessThanOrEqual(16);
    });

    it('does not fabricate decoded pixels from encoded image bytes', () => {
      const pngHeader = Buffer.alloc(26);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(pngHeader);
      pngHeader.writeUInt32BE(2, 16);
      pngHeader.writeUInt32BE(2, 20);
      pngHeader[25] = 6;
      const preset = SpriteBatchPresetService.getInstance().getPreset('retro-pixel-cleanup')!;
      expect(() => ImageProcessingPipeline.processImage({ buffer: pngHeader, fileName: 'fixture.png' }, preset))
        .toThrow(/DECODED_PIXEL_INPUT_REQUIRED/);
    });
  });

  describe('PX10-T09: Engine Handoffs for Godot & Unity', () => {
    it('requires explicit user approval before performing filesystem export', async () => {
      const img = createTestImage(16, 16);

      const unapproved = await SpriteEngineHandoff.prepareEngineHandoff('hero_idle', img, {
        engine: 'godot',
        targetProjectRoot: tempDir,
        approvedByUser: false
      });

      expect(unapproved.success).toBe(false);
      expect(unapproved.error).toContain('EXACT_SCOPE_APPROVAL_REQUIRED');
      expect(unapproved.requiredApprovalDigest).toHaveLength(64);

      const approved = await SpriteEngineHandoff.prepareEngineHandoff('hero_idle', img, {
        engine: 'godot',
        targetProjectRoot: tempDir,
        approvedByUser: true,
        approvalDigest: unapproved.requiredApprovalDigest,
        createGodotImportHints: true,
        createGodotNinePatch: true,
        createUnityMetaFiles: true
      });

      expect(approved.success).toBe(true);
      expect(approved.targetFiles.length).toBeGreaterThanOrEqual(3);
      expect(fs.existsSync(approved.manifestPath)).toBe(true);

      const manifestContent = JSON.parse(fs.readFileSync(approved.manifestPath, 'utf-8'));
      expect(manifestContent.spriteName).toBe('hero_idle');
      expect(manifestContent.files.length).toBeGreaterThanOrEqual(3);
    });

    it('invalidates approval when pixels or destination scope changes', async () => {
      const img = createTestImage(4, 4);
      const digest = SpriteEngineHandoff.computeApprovalDigest('hero', img, {
        engine: 'godot', targetProjectRoot: tempDir, spriteSubdirectory: 'sprites'
      });
      img.data[0] = 123;

      const result = await SpriteEngineHandoff.prepareEngineHandoff('hero', img, {
        engine: 'godot', targetProjectRoot: tempDir, spriteSubdirectory: 'sprites',
        approvedByUser: true, approvalDigest: digest
      });
      expect(result.success).toBe(false);
      expect(result.requiredApprovalDigest).not.toBe(digest);
    });
  });
});
