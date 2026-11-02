/**
 * Sprite Studio Types & Contracts (PX-10)
 *
 * Defines pipeline stage declarations, pixel data models, palette formats,
 * grid detection models, batch queue items, presets, and engine export manifests.
 */

export interface RGBAColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-255
}

export interface RawPixelData {
  width: number;
  height: number;
  data: Uint8Array | number[]; // RGBA array of length width * height * 4
  colorMode: 'rgba8' | 'rgb8' | 'indexed' | 'grayscale';
  hasAlpha: boolean;
  frameCount?: number;
}

export interface ImageIngestValidationResult {
  valid: boolean;
  format: 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'unknown';
  dimensions: { width: number; height: number };
  frameCount: number;
  estimatedMemoryBytes: number;
  hasAlpha: boolean;
  isDecompressionBombRisk: boolean;
  error?: string;
}

export interface GridCandidate {
  gridSize: number;
  confidence: number; // 0.0 - 1.0
  cellCountX: number;
  cellCountY: number;
  reason: string;
}

export interface GridDetectionResult {
  detected: boolean;
  recommendedGridSize: number;
  candidates: GridCandidate[];
  mode: 'auto' | 'hint' | 'forced' | 'no_grid_preserved';
  appliedGridSize?: number;
}

export interface BackgroundRemovalOptions {
  mode: 'auto_border' | 'corner' | 'eyedropper' | 'custom_color';
  targetColor?: RGBAColor;
  tolerance: number; // 0-255
  cleanNoiseSpecks: boolean;
  preserveHoles: boolean;
  trimTransparentMargins: boolean;
}

export interface BackgroundRemovalResult {
  removedPixels: number;
  detectedBackgroundColor: RGBAColor;
  trimmedBounds?: { x: number; y: number; width: number; height: number };
  pixels: RawPixelData;
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: RGBAColor[];
  description?: string;
  isBuiltIn?: boolean;
}

export type DitherAlgorithm = 'none' | 'floyd-steinberg' | 'bayer-2x2' | 'bayer-4x4' | 'bayer-8x8';

export interface QuantizationOptions {
  paletteId?: string;
  customPalette?: ColorPalette;
  maxColors?: number;
  dithering: DitherAlgorithm;
  ditherStrength?: number; // 0.0 - 1.0
  colorDistanceMetric?: 'euclidean' | 'oklab' | 'perceptual';
  preserveAlphaThreshold?: number; // 0-255
}

export interface QuantizationResult {
  usedPalette: ColorPalette;
  paletteUsageReport: Record<string, number>; // Hex color -> pixel count
  colorCoveragePercentage: number;
  pixels: RawPixelData;
}

export interface OutlineOptions {
  type: 'none' | '4-way' | '8-way';
  color: RGBAColor;
  thickness: number; // in logical pixels
  padding?: number;
  targetDimensions?: { width: number; height: number };
  anchor?: 'center' | 'bottom_center' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
  integerScale?: number; // 1, 2, 3, 4, etc.
}

export interface OutlineResult {
  bounds: { width: number; height: number };
  outlinePixelsAdded: number;
  collisionMask: {
    type: 'bounding_box' | 'convex_hull';
    points: Array<{ x: number; y: number }>;
  };
  pixels: RawPixelData;
}

export interface PipelinePreset {
  id: string;
  version: string;
  name: string;
  description?: string;
  gridMode?: 'auto' | 'hint' | 'forced' | 'none';
  gridSizeHint?: number;
  backgroundRemoval?: BackgroundRemovalOptions;
  quantization?: QuantizationOptions;
  outline?: OutlineOptions;
  exportScale?: number;
  format?: 'png' | 'webp' | 'svg';
  createdAt: string;
  updatedAt: string;
}

export interface BatchItemState {
  id: string;
  inputPath: string;
  outputPath?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  stage: string;
  progress: number;
  error?: string;
  metrics?: {
    originalDimensions: { width: number; height: number };
    finalDimensions: { width: number; height: number };
    colorCount: number;
    processingTimeMs: number;
  };
}

export interface BatchSession {
  id: string;
  preset: PipelinePreset;
  items: BatchItemState[];
  totalCount: number;
  completedCount: number;
  failedCount: number;
  state: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface SpriteQualityFixture {
  id: string;
  name: string;
  inputPath: string;
  referencePath?: string;
  expectedColorCount: number;
  maxPerceptualDifference: number; // 0.0 - 1.0 (e.g. DeltaE / SSIM)
  minAlphaMatchPercentage: number;
}

export interface SpriteQualityReport {
  fixtureId: string;
  passed: boolean;
  actualColorCount: number;
  perceptualDifference: number;
  alphaMatchPercentage: number;
  notes: string[];
}

export interface EngineHandoffOptions {
  engine: 'godot' | 'unity' | 'custom';
  targetProjectRoot: string;
  spriteSubdirectory?: string;
  approvedByUser: boolean;
  approvalDigest?: string;
  createGodotImportHints?: boolean;
  createGodotNinePatch?: boolean;
  createGodotSpriteFrames?: boolean;
  createUnityMetaFiles?: boolean;
}

export interface EngineHandoffResult {
  success: boolean;
  targetFiles: Array<{ path: string; fileType: string; sha256: string }>;
  manifestPath: string;
  thirdPartyNotices: string;
  error?: string;
  requiredApprovalDigest?: string;
}
