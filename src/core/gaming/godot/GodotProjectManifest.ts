/**
 * Godot Project Manifest & Reconciliation (PX08-T04)
 *
 * Tracks cryptographic SHA-256 digests of all project files (.tscn, .gd, .tres,
 * project.godot) and reconciles against external file modifications before mutations.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { GameEngineError } from '../engine/GameEngineTypes';

export interface ProjectFileRecord {
  relativePath: string;
  digest: string;
  byteSize: number;
  lastModifiedMs: number;
  fileType: 'scene' | 'script' | 'resource' | 'config' | 'shader' | 'asset' | 'other';
}

export interface ProjectManifestSnapshot {
  projectId: string;
  projectRoot: string;
  engineVersion: string;
  capturedAt: string;
  totalFiles: number;
  files: Record<string, ProjectFileRecord>;
  manifestDigest: string;
}

export interface ReconciliationResult {
  isClean: boolean;
  driftCount: number;
  modifiedFiles: string[];
  addedFiles: string[];
  deletedFiles: string[];
  manifestDigest: string;
}

export class GodotProjectManifest {
  private static classifyFileType(ext: string): ProjectFileRecord['fileType'] {
    switch (ext.toLowerCase()) {
      case '.tscn':
      case '.scn':
        return 'scene';
      case '.gd':
      case '.cs':
        return 'script';
      case '.tres':
      case '.res':
        return 'resource';
      case '.godot':
        return 'config';
      case '.gdshader':
      case '.shader':
        return 'shader';
      case '.png':
      case '.jpg':
      case '.wav':
      case '.ogg':
      case '.svg':
        return 'asset';
      default:
        return 'other';
    }
  }

  /**
   * Scan project directory and capture a full cryptographic manifest
   */
  public static capture(projectRoot: string, engineVersion = '4.2.x'): ProjectManifestSnapshot {
    const files: Record<string, ProjectFileRecord> = {};
    const resolvedRoot = path.resolve(projectRoot);

    if (!fs.existsSync(resolvedRoot)) {
      throw new GameEngineError('SCENE_NOT_FOUND', `Project root does not exist: ${projectRoot}`);
    }

    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === '.godot' || entry.name === 'node_modules') {
          continue;
        }
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(resolvedRoot, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile()) {
          try {
            const buffer = fs.readFileSync(fullPath);
            const digest = crypto.createHash('sha256').update(buffer).digest('hex');
            const stats = fs.statSync(fullPath);
            const ext = path.extname(entry.name);

            files[relPath] = {
              relativePath: relPath,
              digest,
              byteSize: stats.size,
              lastModifiedMs: stats.mtimeMs,
              fileType: this.classifyFileType(ext)
            };
          } catch {
            // Ignore unreadable files
          }
        }
      }
    };

    scanDir(resolvedRoot);

    const sortedKeys = Object.keys(files).sort();
    const manifestHasher = crypto.createHash('sha256');
    for (const key of sortedKeys) {
      manifestHasher.update(`${key}:${files[key].digest};`);
    }
    const manifestDigest = manifestHasher.digest('hex');

    const projectName = path.basename(resolvedRoot);

    return {
      projectId: projectName,
      projectRoot: resolvedRoot,
      engineVersion,
      capturedAt: new Date().toISOString(),
      totalFiles: Object.keys(files).length,
      files,
      manifestDigest
    };
  }

  /**
   * Reconcile current disk state against a previously captured manifest snapshot
   */
  public static reconcile(baseline: ProjectManifestSnapshot): ReconciliationResult {
    const current = this.capture(baseline.projectRoot, baseline.engineVersion);

    const modifiedFiles: string[] = [];
    const addedFiles: string[] = [];
    const deletedFiles: string[] = [];

    // Check modified & deleted
    for (const [relPath, record] of Object.entries(baseline.files)) {
      const currentRecord = current.files[relPath];
      if (!currentRecord) {
        deletedFiles.push(relPath);
      } else if (currentRecord.digest !== record.digest) {
        modifiedFiles.push(relPath);
      }
    }

    // Check added
    for (const relPath of Object.keys(current.files)) {
      if (!baseline.files[relPath]) {
        addedFiles.push(relPath);
      }
    }

    const driftCount = modifiedFiles.length + addedFiles.length + deletedFiles.length;

    return {
      isClean: driftCount === 0,
      driftCount,
      modifiedFiles,
      addedFiles,
      deletedFiles,
      manifestDigest: current.manifestDigest
    };
  }
}
