/**
 * Log & Event Stream Compressor (PX-03 / PX03-T03)
 * Collapses repeated/burst log entries, heartbeat noise, and identical events
 * into count-annotated summaries while preserving timestamps and anomalies.
 */

export class LogEventCompressor {
  public static compress(logText: string, maxConsecutiveAllowed: number = 2): { compressed: string; collapsedLinesCount: number } {
    const lines = logText.split('\n');
    const output: string[] = [];
    let collapsedCount = 0;

    let previousNormalized = '';
    let previousRaw = '';
    let repetitionCount = 0;

    const normalize = (line: string) => {
      // Strip timestamps and variable numbers/uuids for grouping
      return line
        .replace(/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?Z?\s*/, '')
        .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '<uuid>')
        .replace(/\b\d+\b/g, '<num>');
    };

    const flush = () => {
      if (repetitionCount === 1) {
        output.push(previousRaw);
      } else if (repetitionCount > 1) {
        output.push(`${previousRaw}  [... repeated ${repetitionCount} times]`);
        collapsedCount += repetitionCount - 1;
      }
      repetitionCount = 0;
    };

    for (const line of lines) {
      if (line.trim().length === 0) {
        flush();
        output.push(line);
        previousNormalized = '';
        continue;
      }

      const norm = normalize(line);
      if (norm === previousNormalized && norm.length > 5) {
        repetitionCount++;
      } else {
        flush();
        previousNormalized = norm;
        previousRaw = line;
        repetitionCount = 1;
      }
    }
    flush();

    return {
      compressed: output.join('\n'),
      collapsedLinesCount: collapsedCount
    };
  }
}
