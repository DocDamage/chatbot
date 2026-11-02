/**
 * Sprite Studio API Routes (PX10-T10)
 *
 * Exposes REST endpoints for image pipeline processing, grid detection,
 * background removal, palette quantization, outlines, batch sessions,
 * presets, and engine handoffs.
 */

import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { ImageProcessingPipeline } from '../../../core/sprite-lab/pipeline/ImageProcessingPipeline';
import { PixelGridRefiner } from '../../../core/sprite-lab/pipeline/PixelGridRefiner';
import { SpriteBackgroundTool } from '../../../core/sprite-lab/pipeline/SpriteBackgroundTool';
import { SpritePaletteEngine } from '../../../core/sprite-lab/pipeline/SpritePaletteEngine';
import { SpriteOutlineFinisher } from '../../../core/sprite-lab/pipeline/SpriteOutlineFinisher';
import { SpriteBatchPresetService } from '../../../core/sprite-lab/pipeline/SpriteBatchPresetService';
import { SpriteEngineHandoff } from '../../../core/sprite-lab/pipeline/SpriteEngineHandoff';
import { SpriteQualityEvaluator } from '../../../core/sprite-lab/pipeline/SpriteQualityEvaluator';
import { RawPixelData } from '../../../core/sprite-lab/pipeline/SpriteStudioTypes';
import { resolveWorkspacePath } from '../localPathGuard';
import { ValidationError } from '../../../utils/errors';

const MAX_PIXELS = 16 * 1024 * 1024;

function toRawPixels(value: any): RawPixelData {
  const width = Number(value?.width);
  const height = Number(value?.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192) {
    throw new ValidationError('Pixel dimensions must be positive integers no larger than 8192.');
  }
  if (width * height > MAX_PIXELS || !Array.isArray(value.data) || value.data.length !== width * height * 4) {
    throw new ValidationError('Pixel data must contain exactly width × height × 4 RGBA values within the 16-megapixel limit.');
  }
  return { width, height, data: new Uint8Array(value.data), colorMode: 'rgba8', hasAlpha: true };
}

export function createSpriteStudioRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const batchService = SpriteBatchPresetService.getInstance();

  // 1. Presets
  router.get('/api/sprite-studio/presets', asyncHandler(async (_req, res) => {
    res.json({ presets: batchService.getPresets() });
  }));

  router.post('/api/sprite-studio/presets', asyncHandler(async (req, res) => {
    const preset = req.body;
    if (!preset || !preset.id || !preset.name) {
      return res.status(400).json({ error: 'Preset id and name are required.' });
    }
    const saved = batchService.savePreset(preset);
    res.json({ preset: saved });
  }));

  // 2. Built-in Palettes
  router.get('/api/sprite-studio/palettes', asyncHandler(async (_req, res) => {
    res.json({ palettes: Object.values(SpritePaletteEngine.BUILT_IN_PALETTES) });
  }));

  // 3. Single-Image Pipeline Execution
  router.post('/api/sprite-studio/pipeline/process', asyncHandler(async (req, res) => {
    const { pixels, presetId, customPreset } = req.body;
    if (!pixels || !pixels.width || !pixels.height || !pixels.data) {
      return res.status(400).json({ error: 'Valid pixels object (width, height, data array) is required.' });
    }

    const rawPixels = toRawPixels(pixels);

    const preset = customPreset || batchService.getPreset(presetId) || batchService.getPresets()[0];
    const result = ImageProcessingPipeline.processImage({ pixels: rawPixels }, preset);

    res.json({
      success: result.success,
      manifest: result.manifest,
      stages: {
        ingestValid: result.stages.ingestValid,
        gridDetected: result.stages.gridDetection?.detected,
        recommendedGridSize: result.stages.gridDetection?.recommendedGridSize,
        removedPixels: result.stages.backgroundRemoval?.removedPixels,
        usedPalette: result.stages.quantization?.usedPalette.name,
        colorCoveragePercentage: result.stages.quantization?.colorCoveragePercentage,
        outlinePixelsAdded: result.stages.finishing?.outlinePixelsAdded
      },
      outputDimensions: { width: result.outputPixels.width, height: result.outputPixels.height },
      outputPixelDataLength: result.outputPixels.data.length
    });
  }));

  // 4. Grid Detection API
  router.post('/api/sprite-studio/grid/detect', asyncHandler(async (req, res) => {
    const { pixels, mode, hintSize } = req.body;
    if (!pixels || !pixels.width || !pixels.height) {
      return res.status(400).json({ error: 'Valid pixels object is required.' });
    }

    const rawPixels = toRawPixels(pixels);

    const result = PixelGridRefiner.detectGrid(rawPixels, { mode, hintSize });
    res.json(result);
  }));

  // 5. Background Removal API
  router.post('/api/sprite-studio/background/remove', asyncHandler(async (req, res) => {
    const { pixels, options } = req.body;
    if (!pixels || !pixels.width || !pixels.height) {
      return res.status(400).json({ error: 'Valid pixels object is required.' });
    }

    const rawPixels = toRawPixels(pixels);

    const result = SpriteBackgroundTool.removeBackground(rawPixels, options || {
      mode: 'auto_border',
      tolerance: 30,
      cleanNoiseSpecks: true,
      preserveHoles: true,
      trimTransparentMargins: true
    });

    res.json({
      removedPixels: result.removedPixels,
      detectedBackgroundColor: result.detectedBackgroundColor,
      trimmedBounds: result.trimmedBounds,
      outputDimensions: { width: result.pixels.width, height: result.pixels.height }
    });
  }));

  // 6. Batch Sessions
  router.post('/api/sprite-studio/batch/create', asyncHandler(async (req, res) => {
    const { inputPaths, presetId } = req.body;
    if (!Array.isArray(inputPaths) || inputPaths.length === 0) {
      return res.status(400).json({ error: 'inputPaths array is required.' });
    }

    const safeInputPaths = inputPaths.map(inputPath => resolveWorkspacePath(workspaceRoot, inputPath, {
      label: 'inputPaths item', mustExist: true, kind: 'file'
    }));
    const session = batchService.createBatchSession(safeInputPaths, presetId || 'retro-pixel-cleanup');
    res.json(session);
  }));

  router.get('/api/sprite-studio/batch/:id', asyncHandler(async (req, res) => {
    const session = batchService.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    res.json(session);
  }));

  router.post('/api/sprite-studio/batch/:id/cancel', asyncHandler(async (req, res) => {
    const cancelled = batchService.cancelSession(req.params.id);
    res.json({ success: cancelled, sessionId: req.params.id });
  }));

  // 7. Engine Handoff
  router.post('/api/sprite-studio/engine-handoff', asyncHandler(async (req, res) => {
    const { spriteName, pixels, options } = req.body;
    if (!spriteName || !pixels || !options) {
      return res.status(400).json({ error: 'spriteName, pixels, and options are required.' });
    }

    const rawPixels = toRawPixels(pixels);

    const result = await SpriteEngineHandoff.prepareEngineHandoff(spriteName, rawPixels, {
      engine: options.engine || 'godot',
      targetProjectRoot: resolveWorkspacePath(workspaceRoot, options.targetProjectRoot || workspaceRoot, {
        label: 'targetProjectRoot', mustExist: true, kind: 'directory'
      }),
      spriteSubdirectory: options.spriteSubdirectory || 'sprites',
      approvedByUser: options.approvedByUser === true,
      approvalDigest: options.approvalDigest,
      createGodotImportHints: options.createGodotImportHints ?? true,
      createGodotNinePatch: options.createGodotNinePatch ?? true,
      createUnityMetaFiles: options.createUnityMetaFiles ?? true
    });

    res.json(result);
  }));

  return router;
}
