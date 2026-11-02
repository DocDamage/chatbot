/**
 * AssetCooker External Adapter (PX09-T03)
 *
 * Implements isolated adapter for AssetCooker incremental game-asset builds.
 * Preserves MPL-2.0 boundary isolation and confines build artifacts.
 */

import * as path from 'path';
import * as fs from 'fs';
import { GameEngineError } from '../engine/GameEngineTypes';

export interface AssetCookJobOptions {
  configRoot: string;
  targetPlatform?: 'windows' | 'linux' | 'macos';
  dirtyOnly?: boolean;
  maxParallelWorkers?: number;
}

export interface AssetCookResult {
  jobId: string;
  success: boolean;
  platform: string;
  totalAssets: number;
  cookedAssets: number;
  skippedAssets: number;
  durationMs: number;
  outputArtifactPath: string;
  logs: string[];
}

export interface AssetCookerExecutor {
  cook(options: AssetCookJobOptions & { outputDirectory: string }): Promise<AssetCookResult>;
}

export class AssetCookerAdapter {
  /**
   * Run an approved incremental asset cooking job within an isolated sandbox
   */
  public static async cookAssets(options: AssetCookJobOptions, executor?: AssetCookerExecutor): Promise<AssetCookResult> {
    const resolvedConfig = path.resolve(options.configRoot);

    if (!fs.existsSync(resolvedConfig)) {
      throw new GameEngineError('SCENE_NOT_FOUND', `AssetCooker config root not found: ${options.configRoot}`);
    }
    if (!executor) {
      throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'ASSET_COOKER_BACKEND_UNAVAILABLE: configure the isolated AssetCooker worker.');
    }

    const platform = options.targetPlatform || 'windows';
    const outputArtifactPath = path.join(resolvedConfig, '.cooked', platform);

    if (!fs.existsSync(outputArtifactPath)) {
      fs.mkdirSync(outputArtifactPath, { recursive: true });
    }

    const result = await executor.cook({ ...options, configRoot: resolvedConfig, outputDirectory: outputArtifactPath });
    const resultPath = path.resolve(result.outputArtifactPath);
    const confinedRoot = `${path.resolve(outputArtifactPath)}${path.sep}`;
    if (resultPath !== path.resolve(outputArtifactPath) && !resultPath.startsWith(confinedRoot)) {
      throw new GameEngineError('OUT_OF_BOUNDS_PATH', 'AssetCooker returned an artifact outside its isolated output directory.');
    }
    return result;
  }
}
