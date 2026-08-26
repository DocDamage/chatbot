import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AssetCookerExecutor, AssetCookResult } from './AssetCookerAdapter';

const COOKABLE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.svg', '.wav', '.ogg', '.mp3', '.flac',
  '.glb', '.gltf', '.fbx', '.obj', '.mtl', '.json', '.yaml', '.yml', '.txt', '.csv'
]);

function digest(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export class LocalAssetCookerExecutor implements AssetCookerExecutor {
  public async cook(options: Parameters<AssetCookerExecutor['cook']>[0]): Promise<AssetCookResult> {
    const startedAt = Date.now();
    const jobId = `assetcook-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const files: string[] = [];
    const scan = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (['.git', '.cooked', 'node_modules', 'Library', 'Intermediate', 'Saved', '.godot'].includes(entry.name)) continue;
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) scan(full);
        else if (entry.isFile() && COOKABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(full);
      }
    };
    scan(options.configRoot);

    let cookedAssets = 0;
    let skippedAssets = 0;
    const manifestFiles: Array<{ source: string; output: string; sha256: string; sizeBytes: number }> = [];
    for (const sourcePath of files.sort()) {
      const relative = path.relative(options.configRoot, sourcePath);
      const outputPath = path.join(options.outputDirectory, relative);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      const sourceDigest = digest(sourcePath);
      if (options.dirtyOnly && fs.existsSync(outputPath) && digest(outputPath) === sourceDigest) {
        skippedAssets++;
      } else {
        fs.copyFileSync(sourcePath, outputPath);
        cookedAssets++;
      }
      manifestFiles.push({ source: relative.replace(/\\/g, '/'), output: path.relative(options.outputDirectory, outputPath).replace(/\\/g, '/'), sha256: sourceDigest, sizeBytes: fs.statSync(sourcePath).size });
    }
    const manifestPath = path.join(options.outputDirectory, 'asset-cook-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify({ jobId, platform: options.targetPlatform || process.platform, files: manifestFiles }, null, 2), 'utf8');
    return {
      jobId,
      success: true,
      platform: options.targetPlatform || process.platform,
      totalAssets: files.length,
      cookedAssets,
      skippedAssets,
      durationMs: Date.now() - startedAt,
      outputArtifactPath: manifestPath,
      logs: [`Scanned ${files.length} cookable assets.`, `Cooked ${cookedAssets}; skipped ${skippedAssets} unchanged assets.`, `Manifest: ${manifestPath}`]
    };
  }
}
