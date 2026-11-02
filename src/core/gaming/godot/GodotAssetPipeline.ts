/**
 * Godot Asset Pipeline & Export Runner (PX08-T09)
 *
 * Validates newly imported assets, checks .import sidecars, and builds
 * export packages via configured export presets into approved artifact directories.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  EngineExportPreset,
  EngineExportResult,
  GameEngineError
} from '../engine/GameEngineTypes';

export class GodotAssetPipeline {
  constructor(
    private readonly projectRoot: string,
    private readonly exportBackend?: GodotExportBackend
  ) {}

  /**
   * Verify import metadata sidecars for all project assets
   */
  public verifyAssetImports(): { totalAssets: number; validImports: number; missingImports: string[] } {
    const missingImports: string[] = [];
    let totalAssets = 0;
    let validImports = 0;

    const checkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === '.godot') continue;
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          checkDir(full);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.png', '.jpg', '.wav', '.ogg', '.svg'].includes(ext)) {
            totalAssets++;
            const importSidecar = `${full}.import`;
            if (fs.existsSync(importSidecar)) {
              validImports++;
            } else {
              missingImports.push(path.relative(this.projectRoot, full).replace(/\\/g, '/'));
            }
          }
        }
      }
    };

    if (fs.existsSync(this.projectRoot)) {
      checkDir(this.projectRoot);
    }

    return { totalAssets, validImports, missingImports };
  }

  /**
   * Run an approved export preset
   */
  public async exportPreset(
    preset: EngineExportPreset,
    outputDirectory: string
  ): Promise<EngineExportResult> {
    const startTime = Date.now();
    const resolvedOutDir = path.resolve(outputDirectory);
    if (!this.exportBackend) {
      throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'GODOT_EXPORT_BACKEND_UNAVAILABLE: configure a verified Godot CLI/export backend.');
    }

    if (!fs.existsSync(resolvedOutDir)) {
      fs.mkdirSync(resolvedOutDir, { recursive: true });
    }
    const result = await this.exportBackend.exportProject(this.projectRoot, preset, resolvedOutDir);
    const artifactPath = path.resolve(result.outputArtifactPath);
    const confinedRoot = `${resolvedOutDir}${path.sep}`;
    if (!artifactPath.startsWith(confinedRoot) || !fs.existsSync(artifactPath)) {
      throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'Godot export backend returned an absent or out-of-bounds artifact.');
    }
    return { ...result, durationMs: Math.max(result.durationMs, Date.now() - startTime), byteSize: fs.statSync(artifactPath).size };
  }
}

export interface GodotExportBackend {
  exportProject(projectRoot: string, preset: EngineExportPreset, outputDirectory: string): Promise<EngineExportResult>;
}
