/**
 * Stack Trace Deduplicator & Pruner (PX-03 / PX03-T03)
 * Deduplicates recursive stack frames, prunes runtime internal frames (e.g. node_modules/internal),
 * and highlights project-owned source frames and root cause errors.
 */

export class StackTraceDeduplicator {
  public static compress(stackTrace: string, maxFrames: number = 8): { compressed: string; prunedFramesCount: number; rootCause?: string } {
    const lines = stackTrace.split('\n');
    const output: string[] = [];
    let prunedFramesCount = 0;
    let rootCause: string | undefined;

    let consecutiveInternalFrames = 0;
    let seenFrames = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Error message line(s)
      if (i === 0 || !trimmed.startsWith('at ')) {
        if (!rootCause && trimmed.length > 0) {
          rootCause = trimmed;
        }
        output.push(line);
        continue;
      }

      // Check if frame is internal
      const isInternal = trimmed.includes('node:internal') ||
                         trimmed.includes('node_modules/jest') ||
                         trimmed.includes('node_modules/ts-jest') ||
                         trimmed.includes('node_modules/express');

      if (seenFrames.has(trimmed)) {
        prunedFramesCount++;
        continue; // Drop exact duplicate frame
      }
      seenFrames.add(trimmed);

      if (isInternal) {
        consecutiveInternalFrames++;
        if (consecutiveInternalFrames === 1) {
          output.push(line); // Keep first internal boundary
        } else {
          prunedFramesCount++;
        }
      } else {
        if (consecutiveInternalFrames > 1) {
          output.push(`    ... [${consecutiveInternalFrames - 1} internal framework frames omitted] ...`);
        }
        consecutiveInternalFrames = 0;
        output.push(line);
      }
    }

    if (consecutiveInternalFrames > 1) {
      output.push(`    ... [${consecutiveInternalFrames - 1} internal framework frames omitted] ...`);
    }

    return {
      compressed: output.join('\n'),
      prunedFramesCount,
      rootCause
    };
  }
}
