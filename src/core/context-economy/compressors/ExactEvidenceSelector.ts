/**
 * Exact Path & Symbol Evidence Selector (PX-03 / PX03-T03)
 * Extracts targeted surgical slices of source files bounded by
 * requested symbol names or line ranges with exact source anchors.
 */

export interface EvidenceSlice {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  symbolName?: string;
}

export class ExactEvidenceSelector {
  public static extractSlice(fileContent: string, filePath: string, startLine: number, endLine: number, padding: number = 3): EvidenceSlice {
    const lines = fileContent.split('\n');
    const safeStart = Math.max(1, startLine - padding);
    const safeEnd = Math.min(lines.length, endLine + padding);

    const sliceLines = lines.slice(safeStart - 1, safeEnd);
    const annotated = sliceLines.map((l, idx) => `${safeStart + idx}: ${l}`).join('\n');

    return {
      filePath,
      startLine: safeStart,
      endLine: safeEnd,
      content: annotated
    };
  }
}
