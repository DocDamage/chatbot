/**
 * Storage Planning & Install Presets Schemas and Types (Section 54)
 *
 * Implements installer storage estimation, float32 vector sizing calculation (§54.1),
 * and tiered install presets (§54.2) with disk safety headroom verification.
 */

export type InstallPresetTier = 'Lite' | 'Developer' | 'Research' | 'Extended' | 'Custom';

export interface PackStorageProfile {
  packId: string;
  name: string;
  documentCount: number;
  chunkCount: number;
  avgChunkTextBytes: number;
  embeddingDimensions: number; // e.g. 768 or 1536
  downloadCompressedBytes: number;
}

export interface StorageEstimateBreakdown {
  downloadBytes: number;
  normalizedTextBytes: number;
  rawVectorBytes: number;
  indexOverheadBytes: number;
  totalFootprintBytes: number;
  minimumFreeDiskBytes: number; // typically 2x total footprint
}

export interface PresetPlan {
  preset: InstallPresetTier;
  description: string;
  includedPackIds: string[];
  breakdown: StorageEstimateBreakdown;
  indiscriminateEmbeddingAllowed: boolean; // strictly false
}

export interface DiskHeadroomCheck {
  availableDiskBytes: number;
  requiredBytes: number;
  hasSufficientSpace: boolean;
  shortfallBytes: number;
  warning?: string;
}
