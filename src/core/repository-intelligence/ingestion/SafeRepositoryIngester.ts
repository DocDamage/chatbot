/**
 * Safe Repository Ingestion Service (PX-04 / PX04-T07)
 *
 * Extracts and ingests repository files into an isolated approved root without
 * executing untrusted build/install scripts or permitting path traversal attacks.
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface IngestionOptions {
  maxTotalBytes?: number;
  maxFiles?: number;
  allowedExtensions?: string[];
}

export interface IngestionResult {
  success: boolean;
  ingestedFilesCount: number;
  totalByteSize: number;
  repositoryDigest: string;
  files: Array<{ relativePath: string; byteSize: number; digest: string }>;
  warnings: string[];
  error?: string;
}

export class SafeRepositoryIngester {
  private static readonly DEFAULT_MAX_BYTES = 50 * 1024 * 1024; // 50MB
  private static readonly DEFAULT_MAX_FILES = 2000;

  /**
   * Safely scan and register an existing repository root directory.
   */
  public static inspectRepository(targetDir: string, options: IngestionOptions = {}): IngestionResult {
    const maxBytes = options.maxTotalBytes ?? SafeRepositoryIngester.DEFAULT_MAX_BYTES;
    const maxFiles = options.maxFiles ?? SafeRepositoryIngester.DEFAULT_MAX_FILES;
    const allowedExtensions = options.allowedExtensions
      ? new Set(options.allowedExtensions.map(extension => {
          const normalized = extension.trim().toLowerCase();
          return normalized.startsWith('.') ? normalized : `.${normalized}`;
        }))
      : undefined;

    const files: Array<{ relativePath: string; byteSize: number; digest: string }> = [];
    const warnings: string[] = [];
    let totalBytes = 0;
    const hasher = createHash('sha256');

    const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.venv', '__pycache__', 'target', 'vendor']);

    function walk(dir: string, baseDir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) {
        if (files.length >= maxFiles) {
          warnings.push(`File count cap of ${maxFiles} reached; remaining files skipped.`);
          return;
        }

        if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
        if (ignoreDirs.has(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

        // Path traversal defense
        if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
          warnings.push(`Ignored potential traversal path: ${relPath}`);
          continue;
        }

        if (entry.isDirectory()) {
          walk(fullPath, baseDir);
        } else if (entry.isFile()) {
          if (allowedExtensions && !allowedExtensions.has(path.extname(entry.name).toLowerCase())) {
            continue;
          }
          try {
            const stat = fs.statSync(fullPath);
            if (totalBytes + stat.size > maxBytes) {
              warnings.push(`Total byte size cap of ${maxBytes} bytes reached; remaining files skipped.`);
              return;
            }

            const buf = fs.readFileSync(fullPath);
            const digest = createHash('sha256').update(buf).digest('hex');
            hasher.update(`${relPath}:${digest}`);

            files.push({
              relativePath: relPath,
              byteSize: stat.size,
              digest
            });
            totalBytes += stat.size;
          } catch (err: any) {
            warnings.push(`Could not read file '${relPath}': ${err.message}`);
          }
        }
      }
    }

    try {
      if (!fs.existsSync(targetDir)) {
        return {
          success: false,
          ingestedFilesCount: 0,
          totalByteSize: 0,
          repositoryDigest: '',
          files: [],
          warnings: [],
          error: `Target directory '${targetDir}' does not exist`
        };
      }

      walk(targetDir, targetDir);
      const repositoryDigest = hasher.digest('hex');

      return {
        success: true,
        ingestedFilesCount: files.length,
        totalByteSize: totalBytes,
        repositoryDigest,
        files,
        warnings
      };
    } catch (err: any) {
      return {
        success: false,
        ingestedFilesCount: 0,
        totalByteSize: 0,
        repositoryDigest: '',
        files: [],
        warnings,
        error: err.message
      };
    }
  }
}
