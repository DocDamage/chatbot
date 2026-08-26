/**
 * Git & Symbol Memory Anchoring Engine (PX-05 / PX05-T03)
 *
 * Binds memories to exact repository facts:
 * - Commit hash and branch
 * - File path and SHA-256 digest
 * - Symbol stable ID and signature
 * - Deterministic re-anchoring when symbols or lines shift
 */

import { ProjectMemoryRecord, MemorySourceEvidence } from '../capture/ProjectMemorySchema';
import { ByteOffsetSymbolIndex } from '../../repository-intelligence/indexes/ByteOffsetSymbolIndex';

export interface AnchorValidationResult {
  memoryId: string;
  isAnchored: boolean;
  fileDigestMatch: boolean;
  symbolMatch: boolean;
  currentDigest?: string;
  expectedDigest?: string;
  reanchoredSymbolLocation?: { startLine: number; endLine: number };
  confidencePenalty: number;
}

export class GitSymbolMemoryAnchor {
  constructor(private readonly symbolIndex: ByteOffsetSymbolIndex) {}

  /**
   * Validate memory anchor against current file and symbol states.
   */
  public validateAnchor(memory: ProjectMemoryRecord, currentFileDigests: Map<string, string>): AnchorValidationResult {
    let fileDigestMatch = true;
    let symbolMatch = true;
    let confidencePenalty = 0;
    let reanchoredLocation: { startLine: number; endLine: number } | undefined;

    for (const ev of memory.evidence) {
      if (ev.filePath && ev.fileDigest) {
        const currentDigest = currentFileDigests.get(ev.filePath);
        if (currentDigest && currentDigest !== ev.fileDigest) {
          fileDigestMatch = false;
          confidencePenalty += 0.2;
        }
      }

      if (ev.symbolName) {
        const found = this.symbolIndex.findSymbols({ name: ev.symbolName, exactMatch: true });
        if (found.length === 0) {
          symbolMatch = false;
          confidencePenalty += 0.3;
        } else {
          const matched = found[0];
          reanchoredLocation = {
            startLine: matched.startLine,
            endLine: matched.endLine
          };
        }
      }
    }

    const isAnchored = fileDigestMatch && symbolMatch;

    return {
      memoryId: memory.id,
      isAnchored,
      fileDigestMatch,
      symbolMatch,
      reanchoredSymbolLocation: reanchoredLocation,
      confidencePenalty: Math.min(confidencePenalty, 0.6)
    };
  }
}
